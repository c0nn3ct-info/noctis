package main

import (
	"bytes"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
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

// mihomo only reads geo databases from the directory passed to `-d`; the
// installers put them beside the helper. Without the copy it downloads them at
// startup, over the connection the user has not got yet.
func TestCoreDataDirProvisionsGeoAssets(t *testing.T) {
	installDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(installDir, "geoip.dat"), []byte("ip-v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(installDir, "geosite.dat"), []byte("site-v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	stubExecutable(t, filepath.Join(installDir, "noctis-host"))
	t.Setenv("TMPDIR", t.TempDir())

	dir, err := coreDataDir("mihomo")
	if err != nil {
		t.Fatal(err)
	}
	for name, want := range map[string]string{"geoip.dat": "ip-v1", "geosite.dat": "site-v1"} {
		got, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("%s not provisioned: %v", name, err)
		}
		if string(got) != want {
			t.Fatalf("%s = %q, want %q", name, got, want)
		}
	}

	// sing-box has no use for them and xray reads them beside its own binary;
	// neither should pay for a copy.
	sbDir, err := coreDataDir("sing-box")
	if err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(sbDir); len(entries) != 0 {
		t.Fatalf("sing-box data dir got %d files", len(entries))
	}

	// A newer copy beside the helper replaces the one already in the data dir.
	newer := []byte("ip-v2-longer")
	if err := os.WriteFile(filepath.Join(installDir, "geoip.dat"), newer, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := coreDataDir("mihomo"); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(filepath.Join(dir, "geoip.dat")); string(got) != string(newer) {
		t.Fatalf("stale copy kept: %q", got)
	}
}

func TestProvisionGeoAssetsTolerantOfMissingSources(t *testing.T) {
	stubExecutable(t, filepath.Join(t.TempDir(), "noctis-host"))
	dir := t.TempDir()
	if err := provisionGeoAssets(dir); err != nil {
		t.Fatalf("no assets shipped is not an error: %v", err)
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("wrote %d files with nothing to copy", len(entries))
	}

	// An unreadable helper path is reported rather than silently skipped.
	osExecutable = func() (string, error) { return "", errors.New("no exe") }
	if err := provisionGeoAssets(dir); err == nil {
		t.Fatal("want the executable lookup error to surface")
	}
}

// stubExecutable points "beside the helper" at a directory the test controls.
func stubExecutable(t *testing.T, path string) {
	t.Helper()
	prev := osExecutable
	osExecutable = func() (string, error) { return path, nil }
	t.Cleanup(func() { osExecutable = prev })
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

// ifaceAddr builds an *net.IPNet addr the way net.Interface.Addrs reports one.
func ifaceAddr(t *testing.T, cidr string) net.Addr {
	t.Helper()
	ip, n, err := net.ParseCIDR(cidr)
	if err != nil {
		t.Fatalf("parse %s: %v", cidr, err)
	}
	return &net.IPNet{IP: ip, Mask: n.Mask}
}

// stubInterfaces points the interface seams at a synthetic adapter list, keyed
// by index for the addresses, plus a fixed default-route address.
func stubInterfaces(t *testing.T, ifs []net.Interface, addrs map[int][]net.Addr, route net.IP) {
	t.Helper()
	origIfs, origAddrs, origRoute := netInterfaces, interfaceAddrs, routeLocalIP
	t.Cleanup(func() {
		netInterfaces, interfaceAddrs, routeLocalIP = origIfs, origAddrs, origRoute
	})
	netInterfaces = func() ([]net.Interface, error) { return ifs, nil }
	interfaceAddrs = func(i net.Interface) ([]net.Addr, error) { return addrs[i.Index], nil }
	routeLocalIP = func() net.IP { return route }
}

func TestDefaultPhysicalInterfaceSkipsVirtualAdapters(t *testing.T) {
	// The shape a Windows machine running Hamachi reports: the LAN emulator is
	// listed first and used to win the pick, which bound every outbound dial to
	// a 25.x.x.x address that goes nowhere.
	ifs := []net.Interface{
		{Index: 1, Name: "Hamachi", Flags: net.FlagUp},
		{Index: 2, Name: "vEthernet (WSL)", Flags: net.FlagUp},
		{Index: 3, Name: "Ethernet", Flags: net.FlagUp},
	}
	stubInterfaces(t, ifs, map[int][]net.Addr{
		1: {ifaceAddr(t, "25.44.1.9/8")},
		2: {ifaceAddr(t, "172.28.0.1/20")},
		3: {ifaceAddr(t, "192.168.1.24/24")},
	}, nil)

	if got := defaultPhysicalInterface(); got != "Ethernet" {
		t.Fatalf("bind interface = %q, want Ethernet", got)
	}
}

func TestDefaultPhysicalInterfaceDropsOverlayOnlyAddresses(t *testing.T) {
	// An innocuous name over a CGNAT-only address is still not a way out, and
	// binding to it is worse than leaving the OS to route.
	ifs := []net.Interface{{Index: 1, Name: "Ethernet 2", Flags: net.FlagUp}}
	stubInterfaces(t, ifs, map[int][]net.Addr{
		1: {ifaceAddr(t, "100.100.5.5/10")},
	}, nil)

	if got := defaultPhysicalInterface(); got != "" {
		t.Fatalf("bind interface = %q, want empty", got)
	}
}

func TestDefaultPhysicalInterfacePrefersTheDefaultRoute(t *testing.T) {
	ifs := []net.Interface{
		{Index: 1, Name: "Ethernet", Flags: net.FlagUp},
		{Index: 2, Name: "Wi-Fi", Flags: net.FlagUp},
	}
	stubInterfaces(t, ifs, map[int][]net.Addr{
		1: {ifaceAddr(t, "192.168.1.24/24")},
		2: {ifaceAddr(t, "10.0.5.7/24")},
	}, net.ParseIP("10.0.5.7"))

	if got := defaultPhysicalInterface(); got != "Wi-Fi" {
		t.Fatalf("bind interface = %q, want Wi-Fi (it owns the route)", got)
	}
}

func TestListInterfacesMarksRecommendation(t *testing.T) {
	ifs := []net.Interface{
		{Index: 1, Name: "Hamachi", Flags: net.FlagUp},
		{Index: 2, Name: "Ethernet", Flags: net.FlagUp},
		{Index: 3, Name: "utun4", Flags: net.FlagUp},
		{Index: 4, Name: "Ethernet 3", Flags: net.FlagUp}, // no addresses: not offered
	}
	stubInterfaces(t, ifs, map[int][]net.Addr{
		1: {ifaceAddr(t, "25.44.1.9/8")},
		2: {ifaceAddr(t, "192.168.1.24/24")},
		3: {ifaceAddr(t, "10.8.0.2/24")},
	}, nil)

	got := listInterfaces()
	if len(got) != 3 {
		t.Fatalf("listInterfaces() = %+v, want 3 entries", got)
	}
	want := map[string]bool{"Hamachi": false, "Ethernet": true, "utun4": false}
	for _, i := range got {
		rec, ok := want[i.Name]
		if !ok {
			t.Fatalf("unexpected interface %q", i.Name)
		}
		if i.Recommended != rec {
			t.Fatalf("%s recommended = %v, want %v", i.Name, i.Recommended, rec)
		}
	}
	if got[0].Addr != "25.44.1.9" {
		t.Fatalf("Hamachi addr = %q", got[0].Addr)
	}
}

func TestResolveBindInterface(t *testing.T) {
	ifs := []net.Interface{{Index: 1, Name: "Ethernet", Flags: net.FlagUp}}
	stubInterfaces(t, ifs, map[int][]net.Addr{1: {ifaceAddr(t, "192.168.1.24/24")}}, nil)

	for _, c := range []struct{ pref, want string }{
		{"", "Ethernet"},       // absent: auto
		{"auto", "Ethernet"},   // auto
		{"none", ""},           // user opted out of binding
		{"Wi-Fi", "Wi-Fi"},     // explicit override, taken verbatim
		{"Hamachi", "Hamachi"}, // even one auto would never pick
	} {
		if got := resolveBindInterface(c.pref); got != c.want {
			t.Fatalf("resolveBindInterface(%q) = %q, want %q", c.pref, got, c.want)
		}
	}
}

func TestSupervisorRemembersBindPreference(t *testing.T) {
	ifs := []net.Interface{{Index: 1, Name: "Ethernet", Flags: net.FlagUp}}
	stubInterfaces(t, ifs, map[int][]net.Addr{1: {ifaceAddr(t, "192.168.1.24/24")}}, nil)

	sup := newSupervisor(nil)
	if got := sup.boundInterface(); got != "Ethernet" {
		t.Fatalf("default preference resolved to %q, want Ethernet", got)
	}
	sup.setBindPref("none")
	if got := sup.boundInterface(); got != "" {
		t.Fatalf("none resolved to %q, want empty", got)
	}
	sup.setBindPref("Wi-Fi")
	if got := sup.boundInterface(); got != "Wi-Fi" {
		t.Fatalf("override resolved to %q", got)
	}
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

// stop() used to poll cmd.ProcessState to decide whether the child still needed
// a SIGKILL, which is a read of state that cmd.Wait() writes from the supervise
// goroutine - a data race, and the shape below is what tripped it: a child that
// exits on its own while several stops escalate against it. Run under -race.
func TestSupervisorStopRacesChildExit(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	notify, events := collectNotify()
	sup := newSupervisor(notify)
	// Short grace so the escalation goroutine reaches its verdict inside the
	// test rather than after it: the old read happened only on that path, and a
	// test that returned first never gave -race anything to see.
	saved := stopGrace
	stopGrace = 50 * time.Millisecond
	t.Cleanup(func() { stopGrace = saved })

	if _, err := sup.start(singBoxCore{}, socksConfig(map[string]any{"test_behavior": "dieafterbind"})); err != nil {
		t.Fatalf("start: %v", err)
	}

	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sup.stop()
		}()
	}
	wg.Wait()

	waitEvent(t, events, "child_exit", 5*time.Second)
	// Outlast the escalation so its goroutine has run before the test ends.
	time.Sleep(4 * stopGrace)
	if got := sup.currentPort(); got != 0 {
		t.Fatalf("currentPort after stop = %d", got)
	}
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
	s.supervise(cmd, 1234, make(chan struct{}))
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

// A core that writes without newlines must not grow the buffer without bound,
// and no single line may exceed what one native-messaging frame can carry.
func TestLogPipeCapsRunawayLine(t *testing.T) {
	notify, events := collectNotify()
	p := newLogPipe(notify, "stdout")

	if _, err := p.Write(bytes.Repeat([]byte("x"), maxLogLine+10)); err != nil {
		t.Fatal(err)
	}
	ev := waitEvent(t, events, "log", time.Second)
	line, _ := ev.payload.(map[string]any)["line"].(string)
	if len(line) != maxLogLine {
		t.Fatalf("emitted line of %d bytes, want the %d-byte cap", len(line), maxLogLine)
	}
	if p.buf.Len() != 10 {
		t.Fatalf("buffered %d bytes after the cut, want the 10-byte remainder", p.buf.Len())
	}

	// A newline further away than the cap is cut too, rather than shipped whole.
	if _, err := p.Write(append(bytes.Repeat([]byte("y"), maxLogLine), '\n')); err != nil {
		t.Fatal(err)
	}
	first, _ := waitEvent(t, events, "log", time.Second).payload.(map[string]any)["line"].(string)
	if len(first) != maxLogLine {
		t.Fatalf("first chunk = %d bytes", len(first))
	}
	rest, _ := waitEvent(t, events, "log", time.Second).payload.(map[string]any)["line"].(string)
	if len(rest) != 10 {
		t.Fatalf("tail chunk = %d bytes, want 10", len(rest))
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

	// Join the probes first. installedCores only waits versionBudget for one it
	// does not already have, and a version that misses that budget is reported
	// as unknown by design — correct behaviour that would fail a test about
	// reporting a version. Late in a -race run the process carries enough
	// threads to make three fork+execs cost that much. coreVersion has no such
	// budget, and production warms the same cache at startup for the same
	// reason; the budget's own expiry is covered by
	// TestInstalledCoresGivesUpOnSlowProbe.
	for _, c := range []Core{singBoxCore{}, xrayCore{}, mihomoCore{}} {
		if v := coreVersion(c); v == "" {
			t.Fatalf("%s probe reported no version", c.ID())
		}
	}

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

func TestInstalledCoresGivesUpOnSlowProbe(t *testing.T) {
	stashVersionCache(t)
	saved := versionBudget
	versionBudget = 20 * time.Millisecond
	t.Cleanup(func() { versionBudget = saved })

	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13"))
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())

	// A probe that never finishes, standing in for a cold exec of a core binary.
	// The ack still has to come back — with availability, and no version.
	versionCacheMu.Lock()
	versionCache["sing-box"] = &versionEntry{done: make(chan struct{})}
	versionCacheMu.Unlock()

	start := time.Now()
	cs := installedCores()
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("installedCores waited %v for an in-flight probe", elapsed)
	}
	if cs[0]["id"] != "sing-box" || cs[0]["available"] != true {
		t.Fatalf("sing-box entry = %v", cs[0])
	}
	if _, ok := cs[0]["version"]; ok {
		t.Fatalf("want no version while the probe is in flight: %v", cs[0])
	}
}

func TestWarmVersionsProbesEveryCoreOnce(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13"))

	warmVersions()
	versionCacheMu.Lock()
	n := len(versionCache)
	versionCacheMu.Unlock()
	if n != len(coreOrder) {
		t.Fatalf("warmVersions started %d probes, want %d", n, len(coreOrder))
	}
	// coreVersion joins the warm-up's probe instead of starting a second one.
	if v := coreVersion(singBoxCore{}); v != "1.13.13" {
		t.Fatalf("version after warm-up = %q", v)
	}
	// And the answer is now cached: a broken binary can't change it.
	t.Setenv("SINGBOX_BIN", "/nonexistent")
	if v := coreVersion(singBoxCore{}); v != "1.13.13" {
		t.Fatalf("cached version = %q", v)
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
