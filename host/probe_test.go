package main

import (
	"context"
	"errors"
	"net"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestProbeReachesALiveListener(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			conn.Close()
		}
	}()
	_, portStr, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatalf("split: %v", err)
	}
	port, _ := strconv.Atoi(portStr)

	stubStackCaptured(t, false)
	res, err := doProbe(probeArgs{Host: " 127.0.0.1 ", Port: port}, "")
	if err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if res.MS < 0 {
		t.Fatalf("ms = %d, want a non-negative round trip", res.MS)
	}
	if res.Via != "direct" {
		t.Fatalf("via = %q, want direct", res.Via)
	}
}

func TestProbeReportsADialFailure(t *testing.T) {
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("connect: connection refused")
	}
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443}, ""); err == nil ||
		!strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("err = %v, want the dial failure", err)
	}
}

func TestProbeClosesTheSocketItOpened(t *testing.T) {
	stubStackCaptured(t, false)
	conn := &scriptedConn{reader: strings.NewReader("")}
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) { return conn, nil }
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443}, ""); err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if !conn.closed {
		t.Fatal("probe left the socket open")
	}
}

func TestProbeRejectsBadArguments(t *testing.T) {
	if _, err := doProbe(probeArgs{Host: "   ", Port: 443}, ""); err == nil ||
		!strings.Contains(err.Error(), "host is required") {
		t.Fatalf("empty host err = %v", err)
	}
	for _, port := range []int{0, -1, 65536} {
		if _, err := doProbe(probeArgs{Host: "h.example", Port: port}, ""); err == nil ||
			!strings.Contains(err.Error(), "bad port") {
			t.Fatalf("port %d err = %v, want a bad-port error", port, err)
		}
	}
}

func TestProbeTimeoutBudget(t *testing.T) {
	if got := probeTimeout(0); got != probeDefaultTimeout {
		t.Fatalf("probeTimeout(0) = %v, want the default", got)
	}
	if got := probeTimeout(-5); got != probeDefaultTimeout {
		t.Fatalf("probeTimeout(-5) = %v, want the default", got)
	}
	if got := probeTimeout(250); got != 250*time.Millisecond {
		t.Fatalf("probeTimeout(250) = %v, want 250ms", got)
	}
	if got := probeTimeout(60_000); got != probeMaxTimeout {
		t.Fatalf("probeTimeout(60000) = %v, want the cap", got)
	}
}

// The caller's budget must actually reach the dialer: a probe that ignored it
// would hang on a black-holed endpoint for as long as the OS allows.
func TestProbeCarriesTheDeadlineToTheDialer(t *testing.T) {
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	var deadline time.Time
	probeDial = func(ctx context.Context, _, _ string) (net.Conn, error) {
		d, ok := ctx.Deadline()
		if !ok {
			t.Fatal("dial context carries no deadline")
		}
		deadline = d
		return nil, errors.New("i/o timeout")
	}
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443, TimeoutMs: 300}, ""); err == nil {
		t.Fatal("want the dial error")
	}
	if left := time.Until(deadline); left <= 0 || left > 300*time.Millisecond {
		t.Fatalf("deadline in %v, want it inside the 300ms budget", left)
	}
}

// --- test seams -----------------------------------------------------------

// stubStackCaptured pins the canary's verdict, so a test that dials instantly
// (every one that fakes a socket does) never reaches the network for it.
func stubStackCaptured(t *testing.T, captured bool) {
	t.Helper()
	orig := stackCaptured
	t.Cleanup(func() { stackCaptured = orig })
	stackCaptured = func(string) bool { return captured }
}

func clearCanaryCache(t *testing.T) {
	t.Helper()
	reset := func() {
		canaryMu.Lock()
		canarySeen = map[string]canaryVerdict{}
		canaryMu.Unlock()
	}
	reset()
	t.Cleanup(reset)
}

// fakeInterfaces substitutes the adapter list with `name -> CIDRs`.
func fakeInterfaces(t *testing.T, byName map[string][]string) {
	t.Helper()
	origIfs, origAddrs := netInterfaces, interfaceAddrs
	t.Cleanup(func() { netInterfaces, interfaceAddrs = origIfs, origAddrs })

	names := make([]string, 0, len(byName))
	for n := range byName {
		names = append(names, n)
	}
	sort.Strings(names)
	ifs := make([]net.Interface, 0, len(names))
	byIndex := map[int]string{}
	for i, n := range names {
		ifs = append(ifs, net.Interface{Index: i + 1, Name: n, Flags: net.FlagUp})
		byIndex[i+1] = n
	}
	netInterfaces = func() ([]net.Interface, error) { return ifs, nil }
	interfaceAddrs = func(iface net.Interface) ([]net.Addr, error) {
		var out []net.Addr
		for _, cidr := range byName[byIndex[iface.Index]] {
			ip, n, err := net.ParseCIDR(cidr)
			if err != nil {
				t.Fatalf("bad cidr %q: %v", cidr, err)
			}
			n.IP = ip
			out = append(out, n)
		}
		return out, nil
	}
}

