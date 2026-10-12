package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// A latency reading for a server whose protocol runs over UDP.
//
// `probe` times a TCP connect to the server's port, which says nothing about
// WireGuard, Hysteria or TUIC: they listen on UDP, a TCP dial to that port is
// refused or answered by something else, and a working server reads as
// "fail". Nothing short of the protocol's own handshake gets an answer out of
// them -- WireGuard ignores every packet it cannot authenticate.
//
// So `delay` asks sing-box. It starts a throwaway instance holding only that
// server, with no inbound, and reads the Clash API's delay test: the time for
// one HTTP request through the server, handshake included. That is a real
// answer for any protocol sing-box speaks, and it also catches what a dial
// cannot -- a wrong key, an expired account.

// delayArgs is a `delay` request: a sing-box config built for the server, as
// the extension builds one for a connect.
type delayArgs struct {
	Config    json.RawMessage `json:"config"`
	URL       string          `json:"url"`
	TimeoutMs int             `json:"timeoutMs"`
}

type delayResult struct {
	MS int64 `json:"ms"`
}

const (
	delayDefaultURL     = "https://cp.cloudflare.com/generate_204"
	delayDefaultTimeout = 5 * time.Second
	delayMaxTimeout     = 15 * time.Second
	// The outbound the extension's config names for the server.
	delayTag = "proxy-out"
)

var (
	// delayReadyTimeout is how long a tester instance gets to open its API.
	delayReadyTimeout = 3 * time.Second
	// delaySlots caps tester instances running at once: each is a sing-box
	// process, and a list of servers is probed a few at a time.
	delaySlots = make(chan struct{}, 2)
)

func delayTimeout(ms int) time.Duration {
	if ms <= 0 {
		return delayDefaultTimeout
	}
	if d := time.Duration(ms) * time.Millisecond; d < delayMaxTimeout {
		return d
	}
	return delayMaxTimeout
}

// testerConfig keeps what reaching the server needs -- its outbound or
// endpoint, the DNS that resolves it -- and drops the inbounds and routing. It
// then adds the Clash API the delay is read from.
func testerConfig(raw []byte, addr, secret string) ([]byte, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("config not json: %w", err)
	}
	found := false
	for _, key := range []string{"outbounds", "endpoints"} {
		list, _ := doc[key].([]any)
		for _, v := range list {
			if m, ok := v.(map[string]any); ok && m["tag"] == delayTag {
				found = true
			}
		}
	}
	if !found {
		return nil, fmt.Errorf("config has no %q outbound", delayTag)
	}
	out := map[string]any{
		"log":       map[string]any{"level": "warn"},
		"outbounds": doc["outbounds"],
		"experimental": map[string]any{
			"clash_api": map[string]any{"external_controller": addr, "secret": secret},
		},
	}
	if eps, ok := doc["endpoints"]; ok {
		out["endpoints"] = eps
	}
	if dns, ok := doc["dns"].(map[string]any); ok {
		out["dns"] = map[string]any{"servers": dns["servers"], "final": dns["final"]}
	}
	if route, ok := doc["route"].(map[string]any); ok {
		if r, ok := route["default_domain_resolver"]; ok {
			out["route"] = map[string]any{"default_domain_resolver": r}
		}
	}
	return json.Marshal(out)
}

// delayHTTP is a seam for tests.
var delayHTTP = &http.Client{}

func (s *supervisor) delay(args delayArgs) (*delayResult, error) {
	core := singBoxCore{}
	bin, err := core.Locate()
	if err != nil {
		return nil, err
	}
	if !singboxAtLeast(core, 1, 12) {
		return nil, errors.New("delay: needs sing-box 1.12 or later")
	}
	addr, secret, err := clashAPIParams()
	if err != nil {
		return nil, err
	}
	cfg, err := testerConfig(args.Config, addr, secret)
	if err != nil {
		return nil, fmt.Errorf("delay: %w", err)
	}
	if iface := s.boundInterface(); iface != "" {
		if bound, err := core.InjectBindInterface(cfg, iface); err == nil {
			cfg = bound
		}
	}

	delaySlots <- struct{}{}
	defer func() { <-delaySlots }()

	dir := filepath.Join(os.TempDir(), "noctis", "delay")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	f, err := os.CreateTemp(dir, "tester-*.json")
	if err != nil {
		return nil, err
	}
	defer os.Remove(f.Name())
	_, err = f.Write(cfg)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return nil, err
	}

	timeout := delayTimeout(args.TimeoutMs)
	ctx, cancel := context.WithTimeout(context.Background(), delayReadyTimeout+timeout+2*time.Second)
	defer cancel()
	tail := newLineTail(startTailLines)
	cmd := exec.CommandContext(ctx, bin, "run", "-c", f.Name())
	// One writer per stream: exec copies each from its own goroutine.
	cmd.Stdout, cmd.Stderr = &tailWriter{tail: tail}, &tailWriter{tail: tail}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("spawn sing-box: %w", err)
	}
	exited := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(exited)
	}()
	defer func() {
		_ = cmd.Process.Kill()
		<-exited
	}()

	base := "http://" + addr
	if err := waitAPI(ctx, base, secret, exited); err != nil {
		if errors.Is(err, errCoreExited) {
			return nil, fmt.Errorf("delay: sing-box exited: %s", orNoOutput(failureLine(tail.lines())))
		}
		return nil, fmt.Errorf("delay: %w", err)
	}

	target := args.URL
	if target == "" {
		target = delayDefaultURL
	}
	q := url.Values{"url": {target}, "timeout": {fmt.Sprint(timeout.Milliseconds())}}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/proxies/"+delayTag+"/delay?"+q.Encode(), nil)
	req.Header.Set("Authorization", "Bearer "+secret)
	resp, err := delayHTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("delay: %w", err)
	}
	defer resp.Body.Close()
	var body struct {
		Delay   int64  `json:"delay"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("delay: HTTP %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK || body.Delay <= 0 {
		msg := strings.ToLower(body.Message)
		if msg == "" {
			msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		// The test's own failure is the server's; say what the core saw, if it
		// said anything.
		if line := failureLine(tail.lines()); line != "" && !strings.Contains(msg, "timeout") {
			msg += ": " + line
		}
		return nil, fmt.Errorf("delay: %s", msg)
	}
	return &delayResult{MS: body.Delay}, nil
}

// waitAPI polls the tester's API until it answers, the process exits, or ctx
// and delayReadyTimeout run out.
func waitAPI(ctx context.Context, base, secret string, exited <-chan struct{}) error {
	deadline := time.Now().Add(delayReadyTimeout)
	for {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/version", nil)
		req.Header.Set("Authorization", "Bearer "+secret)
		if resp, err := delayHTTP.Do(req); err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		if !time.Now().Before(deadline) {
			return fmt.Errorf("tester API not ready after %s", delayReadyTimeout)
		}
		select {
		case <-exited:
			return errCoreExited
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func orNoOutput(s string) string {
	if s == "" {
		return "no output"
	}
	return s
}

// tailWriter splits a process's output into lines for a lineTail.
type tailWriter struct {
	tail *lineTail
	buf  []byte
}

func (w *tailWriter) Write(b []byte) (int, error) {
	w.buf = append(w.buf, b...)
	for {
		i := strings.IndexByte(string(w.buf), '\n')
		if i < 0 {
			break
		}
		w.tail.add(string(w.buf[:i]))
		w.buf = w.buf[i+1:]
	}
	if len(w.buf) > maxLogLine {
		w.tail.add(string(w.buf))
		w.buf = nil
	}
	return len(b), nil
}
