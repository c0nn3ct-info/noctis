package main

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// HTTP GET on behalf of the extension. Chrome subjects the extension's own
// fetch() to CORS and to whatever the browser can reach, which breaks two
// real-world cases: panels that send no Access-Control-Allow-Origin, and
// subscription hosts that are only reachable through a tunnel. The helper sits
// outside the browser sandbox, so it has neither limit — and with a core
// running it can dial through the local SOCKS listener.

const (
	fetchTimeout   = 15 * time.Second
	maxFetchBytes  = 512 << 10 // fits a native-messaging frame (1 MiB) once JSON-escaped
	socksDialLimit = 8 * time.Second
)

type fetchArgs struct {
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
	ViaProxy bool              `json:"viaProxy"`
}

type fetchResult struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	// Set when the body is not valid UTF-8; Body is then base64.
	BodyBase64 bool   `json:"bodyBase64,omitempty"`
	FinalURL   string `json:"finalUrl,omitempty"`
	Via        string `json:"via"` // "direct" or "socks5:<port>"
}

func doFetch(args fetchArgs, socksPort int) (*fetchResult, error) {
	u, err := url.Parse(strings.TrimSpace(args.URL))
	if err != nil {
		return nil, fmt.Errorf("fetch: bad url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("fetch: unsupported scheme %q", u.Scheme)
	}

	transport := &http.Transport{
		Proxy:               nil, // never inherit the OS proxy: it may point back at us
		DisableCompression:  false,
		TLSHandshakeTimeout: 10 * time.Second,
	}
	via := "direct"
	if args.ViaProxy {
		if socksPort <= 0 {
			return nil, errors.New("fetch: viaProxy requested but no core is running")
		}
		proxyAddr := net.JoinHostPort("127.0.0.1", strconv.Itoa(socksPort))
		transport.DialContext = func(ctx context.Context, _, addr string) (net.Conn, error) {
			return socks5Dial(ctx, proxyAddr, addr)
		}
		via = "socks5:" + strconv.Itoa(socksPort)
	}

	ctx, cancel := context.WithTimeout(context.Background(), fetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	for k, v := range args.Headers {
		// Unlike Chrome's fetch(), we can set User-Agent — some panels gate
		// response headers on a client-shaped UA.
		req.Header.Set(k, v)
	}
	if req.Header.Get("Accept") == "" {
		req.Header.Set("Accept", "*/*")
	}

	client := &http.Client{Transport: transport, Timeout: fetchTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFetchBytes+1))
	if err != nil {
		return nil, fmt.Errorf("fetch: read body: %w", err)
	}
	if len(body) > maxFetchBytes {
		return nil, fmt.Errorf("fetch: response larger than %d bytes", maxFetchBytes)
	}

	headers := make(map[string]string, len(resp.Header))
	for k, vs := range resp.Header {
		headers[strings.ToLower(k)] = strings.Join(vs, ", ")
	}

	out := &fetchResult{
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    headers,
		FinalURL:   resp.Request.URL.String(),
		Via:        via,
	}
	if utf8.Valid(body) {
		out.Body = string(body)
	} else {
		out.Body = base64.StdEncoding.EncodeToString(body)
		out.BodyBase64 = true
	}
	return out, nil
}

// Minimal SOCKS5 CONNECT client (no auth) — enough to borrow the running
// core's tunnel without pulling in a dependency.
func socks5Dial(ctx context.Context, proxyAddr, target string) (net.Conn, error) {
	host, portStr, err := net.SplitHostPort(target)
	if err != nil {
		return nil, fmt.Errorf("socks5: bad target %q: %w", target, err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil || port <= 0 || port > 65535 {
		return nil, fmt.Errorf("socks5: bad port %q", portStr)
	}

	d := net.Dialer{Timeout: socksDialLimit}
	conn, err := d.DialContext(ctx, "tcp", proxyAddr)
	if err != nil {
		return nil, fmt.Errorf("socks5: dial %s: %w", proxyAddr, err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(socksDialLimit))
	}
	fail := func(e error) (net.Conn, error) {
		conn.Close()
		return nil, e
	}

	// Greeting: version 5, one method, "no authentication".
	if _, err := conn.Write([]byte{0x05, 0x01, 0x00}); err != nil {
		return fail(fmt.Errorf("socks5: greet: %w", err))
	}
	var greeting [2]byte
	if _, err := io.ReadFull(conn, greeting[:]); err != nil {
		return fail(fmt.Errorf("socks5: greet reply: %w", err))
	}
	if greeting[0] != 0x05 || greeting[1] != 0x00 {
		return fail(fmt.Errorf("socks5: unsupported auth method 0x%02x", greeting[1]))
	}

	// CONNECT request. Prefer the literal IP form when the target is an IP so
	// the core doesn't re-resolve it.
	req := []byte{0x05, 0x01, 0x00}
	if ip := net.ParseIP(host); ip != nil {
		if v4 := ip.To4(); v4 != nil {
			req = append(req, 0x01)
			req = append(req, v4...)
		} else {
			req = append(req, 0x04)
			req = append(req, ip.To16()...)
		}
	} else {
		if len(host) > 255 {
			return fail(errors.New("socks5: hostname too long"))
		}
		req = append(req, 0x03, byte(len(host)))
		req = append(req, host...)
	}
	req = binary.BigEndian.AppendUint16(req, uint16(port))
	if _, err := conn.Write(req); err != nil {
		return fail(fmt.Errorf("socks5: connect: %w", err))
	}

	var head [4]byte
	if _, err := io.ReadFull(conn, head[:]); err != nil {
		return fail(fmt.Errorf("socks5: connect reply: %w", err))
	}
	if head[1] != 0x00 {
		return fail(fmt.Errorf("socks5: request rejected (code 0x%02x)", head[1]))
	}
	// Consume the bound address so the stream starts at the payload.
	var skip int
	switch head[3] {
	case 0x01:
		skip = 4
	case 0x04:
		skip = 16
	case 0x03:
		var l [1]byte
		if _, err := io.ReadFull(conn, l[:]); err != nil {
			return fail(fmt.Errorf("socks5: reply addr: %w", err))
		}
		skip = int(l[0])
	default:
		return fail(fmt.Errorf("socks5: unknown address type 0x%02x", head[3]))
	}
	if _, err := io.CopyN(io.Discard, conn, int64(skip)+2); err != nil {
		return fail(fmt.Errorf("socks5: reply addr: %w", err))
	}

	// Hand the caller a clean connection: TLS and HTTP set their own deadlines.
	_ = conn.SetDeadline(time.Time{})
	return conn, nil
}
