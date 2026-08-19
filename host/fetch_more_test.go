package main

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDoFetchBadURL(t *testing.T) {
	if _, err := doFetch(fetchArgs{URL: "http://\x7f"}, 0); err == nil {
		t.Fatal("want parse error for control character in URL")
	}
}

func TestDoFetchConnectionError(t *testing.T) {
	port, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := doFetch(fetchArgs{URL: fmt.Sprintf("http://127.0.0.1:%d/", port)}, 0); err == nil {
		t.Fatal("want connection error")
	}
}

func TestDoFetchBodyReadError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", "1000")
		io.WriteString(w, "short")
	}))
	defer srv.Close()
	if _, err := doFetch(fetchArgs{URL: srv.URL}, 0); err == nil || !strings.Contains(err.Error(), "read body") {
		t.Fatalf("want read-body error, got %v", err)
	}
}

func TestDoFetchTooLarge(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write(make([]byte, maxFetchBytes+100))
	}))
	defer srv.Close()
	if _, err := doFetch(fetchArgs{URL: srv.URL}, 0); err == nil || !strings.Contains(err.Error(), "larger than") {
		t.Fatalf("want size error, got %v", err)
	}
}

func TestDoFetchBinaryBase64(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte{0xff, 0xfe, 0x00, 0x01})
	}))
	defer srv.Close()
	res, err := doFetch(fetchArgs{URL: srv.URL}, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !res.BodyBase64 {
		t.Fatal("want base64 body for non-UTF8 payload")
	}
	if res.Body != "//4AAQ==" {
		t.Fatalf("body = %q", res.Body)
	}
}

// scriptedSocks runs a one-connection SOCKS5 server whose behavior is the
// given script. Returns the proxy address to dial.
func scriptedSocks(t *testing.T, script func(c net.Conn)) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		script(c)
	}()
	return ln.Addr().String()
}

func mustRead(c net.Conn, n int) bool {
	_, err := io.ReadFull(c, make([]byte, n))
	return err == nil
}

func TestSocks5DialBadTarget(t *testing.T) {
	if _, err := socks5Dial(context.Background(), "127.0.0.1:1", "no-port-here"); err == nil {
		t.Fatal("want split error")
	}
	if _, err := socks5Dial(context.Background(), "127.0.0.1:1", "host:notanumber"); err == nil {
		t.Fatal("want port parse error")
	}
	if _, err := socks5Dial(context.Background(), "127.0.0.1:1", "host:0"); err == nil {
		t.Fatal("want port range error")
	}
}

func TestSocks5DialProxyUnreachable(t *testing.T) {
	port, err := freePort()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if _, err := socks5Dial(ctx, fmt.Sprintf("127.0.0.1:%d", port), "example.com:80"); err == nil {
		t.Fatal("want dial error")
	}
}

func TestSocks5DialGreetReplyError(t *testing.T) {
	// No ctx deadline: exercises the fallback SetDeadline branch too.
	addr := scriptedSocks(t, func(c net.Conn) {
		mustRead(c, 3) // read greeting, close without replying
	})
	if _, err := socks5Dial(context.Background(), addr, "example.com:80"); err == nil || !strings.Contains(err.Error(), "greet reply") {
		t.Fatalf("want greet reply error, got %v", err)
	}
}

func TestSocks5DialAuthRejected(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0xff})
	})
	if _, err := socks5Dial(context.Background(), addr, "example.com:80"); err == nil || !strings.Contains(err.Error(), "auth method") {
		t.Fatalf("want auth error, got %v", err)
	}
}

func TestSocks5DialHostnameTooLong(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		mustRead(c, 1) // wait for whatever comes (client will close)
	})
	target := strings.Repeat("a", 256) + ":80"
	if _, err := socks5Dial(context.Background(), addr, target); err == nil || !strings.Contains(err.Error(), "hostname too long") {
		t.Fatalf("want hostname error, got %v", err)
	}
}

func TestSocks5DialConnectReplyError(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		mustRead(c, 10) // full IPv4 CONNECT request, then close without reply
	})
	if _, err := socks5Dial(context.Background(), addr, "1.2.3.4:80"); err == nil || !strings.Contains(err.Error(), "connect reply") {
		t.Fatalf("want connect reply error, got %v", err)
	}
}

