package main

import (
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestFreePort(t *testing.T) {
	p, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	if p <= 0 || p > 65535 {
		t.Fatalf("port out of range: %d", p)
	}
	// The port must be bindable right after.
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
	if err != nil {
		t.Fatalf("returned port not bindable: %v", err)
	}
	ln.Close()
}

// withNoNewFDs runs fn with RLIMIT_NOFILE lowered so far that no new file
// descriptor (and thus no new socket) can be created, then restores the limit.
func withNoNewFDs(t *testing.T, fn func()) {
	t.Helper()
	var lim syscall.Rlimit
	if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &lim); err != nil {
		t.Fatalf("getrlimit: %v", err)
	}
	low := lim
	low.Cur = 1 // only fd 0 would be permitted; it is taken, so opens fail
	if err := syscall.Setrlimit(syscall.RLIMIT_NOFILE, &low); err != nil {
		t.Fatalf("setrlimit: %v", err)
	}
	defer func() {
		if err := syscall.Setrlimit(syscall.RLIMIT_NOFILE, &lim); err != nil {
			t.Fatalf("restore rlimit: %v", err)
		}
	}()
	fn()
}

func TestFreePortListenError(t *testing.T) {
	withNoNewFDs(t, func() {
		if _, err := freePort(); err == nil {
			t.Error("want listen error with exhausted fd limit")
		}
	})
}

func TestWaitPort(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port
	if err := waitPort(port, 2*time.Second); err != nil {
		t.Fatalf("waitPort on live listener: %v", err)
	}

	closed, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	if err := waitPort(closed, 300*time.Millisecond); err == nil {
		t.Fatal("want timeout error for closed port")
	}
}

func TestCoreDataDir(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	dir, err := coreDataDir("sing-box")
	if err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		t.Fatalf("data dir not created: %v %v", info, err)
	}

	t.Setenv("TMPDIR", "/dev/null/nope")
	if _, err := coreDataDir("sing-box"); err == nil {
		t.Fatal("want error when temp dir is not creatable")
	}
}

func TestWriteTempConfig(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	path, err := writeTempConfig([]byte("payload"), "json")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(path, ".json") {
		t.Fatalf("path %q missing extension", path)
	}
	got, err := os.ReadFile(path)
	if err != nil || string(got) != "payload" {
		t.Fatalf("content %q err %v", got, err)
	}

	// MkdirAll failure.
	t.Setenv("TMPDIR", "/dev/null/nope")
	if _, err := writeTempConfig([]byte("x"), "json"); err == nil {
		t.Fatal("want mkdir error")
	}

	// WriteFile failure: noctis/ exists but is not writable.
	tmp2 := t.TempDir()
	noctis := filepath.Join(tmp2, "noctis")
	if err := os.MkdirAll(noctis, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(noctis, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(noctis, 0o700) })
	t.Setenv("TMPDIR", tmp2)
	if _, err := writeTempConfig([]byte("x"), "json"); err == nil {
		t.Fatal("want write error in read-only dir")
	}
}

