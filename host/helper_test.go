package main

// Shared test infrastructure.
//
// TestMain doubles as a fake proxy-core binary (the helper-process pattern
// from the os/exec docs): tests generate a tiny shell wrapper that re-execs
// the test binary with NOCTIS_FAKE_CORE=1, and point SINGBOX_BIN/XRAY_BIN/
// MIHOMO_BIN at it. The fake answers version probes and, in run mode, binds
// the SOCKS port injected into its config file so waitReady succeeds.

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"
	"time"
)

func TestMain(m *testing.M) {
	if os.Getenv("NOCTIS_FAKE_CORE") == "1" {
		fakeCoreMain()
		return
	}
	os.Exit(m.Run())
}

// fakeCoreMain emulates a proxy core. Behavior is driven by the config file
// itself (extra keys pass through InjectPort untouched):
//
//	test_behavior: "" (bind socks port) | "nobind" (never bind) |
//	               "ignoreterm" (bind, ignore SIGTERM so stop() must SIGKILL) |
//	               "dieafterbind" (bind, then exit(7) on its own) |
//	               "exitbeforebind" (print test_log, exit(1) without binding)
//	test_log:      line printed to stdout and stderr after startup
// fakeTester emulates a `delay` tester instance: no inbound, a Clash API. The
// first outbound's test_delay picks the answer: "ok" (42ms), "timeout",
// "garbage" (not JSON), "zero" (a 200 with no delay), "exit" (log a fatal line
// and exit before the API is up), "noapi" (never serve).
func fakeTester(doc, exp map[string]any) {
	api, _ := exp["clash_api"].(map[string]any)
	addr, _ := api["external_controller"].(string)
	secret, _ := api["secret"].(string)
	behavior := ""
	if obs, ok := doc["outbounds"].([]any); ok && len(obs) > 0 {
		if m, ok := obs[0].(map[string]any); ok {
			behavior, _ = m["test_delay"].(string)
		}
	}
	switch behavior {
	case "exit":
		fmt.Fprintln(os.Stderr, "FATAL[0000] start service: tester refused")
		os.Exit(1)
	case "noapi":
		time.Sleep(30 * time.Second)
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+secret {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/version" {
			fmt.Fprint(w, `{"version":"fake"}`)
			return
		}
		switch behavior {
		case "timeout":
			fmt.Fprintln(os.Stderr, "ERROR[0003] outbound/hysteria2[proxy-out]: handshake timed out")
			w.WriteHeader(http.StatusGatewayTimeout)
			fmt.Fprint(w, `{"message":"Timeout"}`)
		case "refused":
			fmt.Fprintln(os.Stderr, "ERROR[0001] connection refused by peer")
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprint(w, `{"message":"An error occurred in the delay test"}`)
		case "garbage":
			fmt.Fprint(w, "not json")
		case "zero":
			fmt.Fprint(w, `{}`)
		default:
			fmt.Fprintf(w, `{"delay":42,"url":%q}`, r.URL.Query().Get("url"))
		}
	})
	_ = http.ListenAndServe(addr, mux)
}

func fakeCoreMain() {
	args := os.Args[1:]
	if len(args) > 0 && (args[0] == "version" || args[0] == "-v") {
		fmt.Printf("fake core version %s (test)\n", os.Getenv("NOCTIS_FAKE_VERSION"))
		return
	}
	var cfgPath string
	for i, a := range args {
		if (a == "-c" || a == "-f") && i+1 < len(args) {
			cfgPath = args[i+1]
		}
	}
	raw, err := os.ReadFile(cfgPath)
	if err != nil {
		os.Exit(3)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		os.Exit(3)
	}
	if exp, ok := doc["experimental"].(map[string]any); ok && doc["inbounds"] == nil {
		fakeTester(doc, exp)
		return
	}
	behavior, _ := doc["test_behavior"].(string)
	if behavior == "ignoreterm" {
		signal.Ignore(syscall.SIGTERM)
	}
	if line, _ := doc["test_log"].(string); line != "" {
		fmt.Fprintln(os.Stdout, line)
		fmt.Fprintln(os.Stderr, line)
	}
	if behavior == "exitbeforebind" {
		os.Exit(1)
	}
	if behavior != "nobind" {
		port := 0
		if ibs, ok := doc["inbounds"].([]any); ok {
			for _, ib := range ibs {
				if m, ok := ib.(map[string]any); ok {
					if p, ok := m["listen_port"].(float64); ok && p > 0 {
						port = int(p)
					}
				}
			}
		}
		if port == 0 {
			os.Exit(4)
		}
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err != nil {
			os.Exit(5)
		}
		defer ln.Close()
		go func() {
			for {
				c, err := ln.Accept()
				if err != nil {
					return
				}
				c.Close()
			}
		}()
		if behavior == "dieafterbind" {
			time.Sleep(300 * time.Millisecond)
			os.Exit(7)
		}
	}
	time.Sleep(30 * time.Second) // parked until SIGTERM / SIGKILL
}

