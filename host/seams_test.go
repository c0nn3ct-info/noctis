package main

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"
)

// The guards exercised here are all reachable in production but not on demand:
// a socket that refuses a write, an interface that disappears mid-enumeration,
// a listener that reports a non-TCP address. Each is driven through the seam
// its production code path already goes through.

// --- fakes ---------------------------------------------------------------

// scriptedConn is a net.Conn whose writes fail on a chosen call number and
// whose reads replay a canned script.
type scriptedConn struct {
	writes   int
	failOn   int // 1-based write call that returns writeErr; 0 never fails
	writeErr error
	reader   *strings.Reader
	closed   bool
}

func (c *scriptedConn) Read(b []byte) (int, error) { return c.reader.Read(b) }

func (c *scriptedConn) Write(b []byte) (int, error) {
	c.writes++
	if c.writes == c.failOn {
		return 0, c.writeErr
	}
	return len(b), nil
}

func (c *scriptedConn) Close() error                     { c.closed = true; return nil }
func (c *scriptedConn) LocalAddr() net.Addr              { return &net.TCPAddr{} }
func (c *scriptedConn) RemoteAddr() net.Addr             { return &net.TCPAddr{} }
func (c *scriptedConn) SetDeadline(time.Time) error      { return nil }
func (c *scriptedConn) SetReadDeadline(time.Time) error  { return nil }
func (c *scriptedConn) SetWriteDeadline(time.Time) error { return nil }

// unixAddrListener reports a non-TCP address, which net.Listen("tcp", …) never
// does — freePort's type assertion exists for exactly this shape.
type unixAddrListener struct{ net.Listener }

func (unixAddrListener) Addr() net.Addr { return &net.UnixAddr{Name: "/tmp/x", Net: "unix"} }

// withDialProxy points socks5Dial at a fixed connection for the duration of fn.
func withDialProxy(t *testing.T, conn net.Conn) {
	t.Helper()
	orig := dialProxy
	t.Cleanup(func() { dialProxy = orig })
	dialProxy = func(context.Context, string) (net.Conn, error) { return conn, nil }
}

// --- fetch.go ------------------------------------------------------------

func TestSocks5DialGreetWriteError(t *testing.T) {
	conn := &scriptedConn{failOn: 1, writeErr: errors.New("broken pipe"), reader: strings.NewReader("")}
	withDialProxy(t, conn)

	_, err := socks5Dial(context.Background(), "127.0.0.1:1080", "example.com:443")
	if err == nil || !strings.Contains(err.Error(), "socks5: greet:") {
		t.Fatalf("want greet write error, got %v", err)
	}
	if !conn.closed {
		t.Error("failed dial must close the connection")
	}
}

func TestSocks5DialConnectWriteError(t *testing.T) {
	// Greeting succeeds (version 5, "no auth"), the CONNECT write then fails.
	conn := &scriptedConn{
		failOn:   2,
		writeErr: errors.New("broken pipe"),
		reader:   strings.NewReader("\x05\x00"),
	}
	withDialProxy(t, conn)

	_, err := socks5Dial(context.Background(), "127.0.0.1:1080", "example.com:443")
	if err == nil || !strings.Contains(err.Error(), "socks5: connect:") {
		t.Fatalf("want connect write error, got %v", err)
	}
	if !conn.closed {
		t.Error("failed dial must close the connection")
	}
}

func TestDoFetchRequestBuildError(t *testing.T) {
	orig := newRequest
	t.Cleanup(func() { newRequest = orig })
	newRequest = func(context.Context, string, string, io.Reader) (*http.Request, error) {
		return nil, errors.New("no request for you")
	}

	if _, err := doFetch(fetchArgs{URL: "https://example.com/"}, 0); err == nil ||
		!strings.Contains(err.Error(), "no request for you") {
		t.Fatalf("want request build error, got %v", err)
	}
}

// --- core.go -------------------------------------------------------------

func TestFreePortNonTCPListener(t *testing.T) {
	orig := netListen
	t.Cleanup(func() { netListen = orig })
	netListen = func(network, address string) (net.Listener, error) {
		l, err := orig(network, address)
		if err != nil {
			return nil, err
		}
		return unixAddrListener{l}, nil
	}

	if _, err := freePort(); err == nil || !strings.Contains(err.Error(), "unexpected listener address") {
		t.Fatalf("want unexpected-address error, got %v", err)
	}
}

func TestDefaultPhysicalInterfaceSkipsUnreadableAndNonIPNet(t *testing.T) {
	origIfs, origAddrs := netInterfaces, interfaceAddrs
	t.Cleanup(func() { netInterfaces, interfaceAddrs = origIfs, origAddrs })

	netInterfaces = func() ([]net.Interface, error) {
		return []net.Interface{
			{Name: "en0", Flags: net.FlagUp},
			{Name: "en1", Flags: net.FlagUp},
			{Name: "en2", Flags: net.FlagUp},
		}, nil
	}
	interfaceAddrs = func(iface net.Interface) ([]net.Addr, error) {
		switch iface.Name {
		case "en0":
			// Vanished between the listing and the query.
			return nil, errors.New("no such interface")
		case "en1":
			// Not an *net.IPNet — nothing to read an IPv4 address out of.
			return []net.Addr{&net.IPAddr{IP: net.ParseIP("192.0.2.7")}}, nil
		default:
			return []net.Addr{&net.IPNet{IP: net.ParseIP("192.0.2.9"), Mask: net.CIDRMask(24, 32)}}, nil
		}
	}

	if got := defaultPhysicalInterface(); got != "en2" {
		t.Fatalf("want en2 (the only interface with a readable IPv4), got %q", got)
	}
}

// --- stats.go ------------------------------------------------------------

func TestRandomSecretReadError(t *testing.T) {
	orig := randRead
	t.Cleanup(func() { randRead = orig })
	randRead = func([]byte) (int, error) { return 0, errors.New("entropy pool drained") }

	if _, err := randomSecret(); err == nil || !strings.Contains(err.Error(), "entropy pool drained") {
		t.Fatalf("want the rand error surfaced, got %v", err)
	}
}
