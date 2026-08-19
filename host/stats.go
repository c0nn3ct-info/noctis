package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

// TrafficSample is the real-time stats payload pushed to the extension as a
// `stats` event (and returned by the `stats` request as a one-shot snapshot).
// Counters is nil when the active core can't report them (xray, legacy
// sing-box); the UI reads Capabilities to know what's trustworthy.
type TrafficSample struct {
	Core         string              `json:"core"`
	TS           int64               `json:"ts"`
	SessionStart int64               `json:"sessionStart"`
	Volume       TrafficVolume       `json:"volume"`
	Speed        TrafficSpeed        `json:"speed"`
	Counters     *TrafficCounters    `json:"counters"`
	Capabilities TrafficCapabilities `json:"capabilities"`
}

type TrafficVolume struct {
	Up   int64 `json:"up"`
	Down int64 `json:"down"`
}

type TrafficSpeed struct {
	Up   int64 `json:"up"`
	Down int64 `json:"down"`
}

type TrafficCounters struct {
	Blocked int64 `json:"blocked"`
	Passed  int64 `json:"passed"`
	Proxied int64 `json:"proxied"`
}

type TrafficCapabilities struct {
	Volume bool `json:"volume"`
	Speed  bool `json:"speed"`
	// Counters is true when blocked/passed/proxied are reported at all.
	Counters bool `json:"counters"`
	// CountersBlockedApprox flags that `blocked` is best-effort: sing-box
	// rarely surfaces rejected flows as live connections, so we undercount.
	CountersBlockedApprox bool `json:"countersBlockedApprox"`
}

// statsClient has no timeout: the /traffic stream is long-lived and torn down
// via context cancellation, not a deadline. /connections requests get their own
// per-call context timeout.
var statsClient = &http.Client{}

// seenConnCap bounds the per-session set of classified connection ids so a very
// long session can't grow it without limit. Counters keep their value on reset.
const seenConnCap = 100_000

// randRead is a seam for tests; crypto/rand.Read does not fail in practice,
// but the error is still handled rather than swallowed.
var randRead = rand.Read

func randomSecret() (string, error) {
	b := make([]byte, 16)
	if _, err := randRead(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// statsCapabilities reports what the active core can deliver. hasStats is false
// for cores without a Clash API (xray, legacy sing-box) — everything off.
func statsCapabilities(coreID string, hasStats bool) TrafficCapabilities {
	if !hasStats {
		return TrafficCapabilities{}
	}
	return TrafficCapabilities{
		Volume:                true,
		Speed:                 true,
		Counters:              true,
		CountersBlockedApprox: coreID == "sing-box",
	}
}

func initialSample(coreID string, hasStats bool, start time.Time) TrafficSample {
	caps := statsCapabilities(coreID, hasStats)
	var counters *TrafficCounters
	if caps.Counters {
		counters = &TrafficCounters{}
	}
	return TrafficSample{
		Core:         coreID,
		TS:           time.Now().UnixMilli(),
		SessionStart: start.UnixMilli(),
		Counters:     counters,
		Capabilities: caps,
	}
}

func emptySample() TrafficSample { return TrafficSample{} }

// runStats holds the Clash /traffic stream (one {up,down} per second = speed)
// and, on each tick, polls /connections for cumulative volume + rule-outcome
// counters, composing a TrafficSample it caches and pushes to the extension.
// It reconnects with backoff while ctx is live; cumulative counters persist
// across reconnects via the shared `seen` set.
func (s *supervisor) runStats(ctx context.Context, addr, secret, coreID string) {
	seen := map[string]struct{}{}
	var blocked, passed, proxied int64
	backoff := 500 * time.Millisecond
	for ctx.Err() == nil {
		err := s.streamStats(ctx, addr, secret, coreID, seen, &blocked, &passed, &proxied)
		if ctx.Err() != nil {
			return
		}
		_ = err // stream ended or errored; back off and retry
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < 5*time.Second {
			backoff *= 2
		}
	}
}

func (s *supervisor) streamStats(
	ctx context.Context, addr, secret, coreID string,
	seen map[string]struct{}, blocked, passed, proxied *int64,
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+addr+"/traffic", nil)
	if err != nil {
		return err
	}
	if secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	resp, err := statsClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	caps := statsCapabilities(coreID, true)
	dec := json.NewDecoder(resp.Body)
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var tick struct {
			Up   int64 `json:"up"`
			Down int64 `json:"down"`
		}
		if err := dec.Decode(&tick); err != nil {
			return err
		}

		vol := s.pollConnections(ctx, addr, secret, seen, blocked, passed, proxied)
		sample := TrafficSample{
			Core:         coreID,
			TS:           time.Now().UnixMilli(),
			SessionStart: s.sessionStart.UnixMilli(),
			Volume:       vol,
			Speed:        TrafficSpeed{Up: tick.Up, Down: tick.Down},
			Counters:     &TrafficCounters{Blocked: *blocked, Passed: *passed, Proxied: *proxied},
			Capabilities: caps,
		}
		s.lastStats.Store(sample)
		if s.notify != nil {
			s.notify("stats", sample)
		}
	}
}

// pollConnections fetches /connections for cumulative volume totals and updates
// the per-session counters by classifying each not-yet-seen connection's egress
// chain (REJECT=blocked, DIRECT=passed, else proxied). On error it returns the
// last-known volume implicitly (zero — the caller's sample still carries fresh
// speed), and counters are left untouched.
func (s *supervisor) pollConnections(
	ctx context.Context, addr, secret string,
	seen map[string]struct{}, blocked, passed, proxied *int64,
) TrafficVolume {
	cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(cctx, http.MethodGet, "http://"+addr+"/connections", nil)
	if err != nil {
		return TrafficVolume{}
	}
	if secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	resp, err := statsClient.Do(req)
	if err != nil {
		return TrafficVolume{}
	}
	defer resp.Body.Close()

	var payload struct {
		DownloadTotal int64 `json:"downloadTotal"`
		UploadTotal   int64 `json:"uploadTotal"`
		Connections   []struct {
			ID     string   `json:"id"`
			Chains []string `json:"chains"`
		} `json:"connections"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return TrafficVolume{}
	}

	if len(seen) > seenConnCap {
		for k := range seen {
			delete(seen, k)
		}
	}
	for _, c := range payload.Connections {
		if c.ID == "" {
			continue
		}
		if _, ok := seen[c.ID]; ok {
			continue
		}
		seen[c.ID] = struct{}{}
		switch classifyChains(c.Chains) {
		case "blocked":
			*blocked++
		case "passed":
			*passed++
		default:
			*proxied++
		}
	}
	return TrafficVolume{Up: payload.UploadTotal, Down: payload.DownloadTotal}
}

// classifyChains maps a connection's proxy chain to a routing outcome. A chain
// touching REJECT is blocked; one egressing DIRECT is passed; anything else
// went through the proxy outbound.
func classifyChains(chains []string) string {
	for _, c := range chains {
		if strings.Contains(strings.ToUpper(c), "REJECT") {
			return "blocked"
		}
	}
	for _, c := range chains {
		if strings.EqualFold(c, "DIRECT") {
			return "passed"
		}
	}
	return "proxied"
}