func TestDefaultPhysicalInterface(t *testing.T) {
	// Error from the interface list.
	orig := netInterfaces
	t.Cleanup(func() { netInterfaces = orig })

	netInterfaces = func() ([]net.Interface, error) { return nil, errors.New("boom") }
	if got := defaultPhysicalInterface(); got != "" {
		t.Fatalf("want empty on error, got %q", got)
	}

	// Find a real interface with an IPv4 address to build synthetic lists.
	real, err := orig()
	if err != nil {
		t.Fatal(err)
	}
	var v4 *net.Interface
	for i := range real {
		iface := real[i]
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil && !ipn.IP.IsLoopback() {
				v4 = &iface
				break
			}
		}
		if v4 != nil {
			break
		}
	}
	if v4 == nil {
		t.Fatal("no interface with an IPv4 address on this machine; test requires basic connectivity")
	}

	down := net.Interface{Index: v4.Index, Name: "downif"}                                    // flags: not up
	loop := net.Interface{Index: v4.Index, Name: "lo9", Flags: net.FlagUp | net.FlagLoopback} // loopback
	tun := net.Interface{Index: v4.Index, Name: "utun9", Flags: net.FlagUp}                   // skipped prefix
	noV4 := net.Interface{Index: 999999, Name: "zz1", Flags: net.FlagUp}                      // no addresses
	renamed := *v4
	renamed.Name = "zz0" // same addrs (Addrs filters by Index), non-en0 name
	en0 := *v4
	en0.Name = "en0"

	// en0 wins even when a fallback candidate came first.
	netInterfaces = func() ([]net.Interface, error) {
		return []net.Interface{down, loop, tun, noV4, renamed, en0}, nil
	}
	if got := defaultPhysicalInterface(); got != "en0" {
		t.Fatalf("want en0, got %q", got)
	}

	// Without en0 the first IPv4-capable interface is the fallback.
	netInterfaces = func() ([]net.Interface, error) {
		return []net.Interface{down, loop, tun, noV4, renamed}, nil
	}
	if got := defaultPhysicalInterface(); got != "zz0" {
		t.Fatalf("want zz0 fallback, got %q", got)
	}

	// Nothing usable at all.
	netInterfaces = func() ([]net.Interface, error) {
		return []net.Interface{down, loop, tun, noV4}, nil
	}
	if got := defaultPhysicalInterface(); got != "" {
		t.Fatalf("want empty, got %q", got)
	}

	// Exercise the real system path once too (result is machine-dependent).
	netInterfaces = orig
	_ = defaultPhysicalInterface()
}

func TestSupervisorStartStop(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13")) // >=1.12: Clash API gets injected
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	port, err := sup.start(singBoxCore{}, socksConfig(map[string]any{"test_log": "fake-core up"}))
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if port <= 0 {
		t.Fatalf("port = %d", port)
	}
	if got := sup.currentPort(); got != port {
		t.Fatalf("currentPort = %d, want %d", got, port)
	}

	// The child really listens.
	c, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		t.Fatalf("dial child socks: %v", err)
	}
	c.Close()

	// Seeded snapshot: sing-box >=1.12 advertises full stats capabilities.
	snap := sup.statsSnapshot()
	if snap.Core != "sing-box" || !snap.Capabilities.Volume || snap.Counters == nil {
		t.Fatalf("snapshot = %+v", snap)
	}

	// Child log lines arrive as notify("log") via logPipe.
	waitLogLine(t, events, "fake-core up", 5*time.Second)

	// Second start while running is refused.
	if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil || !strings.Contains(err.Error(), "already running") {
		t.Fatalf("want already-running error, got %v", err)
	}

	sup.stop()
	exit := waitEvent(t, events, "child_exit", 5*time.Second)
	if m, ok := exit.payload.(map[string]any); !ok || m["port"] != port {
		t.Fatalf("child_exit payload = %#v", exit.payload)
	}
	if got := sup.currentPort(); got != 0 {
		t.Fatalf("currentPort after stop = %d", got)
	}
	if snap := sup.statsSnapshot(); snap.Core != "" || snap.Capabilities.Volume {
		t.Fatalf("snapshot after stop = %+v", snap)
	}
	// stop with nothing running is a no-op.
	sup.stop()
}