func TestSocks5DialRejected(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 10) {
			return
		}
		c.Write([]byte{0x05, 0x02, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
	})
	if _, err := socks5Dial(context.Background(), addr, "1.2.3.4:80"); err == nil || !strings.Contains(err.Error(), "rejected") {
		t.Fatalf("want rejected error, got %v", err)
	}
}

func TestSocks5DialUnknownReplyAddrType(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 10) {
			return
		}
		c.Write([]byte{0x05, 0x00, 0x00, 0x09})
		mustRead(c, 1)
	})
	if _, err := socks5Dial(context.Background(), addr, "1.2.3.4:80"); err == nil || !strings.Contains(err.Error(), "unknown address type") {
		t.Fatalf("want addr type error, got %v", err)
	}
}

func TestSocks5DialDomainReplyLenError(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 10) {
			return
		}
		c.Write([]byte{0x05, 0x00, 0x00, 0x03}) // domain type but no length byte
	})
	if _, err := socks5Dial(context.Background(), addr, "1.2.3.4:80"); err == nil || !strings.Contains(err.Error(), "reply addr") {
		t.Fatalf("want reply addr error, got %v", err)
	}
}

func TestSocks5DialBoundAddrTruncated(t *testing.T) {
	addr := scriptedSocks(t, func(c net.Conn) {
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 10) {
			return
		}
		c.Write([]byte{0x05, 0x00, 0x00, 0x01, 1, 2}) // 2 of 4+2 bound addr bytes
	})
	if _, err := socks5Dial(context.Background(), addr, "1.2.3.4:80"); err == nil || !strings.Contains(err.Error(), "reply addr") {
		t.Fatalf("want truncated bound addr error, got %v", err)
	}
}

func TestSocks5DialDomainTarget(t *testing.T) {
	// A hostname target uses the 0x03 (domain) CONNECT encoding.
	done := make(chan struct{})
	var gotHost string
	addr := scriptedSocks(t, func(c net.Conn) {
		defer close(done)
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		head := make([]byte, 5) // VER CMD RSV ATYP LEN
		if _, err := io.ReadFull(c, head); err != nil || head[3] != 0x03 {
			return
		}
		name := make([]byte, int(head[4]))
		if _, err := io.ReadFull(c, name); err != nil {
			return
		}
		gotHost = string(name)
		if !mustRead(c, 2) { // port
			return
		}
		c.Write([]byte{0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
	})
	conn, err := socks5Dial(context.Background(), addr, "panel.example.com:443")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	conn.Close()
	<-done
	if gotHost != "panel.example.com" {
		t.Fatalf("proxy saw host %q", gotHost)
	}
}

func TestSocks5DialIPv6TargetDomainReply(t *testing.T) {
	// IPv6 target exercises the 0x04 request encoding; the server answers with
	// a domain-typed bound address (0x03), exercising that reply branch.
	done := make(chan struct{})
	addr := scriptedSocks(t, func(c net.Conn) {
		defer close(done)
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 3+1+16+2) { // header + ATYP + IPv6 + port
			return
		}
		reply := append([]byte{0x05, 0x00, 0x00, 0x03, 9}, []byte("localhost")...)
		reply = append(reply, 0x1f, 0x90)
		c.Write(reply)
	})
	conn, err := socks5Dial(context.Background(), addr, "[::1]:8080")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	conn.Close()
	<-done
}

func TestSocks5DialIPv6BoundReply(t *testing.T) {
	done := make(chan struct{})
	addr := scriptedSocks(t, func(c net.Conn) {
		defer close(done)
		if !mustRead(c, 3) {
			return
		}
		c.Write([]byte{0x05, 0x00})
		if !mustRead(c, 10) {
			return
		}
		reply := append([]byte{0x05, 0x00, 0x00, 0x04}, make([]byte, 18)...) // IPv6 + port
		c.Write(reply)
	})
	conn, err := socks5Dial(context.Background(), addr, "1.2.3.4:80")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	conn.Close()
	<-done
}

func TestSocks5DialContextDeadlinePropagates(t *testing.T) {
	// With a ctx deadline the conn deadline comes from the context; a server
	// that never answers the greeting makes the read fail at that deadline.
	addr := scriptedSocks(t, func(c net.Conn) {
		mustRead(c, 64) // swallow input, never reply
	})
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, err := socks5Dial(ctx, addr, "example.com:80")
	if err == nil {
		t.Fatal("want timeout error")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Fatalf("deadline not honored: %s", elapsed)
	}
}
