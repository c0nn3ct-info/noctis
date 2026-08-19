package main

import (
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRandomSecret(t *testing.T) {
	a, err := randomSecret()
	if err != nil {
		t.Fatal(err)
	}
	if len(a) != 32 {
		t.Fatalf("len = %d", len(a))
	}
	if _, err := hex.DecodeString(a); err != nil {
		t.Fatalf("not hex: %v", err)
	}
	b, _ := randomSecret()
	if a == b {
		t.Fatal("two secrets should differ")
	}
}

func TestStatsCapabilities(t *testing.T) {
	if c := statsCapabilities("xray", false); c.Volume || c.Speed || c.Counters || c.CountersBlockedApprox {
		t.Fatalf("no-stats caps = %+v", c)
	}
	c := statsCapabilities("sing-box", true)
	if !c.Volume || !c.Speed || !c.Counters || !c.CountersBlockedApprox {
		t.Fatalf("sing-box caps = %+v", c)
	}
	if c := statsCapabilities("mihomo", true); c.CountersBlockedApprox {
		t.Fatalf("mihomo should not flag approx blocked: %+v", c)
	}
}

func TestInitialSample(t *testing.T) {
	start := time.Now()
	s := initialSample("sing-box", true, start)
	if s.Core != "sing-box" || s.Counters == nil || !s.Capabilities.Volume {
		t.Fatalf("sample = %+v", s)
	}
	if s.SessionStart != start.UnixMilli() {
		t.Fatalf("sessionStart = %d", s.SessionStart)
	}
	noStats := initialSample("xray", false, start)
	if noStats.Counters != nil || noStats.Capabilities.Volume {
		t.Fatalf("xray sample = %+v", noStats)
	}
}

func TestEmptySample(t *testing.T) {
	if s := emptySample(); s.Core != "" || s.Counters != nil {
		t.Fatalf("empty = %+v", s)
	}
}

func TestClassifyChains(t *testing.T) {
	cases := []struct {
		chains []string
		want   string
	}{
		{[]string{"proxy-out", "reject-drop"}, "blocked"},
		{[]string{"REJECT"}, "blocked"},
		{[]string{"direct"}, "passed"},
		{[]string{"proxy-out", "DIRECT"}, "passed"},
		{[]string{"proxy-out"}, "proxied"},
		{nil, "proxied"},
	}
	for _, c := range cases {
		if got := classifyChains(c.chains); got != c.want {
			t.Fatalf("classifyChains(%v) = %q, want %q", c.chains, got, c.want)
		}
	}
}

const connectionsBody = `{
  "downloadTotal": 100,
  "uploadTotal": 50,
  "connections": [
    {"id": "", "chains": ["ignored"]},
    {"id": "a", "chains": ["REJECT"]},
    {"id": "b", "chains": ["proxy-out", "DIRECT"]},
    {"id": "c", "chains": ["proxy-out"]},
    {"id": "a", "chains": ["REJECT"]}
  ]
}`

func clashAPIServer(t *testing.T, secret string, traffic http.HandlerFunc) (srv *httptest.Server, addr string) {
	t.Helper()
	mux := http.NewServeMux()
	auth := func(w http.ResponseWriter, r *http.Request) bool {
		if secret != "" && r.Header.Get("Authorization") != "Bearer "+secret {
			w.WriteHeader(http.StatusUnauthorized)
			return false
		}
		return true
	}
	mux.HandleFunc("/connections", func(w http.ResponseWriter, r *http.Request) {
		if !auth(w, r) {
			return
		}
		io.WriteString(w, connectionsBody)
	})
	if traffic != nil {
		mux.HandleFunc("/traffic", func(w http.ResponseWriter, r *http.Request) {
			if !auth(w, r) {
				return
			}
			traffic(w, r)
		})
	}
	srv = httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, strings.TrimPrefix(srv.URL, "http://")
}

func TestPollConnections(t *testing.T) {
	_, addr := clashAPIServer(t, "sekret", nil)
	s := newSupervisor(nil)
	seen := map[string]struct{}{}
	var blocked, passed, proxied int64

	vol := s.pollConnections(context.Background(), addr, "sekret", seen, &blocked, &passed, &proxied)
	if vol.Up != 50 || vol.Down != 100 {
		t.Fatalf("vol = %+v", vol)
	}
	if blocked != 1 || passed != 1 || proxied != 1 {
		t.Fatalf("counters = %d/%d/%d", blocked, passed, proxied)
	}
	if len(seen) != 3 {
		t.Fatalf("seen = %d", len(seen))
	}
	// Second poll: same ids, counters unchanged.
	s.pollConnections(context.Background(), addr, "sekret", seen, &blocked, &passed, &proxied)
	if blocked != 1 || passed != 1 || proxied != 1 {
		t.Fatalf("counters after re-poll = %d/%d/%d", blocked, passed, proxied)
	}
}

func TestPollConnectionsSeenCapPurge(t *testing.T) {
	_, addr := clashAPIServer(t, "", nil)
	s := newSupervisor(nil)
	seen := make(map[string]struct{}, seenConnCap+2)
	for i := 0; i <= seenConnCap; i++ {
		seen[fmt.Sprintf("conn-%d", i)] = struct{}{}
	}
	var blocked, passed, proxied int64
	s.pollConnections(context.Background(), addr, "", seen, &blocked, &passed, &proxied)
	if len(seen) != 3 {
		t.Fatalf("seen after purge = %d, want 3", len(seen))
	}
	if blocked != 1 || passed != 1 || proxied != 1 {
		t.Fatalf("counters = %d/%d/%d", blocked, passed, proxied)
	}
}

func TestPollConnectionsErrors(t *testing.T) {
	s := newSupervisor(nil)
	seen := map[string]struct{}{}
	var b, p, x int64

	// Bad address: request cannot be built.
	if vol := s.pollConnections(context.Background(), "bad addr", "", seen, &b, &p, &x); vol != (TrafficVolume{}) {
		t.Fatalf("vol = %+v", vol)
	}
	// Nothing listening.
	port, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	if vol := s.pollConnections(context.Background(), fmt.Sprintf("127.0.0.1:%d", port), "", seen, &b, &p, &x); vol != (TrafficVolume{}) {
		t.Fatalf("vol = %+v", vol)
	}
	// Invalid JSON body.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		io.WriteString(w, "not json")
	}))
	defer srv.Close()
	if vol := s.pollConnections(context.Background(), strings.TrimPrefix(srv.URL, "http://"), "", seen, &b, &p, &x); vol != (TrafficVolume{}) {
		t.Fatalf("vol = %+v", vol)
	}
	if b != 0 || p != 0 || x != 0 {
		t.Fatalf("counters touched on errors: %d/%d/%d", b, p, x)
	}
}