func TestSupervisorStartErrors(t *testing.T) {
	stashVersionCache(t)
	notify, _ := collectNotify()

	t.Run("locate", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", "")
		t.Setenv("PATH", t.TempDir())
		sup := newSupervisor(notify)
		if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil {
			t.Fatal("want locate error")
		}
	})

	t.Run("pick-port", func(t *testing.T) {
		// Locate succeeds (env + stat need no new fd) but freePort cannot bind.
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		sup := newSupervisor(notify)
		withNoNewFDs(t, func() {
			if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil || !strings.Contains(err.Error(), "pick port") {
				t.Errorf("want pick-port error, got %v", err)
			}
		})
	})

	t.Run("inject-port", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		sup := newSupervisor(notify)
		if _, err := sup.start(singBoxCore{}, []byte("not json")); err == nil {
			t.Fatal("want config error")
		}
	})

	t.Run("data-dir", func(t *testing.T) {
		seedVersion(t, "sing-box", "1.11.0") // skip Clash API path
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		t.Setenv("TMPDIR", "/dev/null/nope")
		sup := newSupervisor(notify)
		if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil {
			t.Fatal("want data dir error")
		}
	})

	t.Run("write-config", func(t *testing.T) {
		seedVersion(t, "sing-box", "1.11.0")
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		tmp := t.TempDir()
		// coreDataDir target exists already; noctis/ itself is read-only so the
		// config file cannot be written.
		if err := os.MkdirAll(filepath.Join(tmp, "noctis", "sing-box"), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(filepath.Join(tmp, "noctis"), 0o500); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = os.Chmod(filepath.Join(tmp, "noctis"), 0o700) })
		t.Setenv("TMPDIR", tmp)
		sup := newSupervisor(notify)
		if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil {
			t.Fatal("want temp config write error")
		}
	})

	t.Run("spawn", func(t *testing.T) {
		seedVersion(t, "sing-box", "1.11.0")
		notExec := filepath.Join(t.TempDir(), "not-executable")
		if err := os.WriteFile(notExec, []byte("#!/bin/sh\n"), 0o644); err != nil {
			t.Fatal(err)
		}
		t.Setenv("SINGBOX_BIN", notExec)
		sup := newSupervisor(notify)
		if _, err := sup.start(singBoxCore{}, socksConfig(nil)); err == nil || !strings.Contains(err.Error(), "spawn") {
			t.Fatalf("want spawn error, got %v", err)
		}
	})

	t.Run("waitport", func(t *testing.T) {
		seedVersion(t, "sing-box", "1.11.0")
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		sup := newSupervisor(notify)
		start := time.Now()
		_, err := sup.start(singBoxCore{}, socksConfig(map[string]any{"test_behavior": "nobind"}))
		if err == nil || !strings.Contains(err.Error(), "did not bind") {
			t.Fatalf("want bind timeout error, got %v (after %s)", err, time.Since(start))
		}
	})
}

func TestSupervisorStopKillsStubbornChild(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	if _, err := sup.start(singBoxCore{}, socksConfig(map[string]any{"test_behavior": "ignoreterm"})); err != nil {
		t.Fatalf("start: %v", err)
	}
	sup.stop()
	// SIGTERM is ignored; the 2s escalation must SIGKILL it.
	exit := waitEvent(t, events, "child_exit", 8*time.Second)
	m, ok := exit.payload.(map[string]any)
	if !ok {
		t.Fatalf("payload = %#v", exit.payload)
	}
	if exited, _ := m["exited"].(bool); exited {
		t.Fatalf("killed child should not report exited=true: %#v", m)
	}
	// Give the escalation goroutine time to run its final cancel().
	time.Sleep(200 * time.Millisecond)
}

// TestSupervisorChildDiesNaturally covers the supervise path where the child
// exits on its own (not via stop()), so the stats context is still armed and
// supervise itself must cancel it.
func TestSupervisorChildDiesNaturally(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	if _, err := sup.start(singBoxCore{}, socksConfig(map[string]any{"test_behavior": "dieafterbind"})); err != nil {
		t.Fatalf("start: %v", err)
	}
	exit := waitEvent(t, events, "child_exit", 5*time.Second)
	m, ok := exit.payload.(map[string]any)
	if !ok {
		t.Fatalf("payload = %#v", exit.payload)
	}
	if exited, _ := m["exited"].(bool); !exited {
		t.Fatalf("self-exiting child should report exited=true: %#v", m)
	}
	if errStr, _ := m["error"].(string); !strings.Contains(errStr, "exit status 7") {
		t.Fatalf("error = %q", m["error"])
	}
	if got := sup.currentPort(); got != 0 {
		t.Fatalf("currentPort after natural death = %d", got)
	}
}

