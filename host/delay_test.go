package main

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func delayConfig(behavior string, extra map[string]any) []byte {
	doc := map[string]any{
		"inbounds":  []any{map[string]any{"type": "socks", "listen_port": 1}},
		"outbounds": []any{map[string]any{"type": "direct", "tag": "proxy-out", "test_delay": behavior}},
		"dns":       map[string]any{"servers": []any{map[string]any{"type": "udp", "tag": "d"}}, "final": "d", "rules": []any{"x"}},
		"route":     map[string]any{"default_domain_resolver": "d", "rules": []any{"x"}, "rule_set": []any{"x"}},
	}
	for k, v := range extra {
		doc[k] = v
	}
	b, _ := json.Marshal(doc)
	return b
}

func withFakeSingBox(t *testing.T, version string) {
	t.Helper()
	stashVersionCache(t)
	seedVersion(t, "sing-box", version)
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, version))
	t.Setenv("TMPDIR", t.TempDir())
}

func TestDelay(t *testing.T) {
	withFakeSingBox(t, "1.13.0")
	sup := newSupervisor(nil)
	sup.setBindPref("none")

	r, err := sup.delay(delayArgs{Config: delayConfig("ok", nil)})
	if err != nil || r.MS != 42 {
		t.Fatalf("ok: %+v %v", r, err)
	}

	cases := map[string]string{
		"timeout": "delay: timeout",
		"refused": "delay: an error occurred in the delay test: connection refused by peer",
		"garbage": "delay: HTTP 200",
		"zero":    "delay: HTTP 200",
		"exit":    "delay: sing-box exited: start service: tester refused",
	}
	for behavior, want := range cases {
		if _, err := sup.delay(delayArgs{Config: delayConfig(behavior, nil), TimeoutMs: 1000}); err == nil || err.Error() != want {
			t.Errorf("%s: got %v, want %q", behavior, err, want)
		}
	}

	// Nothing of the tester is left behind.
	if left, _ := os.ReadDir(filepath.Join(os.TempDir(), "noctis", "delay")); len(left) != 0 {
		t.Fatalf("tester configs left: %v", left)
	}
}

func TestDelayAPINeverUp(t *testing.T) {
	withFakeSingBox(t, "1.13.0")
	prev := delayReadyTimeout
	delayReadyTimeout = 300 * time.Millisecond
	t.Cleanup(func() { delayReadyTimeout = prev })
	_, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("noapi", nil)})
	if err == nil || !strings.Contains(err.Error(), "tester API not ready") {
		t.Fatalf("got %v", err)
	}
}

func TestDelayRefuses(t *testing.T) {
	withFakeSingBox(t, "1.11.0")
	if _, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("ok", nil)}); err == nil || !strings.Contains(err.Error(), "1.12") {
		t.Fatalf("old sing-box: %v", err)
	}
	withFakeSingBox(t, "1.13.0")
	if _, err := newSupervisor(nil).delay(delayArgs{Config: []byte("{")}); err == nil || !strings.Contains(err.Error(), "not json") {
		t.Fatalf("bad config: %v", err)
	}
	if _, err := newSupervisor(nil).delay(delayArgs{Config: []byte(`{"outbounds":[{"tag":"other"}]}`)}); err == nil || !strings.Contains(err.Error(), `no "proxy-out"`) {
		t.Fatalf("no proxy-out: %v", err)
	}
	t.Setenv("SINGBOX_BIN", filepath.Join(t.TempDir(), "missing"))
	t.Setenv("PATH", t.TempDir())
	if _, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("ok", nil)}); err == nil {
		t.Fatal("want a locate error")
	}
}