// --- binding --------------------------------------------------------------

// Without an interface to bind to, routing is the OS's business: no source
// address, no forced address family.
func TestProbeDialerLeavesTheOSAloneWithoutAnInterface(t *testing.T) {
	d, network := probeDialer("", "203.0.113.9:443")
	if d.LocalAddr != nil {
		t.Fatalf("LocalAddr = %v, want none", d.LocalAddr)
	}
	if network != "tcp" {
		t.Fatalf("network = %q, want tcp", network)
	}
}

// The core's outbounds are bound to a physical adapter to step around a
// TUN-mode VPN (see defaultPhysicalInterface). A probe dialing without that
// binding measures the VPN's own stack instead of the server: a TUN answers the
// connect itself, in well under a millisecond, for endpoints it never reached.
func TestProbeDialerBindsToTheInterfaceTheCoreUses(t *testing.T) {
	fakeInterfaces(t, map[string][]string{
		"en0":   {"192.168.1.80/24"},
		"utun9": {"198.18.0.1/16"},
	})
	d, network := probeDialer("en0", "203.0.113.9:443")
	local, ok := d.LocalAddr.(*net.TCPAddr)
	if !ok || !local.IP.Equal(net.ParseIP("192.168.1.80")) {
		t.Fatalf("LocalAddr = %v, want the en0 address", d.LocalAddr)
	}
	if network != "tcp4" {
		t.Fatalf("network = %q, want tcp4 beside an IPv4 source", network)
	}
}

// An IPv4 source address and an IPv6 target cannot meet. Binding one would turn
// a probe that used to work into a dial error, so a v6 literal keeps the OS's
// own choice of route.
func TestProbeDialerLeavesAnIPv6TargetUnbound(t *testing.T) {
	fakeInterfaces(t, map[string][]string{"en0": {"192.168.1.80/24"}})
	d, network := probeDialer("en0", "[2606:4700:4700::1111]:443")
	if d.LocalAddr != nil {
		t.Fatalf("LocalAddr = %v, want none for a v6 target", d.LocalAddr)
	}
	if network != "tcp" {
		t.Fatalf("network = %q, want tcp", network)
	}
}

// An adapter that holds nothing but an overlay address is not a way out (see
// overlayBlocks), and neither is one that is not there at all.
func TestProbeDialerIgnoresAnUnusableInterface(t *testing.T) {
	fakeInterfaces(t, map[string][]string{"ham0": {"25.7.7.7/8"}})
	for _, name := range []string{"ham0", "en5"} {
		d, network := probeDialer(name, "203.0.113.9:443")
		if d.LocalAddr != nil || network != "tcp" {
			t.Fatalf("%s: LocalAddr = %v, network = %q, want an unbound dial", name, d.LocalAddr, network)
		}
	}
}

// --- the canary -----------------------------------------------------------

// A stack that answers for an address nobody routes to is answering for our
// endpoints too, and every number it hands back is fiction.
func TestStackCapturedDialsAnUnroutableAddressOncePerWindow(t *testing.T) {
	clearCanaryCache(t)
	var dialed []string
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(_ context.Context, iface, addr string) (net.Conn, error) {
		dialed = append(dialed, iface+" "+addr)
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}
	if !canaryCaptured("en0") {
		t.Fatal("a connect to a reserved address must read as captured")
	}
	if !canaryCaptured("en0") {
		t.Fatal("the cached verdict must survive the window")
	}
	if len(dialed) != 1 || dialed[0] != "en0 "+probeCanaryAddr {
		t.Fatalf("dialed = %v, want one dial to the canary", dialed)
	}
}

// The honest answer: nothing on the way to a documentation address, so nothing
// answered it.
func TestStackCapturedClearsWhenNothingAnswers(t *testing.T) {
	clearCanaryCache(t)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("i/o timeout")
	}
	if canaryCaptured("en0") {
		t.Fatal("a dial that found nothing is not a captured stack")
	}
}