// fakeCoreBin writes an executable shell wrapper: it answers a version probe
// itself, and re-execs the test binary in fake-core mode for everything else.
//
// The version answer stays in the script on purpose. Starting the test binary
// costs a process launch that instrumentation makes expensive — under -race it
// outran probeVersion's own 2s exec budget on a loaded machine, and the version
// then read as unknown. Nothing about answering `version` needs Go, and every
// test that probes one is faster for not paying it.
func fakeCoreBin(t *testing.T, version string) string {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable: %v", err)
	}
	path := filepath.Join(t.TempDir(), "fake-core")
	script := fmt.Sprintf(
		"#!/bin/sh\ncase \"$1\" in\nversion|-v) echo \"fake core version %s (test)\"; exit 0;;\nesac\nNOCTIS_FAKE_CORE=1 NOCTIS_FAKE_VERSION=%q exec %q \"$@\"\n",
		version, version, exe,
	)
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatalf("write fake core: %v", err)
	}
	return path
}

// stashVersionCache swaps in an empty version cache for the test and restores
// the previous one afterwards.
func stashVersionCache(t *testing.T) {
	t.Helper()
	versionCacheMu.Lock()
	saved := versionCache
	versionCache = map[string]*versionEntry{}
	versionCacheMu.Unlock()
	t.Cleanup(func() {
		versionCacheMu.Lock()
		versionCache = saved
		versionCacheMu.Unlock()
	})
}

func seedVersion(t *testing.T, id, v string) {
	t.Helper()
	done := make(chan struct{})
	close(done)
	versionCacheMu.Lock()
	versionCache[id] = &versionEntry{done: done, val: v}
	versionCacheMu.Unlock()
}

type testEvent struct {
	name    string
	payload any
}

// collectNotify returns a notifyFn that records events on a buffered channel.
func collectNotify() (notifyFn, chan testEvent) {
	ch := make(chan testEvent, 256)
	return func(name string, payload any) {
		select {
		case ch <- testEvent{name, payload}:
		default:
		}
	}, ch
}

func waitEvent(t *testing.T, ch chan testEvent, name string, timeout time.Duration) testEvent {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case ev := <-ch:
			if ev.name == name {
				return ev
			}
		case <-deadline:
			t.Fatalf("timed out waiting for %q event", name)
		}
	}
}

// waitLogLine waits for a log event whose payload line matches want. The
// helper emits its own log events (e.g. the picked bind interface), so a plain
// waitEvent(…, "log") can hand back a line the caller never asked about.
func waitLogLine(t *testing.T, ch chan testEvent, want string, timeout time.Duration) testEvent {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case ev := <-ch:
			if ev.name != "log" {
				continue
			}
			if m, ok := ev.payload.(map[string]any); ok && m["line"] == want {
				return ev
			}
		case <-deadline:
			t.Fatalf("timed out waiting for log line %q", want)
		}
	}
}

// socksConfig is a minimal sing-box style config the fake core understands.
func socksConfig(extra map[string]any) []byte {
	doc := map[string]any{
		"inbounds": []any{
			map[string]any{"type": "socks", "listen": "127.0.0.1", "listen_port": 0},
		},
		"outbounds": []any{
			map[string]any{"type": "vless", "tag": "proxy-out"},
		},
	}
	for k, v := range extra {
		doc[k] = v
	}
	raw, _ := json.Marshal(doc)
	return raw
}
