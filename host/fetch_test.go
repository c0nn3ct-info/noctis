package main

import (
	"encoding/binary"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestFetchDirect(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Profile-Title", "Test Profile")
		w.Header().Set("Subscription-Userinfo", "upload=0; download=0; total=0; expire=0")
		if got := r.Header.Get("X-Hwid"); got != "device-1" {
			t.Errorf("x-hwid header = %q, want device-1", got)
		}
		if got := r.Header.Get("User-Agent"); got != "Happ/4.9.0/macos/device-1" {
			t.Errorf("user-agent = %q, want the injected one", got)
		}
		io.WriteString(w, "vless://uuid@h.example:443#A\n")
	}))
	defer srv.Close()

	res, err := doFetch(fetchArgs{
		URL: srv.URL,
		Headers: map[string]string{
			"x-hwid":     "device-1",
			"User-Agent": "Happ/4.9.0/macos/device-1",
		},
	}, 0)
	if err != nil {
		t.Fatalf("doFetch: %v", err)
	}
	if res.Status != 200 {
		t.Fatalf("status = %d, want 200", res.Status)
	}
	if !strings.HasPrefix(res.Body, "vless://") {
		t.Fatalf("body = %q", res.Body)
	}
	// Headers must arrive lowercased so the extension can read them like a
	// fetch() Headers object.
	if res.Headers["profile-title"] != "Test Profile" {
		t.Fatalf("profile-title = %q", res.Headers["profile-title"])
	}
	if res.Via != "direct" {
		t.Fatalf("via = %q, want direct", res.Via)
	}
}

func TestFetchRejectsNonHttpScheme(t *testing.T) {
	if _, err := doFetch(fetchArgs{URL: "file:///etc/passwd"}, 0); err == nil {
		t.Fatal("expected an error for file:// URL")
	}
}

func TestFetchViaProxyWithoutCore(t *testing.T) {
	if _, err := doFetch(fetchArgs{URL: "https://example.com", ViaProxy: true}, 0); err == nil {
		t.Fatal("expected an error when no core is running")
	}
}

func TestFetchViaSocks5(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		io.WriteString(w, "through the tunnel")
	}))
	defer srv.Close()

	port := startFakeSocks5(t)
	res, err := doFetch(fetchArgs{URL: srv.URL, ViaProxy: true}, port)
	if err != nil {
		t.Fatalf("doFetch: %v", err)
	}
	if res.Body != "through the tunnel" {
		t.Fatalf("body = %q", res.Body)
	}
	if res.Via != "socks5:"+strconv.Itoa(port) {
		t.Fatalf("via = %q", res.Via)
	}
}

// A no-auth SOCKS5 CONNECT server that splices to the requested target.
func startFakeSocks5(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { ln.Close() })

	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go serveSocks5(c)
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port
}

func serveSocks5(c net.Conn) {
	defer c.Close()
	var greet [3]byte
	if _, err := io.ReadFull(c, greet[:]); err != nil {
		return
	}
	if _, err := c.Write([]byte{0x05, 0x00}); err != nil {
		return
	}
	var head [4]byte
	if _, err := io.ReadFull(c, head[:]); err != nil {
		return
	}
	var host string
	switch head[3] {
	case 0x01:
		var ip [4]byte
		if _, err := io.ReadFull(c, ip[:]); err != nil {
			return
		}
		host = net.IP(ip[:]).String()
	case 0x03:
		var l [1]byte
		if _, err := io.ReadFull(c, l[:]); err != nil {
			return
		}
		name := make([]byte, l[0])
		if _, err := io.ReadFull(c, name); err != nil {
			return
		}
		host = string(name)
	default:
		return
	}
	var portBuf [2]byte
	if _, err := io.ReadFull(c, portBuf[:]); err != nil {
		return
	}
	target := net.JoinHostPort(host, strconv.Itoa(int(binary.BigEndian.Uint16(portBuf[:]))))
	up, err := net.Dial("tcp", target)
	if err != nil {
		c.Write([]byte{0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}
	defer up.Close()
	if _, err := c.Write([]byte{0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0}); err != nil {
		return
	}
	go io.Copy(up, c)
	io.Copy(c, up)
}