func TestSupervisorReload(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	p1, err := sup.start(singBoxCore{}, socksConfig(nil))
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	p2, err := sup.reload(singBoxCore{}, socksConfig(nil))
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if p2 <= 0 {
		t.Fatalf("reload port = %d", p2)
	}
	waitEvent(t, events, "child_exit", 5*time.Second) // the old child died
	if got := sup.currentPort(); got != p2 {
		t.Fatalf("currentPort = %d, want %d", got, p2)
	}
	_ = p1
	sup.stop()
	waitEvent(t, events, "child_exit", 5*time.Second)

	// Reload with nothing running just starts.
	sup2 := newSupervisor(nil)
	p3, err := sup2.reload(singBoxCore{}, socksConfig(nil))
	if err != nil || p3 <= 0 {
		t.Fatalf("cold reload: %d %v", p3, err)
	}
	sup2.stop()

	// Reload error propagates from start.
	t.Setenv("SINGBOX_BIN", "")
	t.Setenv("PATH", t.TempDir())
	sup3 := newSupervisor(nil)
	if _, err := sup3.reload(singBoxCore{}, socksConfig(nil)); err == nil {
		t.Fatal("want reload error when core is unlocatable")
	}
}

func TestSuperviseNotOwned(t *testing.T) {
	notify, events := collectNotify()
	s := newSupervisor(notify)
	cmd := exec.Command("/usr/bin/true")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.cmd = exec.Command("/usr/bin/true") // different *exec.Cmd: not owned
	s.mu.Unlock()
	s.supervise(cmd, 1234)
	select {
	case ev := <-events:
		t.Fatalf("unexpected event for un-owned child: %+v", ev)
	default:
	}
	s.mu.Lock()
	s.cmd = nil
	s.mu.Unlock()
}

func TestStopWithNothingRunning(t *testing.T) {
	s := newSupervisor(nil)
	s.stop()
	if snap := s.statsSnapshot(); snap.Core != "" {
		t.Fatalf("snapshot = %+v", snap)
	}
}

func TestStatsSnapshotEmpty(t *testing.T) {
	s := newSupervisor(nil)
	snap := s.statsSnapshot()
	if snap.Capabilities.Volume || snap.Counters != nil {
		t.Fatalf("empty snapshot = %+v", snap)
	}
}

func TestErrString(t *testing.T) {
	if errString(nil) != "" {
		t.Fatal("nil error should be empty")
	}
	if errString(errors.New("boom")) != "boom" {
		t.Fatal("mismatch")
	}
}

func TestLogPipe(t *testing.T) {
	notify, events := collectNotify()
	p := newLogPipe(notify, "stdout")
	if n, err := p.Write([]byte("first\nsec")); err != nil || n != 9 {
		t.Fatalf("write: %d %v", n, err)
	}
	ev := waitEvent(t, events, "log", time.Second)
	if m := ev.payload.(map[string]any); m["line"] != "first" || m["stream"] != "stdout" {
		t.Fatalf("payload = %#v", ev.payload)
	}
	// Continuation + empty line.
	if _, err := p.Write([]byte("ond\n\n")); err != nil {
		t.Fatal(err)
	}
	if m := waitEvent(t, events, "log", time.Second).payload.(map[string]any); m["line"] != "second" {
		t.Fatalf("line = %v", m["line"])
	}
	if m := waitEvent(t, events, "log", time.Second).payload.(map[string]any); m["line"] != "" {
		t.Fatalf("line = %v", m["line"])
	}

	// nil notify still consumes input.
	quiet := newLogPipe(nil, "stderr")
	if n, err := quiet.Write([]byte("dropped\n")); err != nil || n != 8 {
		t.Fatalf("nil notify write: %d %v", n, err)
	}
}

