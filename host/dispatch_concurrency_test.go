package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// slowServer answers after `delay`, standing in for a host whose route out is
// gone: the dial neither succeeds nor fails until the fetch budget runs out.
func slowServer(t *testing.T, delay time.Duration) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(delay)
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func (s *msgStream) awaitAnyAck() map[string]any {
	s.t.Helper()
	return s.await("any ack", func(m map[string]any) bool { return m["type"] == "ack" })
}

// A slow handler must not hold up the pipe. Before handlers ran concurrently a
// 15s fetch queued every hello and ping behind it, both timed out in the
// extension, and an installed helper read as missing.
func TestSlowHandlerDoesNotBlockOthers(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())

	slow := slowServer(t, 2*time.Second)
	h := startMainHarness(t)

	start := time.Now()
	h.send(t, map[string]any{"id": "slow", "type": "fetch", "url": slow.URL})
	h.send(t, map[string]any{"id": "hi", "type": "hello"})
	h.send(t, map[string]any{"id": "pg", "type": "ping"})

	if ack := h.msgs.awaitAck("hi"); ack["ok"] != true {
		t.Fatalf("hello = %#v", ack)
	}
	if ack := h.msgs.awaitAck("pg"); ack["ok"] != true {
		t.Fatalf("ping = %#v", ack)
	}
	if waited := time.Since(start); waited > time.Second {
		t.Fatalf("hello/ping waited %v behind the slow fetch", waited)
	}
	if ack := h.msgs.awaitAck("slow"); ack["ok"] != true {
		t.Fatalf("fetch = %#v", ack)
	}

	h.stdinW.Close()
}

// Disconnecting is the one thing a user reaches for when a probe has hung, so
// stop travels its own queue rather than waiting behind the network handler.
func TestStopAnswersDuringSlowFetch(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))

	slow := slowServer(t, 2*time.Second)
	h := startMainHarness(t)

	start := time.Now()
	h.send(t, map[string]any{"id": "slow", "type": "fetch", "url": slow.URL})
	h.send(t, map[string]any{"id": "st", "type": "stop"})
	if ack := h.msgs.awaitAck("st"); ack["ok"] != true {
		t.Fatalf("stop = %#v", ack)
	}
	if waited := time.Since(start); waited > time.Second {
		t.Fatalf("stop waited %v behind the slow fetch", waited)
	}
	h.msgs.awaitAck("slow")

	h.stdinW.Close()
}

// Lifecycle commands share one queue, so they answer in arrival order: a start
// that overtook the stop before it would leave two cores on one port.
func TestLifecycleCommandsStayOrdered(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))

	h := startMainHarness(t)

	h.send(t, map[string]any{
		"id": "1", "type": "start", "core": "sing-box",
		"config": socksConfig(nil),
	})
	h.send(t, map[string]any{"id": "2", "type": "stop"})
	h.send(t, map[string]any{
		"id": "3", "type": "start", "core": "sing-box",
		"config": socksConfig(nil),
	})

	var order []string
	for len(order) < 3 {
		order = append(order, h.msgs.awaitAnyAck()["id"].(string))
	}
	if order[0] != "1" || order[1] != "2" || order[2] != "3" {
		t.Fatalf("lifecycle acks out of order: %v", order)
	}

	h.send(t, map[string]any{"id": "4", "type": "stop"})
	h.msgs.awaitAck("4")
	h.stdinW.Close()
}