func TestDelayTempDirFailures(t *testing.T) {
	withFakeSingBox(t, "1.13.0")
	file := filepath.Join(t.TempDir(), "file")
	_ = os.WriteFile(file, nil, 0o600)
	t.Setenv("TMPDIR", file)
	if _, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("ok", nil)}); err == nil {
		t.Fatal("want a temp dir error")
	}
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	_ = os.MkdirAll(filepath.Join(tmp, "noctis", "delay"), 0o500)
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(tmp, "noctis", "delay"), 0o700) })
	if _, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("ok", nil)}); err == nil {
		t.Fatal("want a create error")
	}
}

func TestDelaySpawnFailure(t *testing.T) {
	withFakeSingBox(t, "1.13.0")
	notExec := filepath.Join(t.TempDir(), "sing-box")
	_ = os.WriteFile(notExec, []byte("#!/bin/sh\n"), 0o644)
	t.Setenv("SINGBOX_BIN", notExec)
	if _, err := newSupervisor(nil).delay(delayArgs{Config: delayConfig("ok", nil)}); err == nil || !strings.Contains(err.Error(), "spawn sing-box") {
		t.Fatalf("got %v", err)
	}
}

func TestTesterConfig(t *testing.T) {
	raw := delayConfig("ok", map[string]any{"endpoints": []any{map[string]any{"type": "wireguard", "tag": "proxy-out"}}})
	out, err := testerConfig(raw, "127.0.0.1:9", "s")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	_ = json.Unmarshal(out, &doc)
	if doc["inbounds"] != nil || doc["endpoints"] == nil {
		t.Fatalf("got %s", out)
	}
	if dns := doc["dns"].(map[string]any); dns["rules"] != nil || dns["final"] != "d" {
		t.Fatalf("dns: %v", dns)
	}
	if route := doc["route"].(map[string]any); len(route) != 1 || route["default_domain_resolver"] != "d" {
		t.Fatalf("route: %v", route)
	}
	api := doc["experimental"].(map[string]any)["clash_api"].(map[string]any)
	if api["external_controller"] != "127.0.0.1:9" || api["secret"] != "s" {
		t.Fatalf("api: %v", api)
	}
	bare, _ := testerConfig([]byte(`{"outbounds":[{"tag":"proxy-out"}],"route":{}}`), "a", "s")
	if strings.Contains(string(bare), "route") || strings.Contains(string(bare), "dns") {
		t.Fatalf("bare: %s", bare)
	}
}

func TestDelayTimeout(t *testing.T) {
	for ms, want := range map[int]time.Duration{0: delayDefaultTimeout, -1: delayDefaultTimeout, 2000: 2 * time.Second, 60000: delayMaxTimeout} {
		if got := delayTimeout(ms); got != want {
			t.Errorf("%d: got %s", ms, got)
		}
	}
}

func TestTailWriter(t *testing.T) {
	tail := newLineTail(8)
	w := &tailWriter{tail: tail}
	_, _ = w.Write([]byte("a\nb"))
	_, _ = w.Write([]byte("c\n"))
	_, _ = w.Write([]byte(strings.Repeat("x", maxLogLine+1)))
	got := tail.lines()
	if len(got) != 3 || got[0] != "a" || got[1] != "bc" || len(got[2]) != maxLogLine+1 {
		t.Fatalf("got %q", got)
	}
	if orNoOutput("") != "no output" || orNoOutput("x") != "x" {
		t.Fatal("orNoOutput")
	}
}

func TestDispatchDelay(t *testing.T) {
	withFakeSingBox(t, "1.13.0")
	logger := log.New(io.Discard, "", 0)
	sup := newSupervisor(nil)
	if a := dispatch(msgFor(t, `{"id":"d","type":"delay","config":`+string(delayConfig("ok", nil))+`}`), sup, logger); !a.OK {
		t.Fatalf("ok: %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"d","type":"delay","config":`+string(delayConfig("timeout", nil))+`,"timeoutMs":500}`), sup, logger); a.OK {
		t.Fatalf("timeout: %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"d","type":"delay","timeoutMs":"x"}`), sup, logger); a.OK || !strings.Contains(a.Error, "decode delay") {
		t.Fatalf("decode: %+v", a)
	}
}