// Each adapter gets its own verdict: binding to a physical one is exactly what
// escapes a capture the unbound dial walks into.
func TestStackCapturedKeepsAVerdictPerInterface(t *testing.T) {
	clearCanaryCache(t)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(_ context.Context, iface, _ string) (net.Conn, error) {
		if iface == "" {
			return &scriptedConn{reader: strings.NewReader("")}, nil
		}
		return nil, errors.New("i/o timeout")
	}
	if !canaryCaptured("") {
		t.Fatal("the unbound dial is the captured one here")
	}
	if canaryCaptured("en0") {
		t.Fatal("the bound dial must not inherit the unbound verdict")
	}
}

// --- what doProbe reports -------------------------------------------------

func TestProbeReportsACapturedStackInsteadOfAReading(t *testing.T) {
	stubStackCaptured(t, true)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}
	res, err := doProbe(probeArgs{Host: "h.example", Port: 443}, "en0")
	if err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if !res.Captured {
		t.Fatal("an instant dial on a capturing stack must be reported as captured")
	}
	if res.MS != 0 {
		t.Fatalf("ms = %d, want no reading beside a captured verdict", res.MS)
	}
}

// The canary costs a dial of its own, so it is only worth asking after a dial
// too fast to have crossed a network. A real round trip answers for itself.
func TestProbeSkipsTheCanaryAfterAMeasurableRoundTrip(t *testing.T) {
	asked := false
	origCanary := stackCaptured
	t.Cleanup(func() { stackCaptured = origCanary })
	stackCaptured = func(string) bool { asked = true; return true }

	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		time.Sleep(probeInstant + 5*time.Millisecond)
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}
	res, err := doProbe(probeArgs{Host: "h.example", Port: 443}, "en0")
	if err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if asked {
		t.Fatal("the canary was asked about a dial that already crossed a network")
	}
	if res.Captured || res.MS < 1 {
		t.Fatalf("result = %+v, want a plain reading", res)
	}
}

// A sub-millisecond dial the canary clears is a real server very close by — a
// proxy on the LAN or on loopback. Truncating it to zero is what put a green
// "0ms" on rows a captured stack had never measured at all; the floor keeps a
// reading a reading, and keeps 0 out of the vocabulary.
func TestProbeFloorsASubMillisecondDialAtOne(t *testing.T) {
	stubStackCaptured(t, false)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}
	res, err := doProbe(probeArgs{Host: "h.example", Port: 443}, "")
	if err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if res.MS != 1 {
		t.Fatalf("ms = %d, want a sub-millisecond dial floored at 1", res.MS)
	}
}

// The interface is named in the answer: a problem report that shows every row
// at the same reading is a different bug depending on what the dial was bound
// to, and diagnostics cannot ask afterwards.
func TestProbeNamesTheInterfaceItDialledFrom(t *testing.T) {
	stubStackCaptured(t, false)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}
	res, err := doProbe(probeArgs{Host: "h.example", Port: 443}, "en0")
	if err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if res.Via != "direct" || res.Iface != "en0" {
		t.Fatalf("result = %+v, want via=direct iface=en0", res)
	}
}

// A loopback target needs no escaping — nothing tunnels 127.0.0.1 — and pairing
// it with a LAN source address is rejected outright by some kernels. A proxy
// listening on localhost is an ordinary entry in the list.
func TestProbeDialerLeavesALoopbackTargetUnbound(t *testing.T) {
	fakeInterfaces(t, map[string][]string{"en0": {"192.168.1.80/24"}})
	for _, addr := range []string{"127.0.0.1:1080", "localhost:1080", "[::1]:1080"} {
		d, network := probeDialer("en0", addr)
		if d.LocalAddr != nil || network != "tcp" {
			t.Fatalf("%s: LocalAddr = %v, network = %q, want an unbound dial", addr, d.LocalAddr, network)
		}
	}
}

// Binding the dial puts this machine's own address in the failure message,
// which travels straight into a row's tooltip and into problem reports. The
// endpoint is what the message is about.
func TestProbeDropsTheSourceAddressFromADialFailure(t *testing.T) {
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string, string) (net.Conn, error) {
		return nil, &net.OpError{
			Op:     "dial",
			Net:    "tcp4",
			Source: &net.TCPAddr{IP: net.ParseIP("192.168.1.80")},
			Addr:   &net.TCPAddr{IP: net.ParseIP("203.0.113.7"), Port: 443},
			Err:    errors.New("i/o timeout"),
		}
	}
	_, err := doProbe(probeArgs{Host: "203.0.113.7", Port: 443}, "en0")
	if err == nil {
		t.Fatal("want the dial failure")
	}
	if strings.Contains(err.Error(), "192.168.1.80") {
		t.Fatalf("err = %q, want no local address in it", err)
	}
	for _, want := range []string{"203.0.113.7:443", "i/o timeout"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to still name %q", err, want)
		}
	}
}
