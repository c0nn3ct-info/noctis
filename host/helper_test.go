package main

// Shared test infrastructure.
//
// TestMain doubles as a fake proxy-core binary (the helper-process pattern
// from the os/exec docs): tests generate a tiny shell wrapper that re-execs
// the test binary with NOCTIS_FAKE_CORE=1, and point SINGBOX_BIN/XRAY_BIN/
// MIHOMO_BIN at it. The fake answers version probes and, in run mode, binds
// the SOCKS port injected into its config file so waitPort succeeds.

import (
	"encoding/json"
	"fmt"
	"net"
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
//	               "dieafterbind" (bind, then exit(7) on its own)
//	test_log:      line printed to stdout and stderr after startup
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
	behavior, _ := doc["test_behavior"].(string)
	if behavior == "ignoreterm" {
		signal.Ignore(syscall.SIGTERM)
	}
	if line, _ := doc["test_log"].(string); line != "" {
		fmt.Fprintln(os.Stdout, line)
		fmt.Fprintln(os.Stderr, line)
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
