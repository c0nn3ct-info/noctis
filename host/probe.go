package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
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

const (
	probeDefaultTimeout = 5 * time.Second
	probeMaxTimeout     = 15 * time.Second
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
}

// probeDial is a seam for tests, never reassigned in production.
var probeDial = func(ctx context.Context, addr string) (net.Conn, error) {
	var d net.Dialer
	return d.DialContext(ctx, "tcp", addr)
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

func doProbe(args probeArgs) (*probeResult, error) {
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
	conn, err := probeDial(ctx, addr)
	if err != nil {
		return nil, fmt.Errorf("probe: %w", err)
	}
	// Measured before the close: hanging up is our own bookkeeping, and a
	// half-closed socket can take its time.
	elapsed := time.Since(start)
	_ = conn.Close()
	return &probeResult{MS: elapsed.Milliseconds(), Via: "direct"}, nil
}