func TestLocateBinary(t *testing.T) {
	emptyPath := t.TempDir()
	t.Setenv("PATH", emptyPath)

	// Not found anywhere.
	if _, err := locateBinary("NOCTIS_TEST_BIN", []string{"noctis-test-nonexistent"}); err == nil {
		t.Fatal("want not-found error")
	}
	// Env var points at a missing file: ignored, still not found.
	t.Setenv("NOCTIS_TEST_BIN", filepath.Join(emptyPath, "missing"))
	if _, err := locateBinary("NOCTIS_TEST_BIN", []string{"noctis-test-nonexistent"}); err == nil {
		t.Fatal("want not-found error with dangling env override")
	}
	// Env var points at a directory: ignored.
	t.Setenv("NOCTIS_TEST_BIN", emptyPath)
	if _, err := locateBinary("NOCTIS_TEST_BIN", []string{"noctis-test-nonexistent"}); err == nil {
		t.Fatal("want not-found error with dir env override")
	}
	// Env var points at a real file: wins.
	real := filepath.Join(t.TempDir(), "core-bin")
	if err := os.WriteFile(real, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("NOCTIS_TEST_BIN", real)
	if got, err := locateBinary("NOCTIS_TEST_BIN", []string{"noctis-test-nonexistent"}); err != nil || got != real {
		t.Fatalf("env override: %q %v", got, err)
	}
	t.Setenv("NOCTIS_TEST_BIN", "")

	// Beside the helper executable (the test binary's dir is writable).
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	exeDir := filepath.Dir(exe)
	beside := filepath.Join(exeDir, "noctis-test-beside")
	if err := os.WriteFile(beside, []byte("x"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Remove(beside) })
	if got, err := locateBinary("", []string{"noctis-test-beside"}); err != nil || got != beside {
		t.Fatalf("beside helper: %q %v", got, err)
	}

	// In embed/ beside the helper.
	embedDir := filepath.Join(exeDir, "embed")
	if err := os.MkdirAll(embedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	embedded := filepath.Join(embedDir, "noctis-test-embedded")
	if err := os.WriteFile(embedded, []byte("x"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(embedDir) })
	if got, err := locateBinary("", []string{"noctis-test-embedded"}); err != nil || got != embedded {
		t.Fatalf("embed dir: %q %v", got, err)
	}

	// On $PATH.
	pathDir := t.TempDir()
	onPath := filepath.Join(pathDir, "noctis-test-onpath")
	if err := os.WriteFile(onPath, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", pathDir)
	if got, err := locateBinary("", []string{"noctis-test-onpath"}); err != nil || got != onPath {
		t.Fatalf("PATH lookup: %q %v", got, err)
	}
}

func TestCoreVersionAndProbe(t *testing.T) {
	stashVersionCache(t)

	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13"))
	if v := coreVersion(singBoxCore{}); v != "1.13.13" {
		t.Fatalf("sing-box version = %q", v)
	}
	// Second call hits the cache (same value, no re-probe of a now-broken bin).
	t.Setenv("SINGBOX_BIN", "/nonexistent")
	if v := coreVersion(singBoxCore{}); v != "1.13.13" {
		t.Fatalf("cached version = %q", v)
	}

	// mihomo probes with -v.
	t.Setenv("MIHOMO_BIN", fakeCoreBin(t, "1.19.2"))
	if v := coreVersion(mihomoCore{}); v != "1.19.2" {
		t.Fatalf("mihomo version = %q", v)
	}

	// Unlocatable binary: empty version.
	t.Setenv("XRAY_BIN", "")
	t.Setenv("PATH", t.TempDir())
	if v := probeVersion(xrayCore{}); v != "" {
		t.Fatalf("want empty version, got %q", v)
	}
}

func TestProbeVersionNoSemver(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "")) // prints no semver
	if v := probeVersion(singBoxCore{}); v != "" {
		t.Fatalf("want empty version for output without semver, got %q", v)
	}
}

func TestInstalledCoresWithVersions(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13"))
	t.Setenv("XRAY_BIN", fakeCoreBin(t, "25.6.8"))
	t.Setenv("MIHOMO_BIN", fakeCoreBin(t, "1.19.2"))

	cs := installedCores()
	if len(cs) != 3 {
		t.Fatalf("len = %d", len(cs))
	}
	want := map[string]string{"sing-box": "1.13.13", "xray": "25.6.8", "mihomo": "1.19.2"}
	for _, c := range cs {
		id := c["id"].(string)
		if c["available"] != true {
			t.Fatalf("%s not available: %v", id, c)
		}
		if c["version"] != want[id] {
			t.Fatalf("%s version = %v, want %s", id, c["version"], want[id])
		}
	}
}

func TestInstalledCoresSkipsUnregistered(t *testing.T) {
	saved := cores["mihomo"]
	delete(cores, "mihomo")
	t.Cleanup(func() { cores["mihomo"] = saved })
	cs := installedCores()
	if len(cs) != 2 {
		t.Fatalf("len = %d, want 2 with mihomo unregistered", len(cs))
	}
}