func TestStreamStatsErrors(t *testing.T) {
	s := newSupervisor(nil)
	seen := map[string]struct{}{}
	var b, p, x int64

	// Request cannot be built.
	if err := s.streamStats(context.Background(), "bad addr", "", "sing-box", seen, &b, &p, &x); err == nil {
		t.Fatal("want request error")
	}
	// Nothing listening.
	port, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	if err := s.streamStats(context.Background(), fmt.Sprintf("127.0.0.1:%d", port), "", "sing-box", seen, &b, &p, &x); err == nil {
		t.Fatal("want connect error")
	}
}

// TestRunStatsFlow drives the full loop: first /traffic connection delivers one
// tick then closes (stream error -> backoff -> reconnect), the second delivers
// two ticks in one write so the decoder buffers both; the test cancels the
// context from the notify callback after the second sample, which exercises
// the in-loop ctx check and both return paths.
func TestRunStatsFlow(t *testing.T) {
	var conns int32
	_, addr := clashAPIServer(t, "sekret", func(w http.ResponseWriter, r *http.Request) {
		f := w.(http.Flusher)
		if atomic.AddInt32(&conns, 1) == 1 {
			io.WriteString(w, `{"up":1,"down":2}`+"\n")
			f.Flush()
			return // close: decode error -> backoff -> reconnect
		}
		io.WriteString(w, `{"up":3,"down":4}`+"\n"+`{"up":5,"down":6}`+"\n")
		f.Flush()
		<-r.Context().Done()
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	samples := make(chan TrafficSample, 16)
	var count int32
	notify := func(event string, payload any) {
		if event != "stats" {
			return
		}
		sample := payload.(TrafficSample)
		if atomic.AddInt32(&count, 1) == 2 {
			cancel() // next loop iteration sees ctx.Err() != nil
		}
		samples <- sample
	}
	s := newSupervisor(notify)
	s.sessionStart = time.Now()

	done := make(chan struct{})
	go func() {
		s.runStats(ctx, addr, "sekret", "sing-box")
		close(done)
	}()

	first := <-samples
	if first.Speed.Up != 1 || first.Speed.Down != 2 {
		t.Fatalf("first sample speed = %+v", first.Speed)
	}
	if first.Volume.Up != 50 || first.Volume.Down != 100 {
		t.Fatalf("first sample volume = %+v", first.Volume)
	}
	if first.Counters == nil || first.Counters.Blocked != 1 {
		t.Fatalf("first sample counters = %+v", first.Counters)
	}
	second := <-samples
	if second.Speed.Up != 3 || second.Speed.Down != 4 {
		t.Fatalf("second sample speed = %+v", second.Speed)
	}
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("runStats did not stop after cancel")
	}
	if got := s.statsSnapshot(); got.Speed.Up != 3 {
		t.Fatalf("cached snapshot = %+v", got)
	}
}

func TestRunStatsCancelDuringBackoff(t *testing.T) {
	port, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	s := newSupervisor(nil)
	done := make(chan struct{})
	go func() {
		// Connection refused immediately -> select waits out the 500ms backoff.
		s.runStats(ctx, fmt.Sprintf("127.0.0.1:%d", port), "", "sing-box")
		close(done)
	}()
	time.Sleep(100 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("runStats did not honor cancel during backoff")
	}
}

func TestRunStatsAlreadyCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s := newSupervisor(nil)
	doneCh := make(chan struct{})
	go func() {
		s.runStats(ctx, "127.0.0.1:1", "", "sing-box")
		close(doneCh)
	}()
	select {
	case <-doneCh:
	case <-time.After(2 * time.Second):
		t.Fatal("runStats with cancelled ctx should return immediately")
	}
}
