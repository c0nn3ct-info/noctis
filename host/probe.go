package main

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// TCP reachability of a proxy endpoint, measured from outside the browser.
//
// Chrome's own fetch() is the wrong instrument for this: it follows the browser
// proxy settings like any other request, so with a tunnel up a probe of the
// server's own endpoint travels through that very server. It also cannot report
// a connect time on its own -- the extension can only time the whole attempt,
// TLS included, and a proxy endpoint answers nothing resembling HTTPS.
//
// So: dial, measure, hang up. No TLS and no HTTP. Whatever handshake the
// endpoint expects belongs to the protocol its core speaks, and waiting for it
// would fold somebody else's crypto into the number.
//
// The dial leaves through the same adapter the core's outbounds are bound to.
// Anything else measures the wrong machine: a system VPN in TUN mode owns the
// default route and answers the connect out of its own userspace stack, before
// a packet reaches the endpoint -- for a live server, a dead one and an address
// nobody routes to alike, each in a fraction of a millisecond.

const (
	probeDefaultTimeout = 5 * time.Second
	probeMaxTimeout     = 15 * time.Second

	// Under this, a dial is too fast to have crossed a network, and worth a
	// second question before it is believed.
	probeInstant = 3 * time.Millisecond

	// TEST-NET-1 (RFC 5737): reserved for documentation, routed by nobody and
	// answered by nothing. A connect that succeeds here was answered locally.
	probeCanaryAddr = "192.0.2.1:443"
	// A capturing stack answers in well under a millisecond; an honest one
	// answers not at all, and this is what that costs.
	probeCanaryTimeout = 400 * time.Millisecond
	// How long one verdict stands. A VPN comes up and goes down between probes,
	// and re-dialling per row would pay the timeout a dozen times over.
	probeCanaryTTL = 30 * time.Second
)

type probeArgs struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	// Optional caller budget in milliseconds, capped at probeMaxTimeout.
	TimeoutMs int `json:"timeoutMs"`
}

type probeResult struct {
	MS int64 `json:"ms"`
	// Which stack answered, for the log line the extension shows in diagnostics.
	Via string `json:"via"`
	// The adapter the dial left through, empty when the OS chose. A report
	// showing every row at one reading is a different bug depending on this.
	Iface string `json:"iface,omitempty"`
	// True when the local machine answered instead of the endpoint. There is no
	// reading in that case, and MS carries none: see probeCanaryAddr.
	Captured bool `json:"captured,omitempty"`
}

// probeDial is a seam for tests, never reassigned in production. `iface` names
// the adapter to leave through -- the same one the core binds its outbounds to.
var probeDial = func(ctx context.Context, iface, addr string) (net.Conn, error) {
	d, network := probeDialer(iface, addr)
	return d.DialContext(ctx, network, addr)
}

// probeDialer builds the dialer for one target: bound to the interface's own
// IPv4 when there is a usable one, and unbound otherwise. Binding the source
// address is what a scoped route follows, so it is enough to step out of a TUN
// without a per-platform socket option.
//
// The address family goes with it. A v6 target cannot be reached from a v4
// source, and failing a probe that used to work is worse than measuring it the
// way the OS would.
func probeDialer(iface, addr string) (*net.Dialer, string) {
	d := &net.Dialer{}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return d, "tcp"
	}
	if ip := net.ParseIP(host); ip != nil && ip.To4() == nil {
		return d, "tcp"
	}
	// Loopback is nobody's tunnel, and a LAN source address paired with it is
	// rejected outright by some kernels. A proxy on localhost is an ordinary
	// entry in the list.
	if isLoopbackHost(host) {
		return d, "tcp"
	}
	local := interfaceDialIP(iface)
	if local == nil {
		return d, "tcp"
	}
	d.LocalAddr = &net.TCPAddr{IP: local}
	return d, "tcp4"
}

// withoutSource drops the local address from a dial failure. Binding the dial
// is what puts it there, and from there it travels into a row's tooltip and
// into problem reports; the endpoint is what the message is about.
func withoutSource(err error) error {
	var op *net.OpError
	if errors.As(err, &op) && op.Source != nil {
		clone := *op
		clone.Source = nil
		return &clone
	}
	return err
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

type canaryVerdict struct {
	captured bool
	at       time.Time
}

var (
	canaryMu   sync.Mutex
	canarySeen = map[string]canaryVerdict{}
)

// stackCaptured is a seam for tests; production always gets canaryCaptured.
var stackCaptured = canaryCaptured

// canaryCaptured reports whether dials leaving `iface` are answered by the
// local machine rather than by whoever they are addressed to. Cached per
// adapter for probeCanaryTTL: the answer is a property of the route, not of the
// endpoint, and a shortlist of a dozen servers asks it a dozen times.
func canaryCaptured(iface string) bool {
	canaryMu.Lock()
	if v, ok := canarySeen[iface]; ok && time.Since(v.at) < probeCanaryTTL {
		canaryMu.Unlock()
		return v.captured
	}
	canaryMu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), probeCanaryTimeout)
	defer cancel()
	conn, err := probeDial(ctx, iface, probeCanaryAddr)
	captured := err == nil
	if conn != nil {
		_ = conn.Close()
	}

	canaryMu.Lock()
	canarySeen[iface] = canaryVerdict{captured: captured, at: time.Now()}
	canaryMu.Unlock()
	return captured
}

func probeTimeout(ms int) time.Duration {
	if ms <= 0 {
		return probeDefaultTimeout
	}
	d := time.Duration(ms) * time.Millisecond
	if d > probeMaxTimeout {
		return probeMaxTimeout
	}
	return d
}

// probeMS rounds a round trip to whole milliseconds, floored at one. A reading
// of zero is not a fast server, it is a number with nothing behind it, and the
// UI has no way to tell the two apart.
func probeMS(d time.Duration) int64 {
	ms := int64(math.Round(float64(d) / float64(time.Millisecond)))
	if ms < 1 {
		return 1
	}
	return ms
}

func doProbe(args probeArgs, iface string) (*probeResult, error) {
	host := strings.TrimSpace(args.Host)
	if host == "" {
		return nil, errors.New("probe: host is required")
	}
	if args.Port <= 0 || args.Port > 65535 {
		return nil, fmt.Errorf("probe: bad port %d", args.Port)
	}
	addr := net.JoinHostPort(host, strconv.Itoa(args.Port))

	ctx, cancel := context.WithTimeout(context.Background(), probeTimeout(args.TimeoutMs))
	defer cancel()

	start := time.Now()
	conn, err := probeDial(ctx, iface, addr)
	if err != nil {
		return nil, fmt.Errorf("probe: %w", withoutSource(err))
	}
	// Measured before the close: hanging up is our own bookkeeping, and a
	// half-closed socket can take its time.
	elapsed := time.Since(start)
	_ = conn.Close()

	// The canary costs a dial of its own, so it is only asked about a dial too
	// fast to have crossed a network. A real round trip answers for itself.
	if elapsed < probeInstant && stackCaptured(iface) {
		return &probeResult{Via: "direct", Iface: iface, Captured: true}, nil
	}
	return &probeResult{MS: probeMS(elapsed), Via: "direct", Iface: iface}, nil
}
