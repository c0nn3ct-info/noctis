package main

import (
	"context"
	"errors"
	"net"
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

	res, err := doProbe(probeArgs{Host: " 127.0.0.1 ", Port: port})
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
	probeDial = func(context.Context, string) (net.Conn, error) {
		return nil, errors.New("connect: connection refused")
	}
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443}); err == nil ||
		!strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("err = %v, want the dial failure", err)
	}
}

func TestProbeClosesTheSocketItOpened(t *testing.T) {
	conn := &scriptedConn{reader: strings.NewReader("")}
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string) (net.Conn, error) { return conn, nil }
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443}); err != nil {
		t.Fatalf("doProbe: %v", err)
	}
	if !conn.closed {
		t.Fatal("probe left the socket open")
	}
}

func TestProbeRejectsBadArguments(t *testing.T) {
	if _, err := doProbe(probeArgs{Host: "   ", Port: 443}); err == nil ||
		!strings.Contains(err.Error(), "host is required") {
		t.Fatalf("empty host err = %v", err)
	}
	for _, port := range []int{0, -1, 65536} {
		if _, err := doProbe(probeArgs{Host: "h.example", Port: port}); err == nil ||
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
	probeDial = func(ctx context.Context, _ string) (net.Conn, error) {
		d, ok := ctx.Deadline()
		if !ok {
			t.Fatal("dial context carries no deadline")
		}
		deadline = d
		return nil, errors.New("i/o timeout")
	}
	if _, err := doProbe(probeArgs{Host: "h.example", Port: 443, TimeoutMs: 300}); err == nil {
		t.Fatal("want the dial error")
	}
	if left := time.Until(deadline); left <= 0 || left > 300*time.Millisecond {
		t.Fatalf("deadline in %v, want it inside the 300ms budget", left)
	}
}
