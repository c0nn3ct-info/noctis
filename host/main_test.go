package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDispatchInterfaces(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	a := dispatch(msgFor(t, `{"id":"7","type":"interfaces"}`), newSupervisor(nil), lg)
	if !a.OK {
		t.Fatalf("interfaces ack not ok: %+v", a)
	}
	data, ok := a.Data.(map[string]any)
	if !ok {
		t.Fatalf("data = %T", a.Data)
	}
	if _, ok := data["interfaces"].([]ifaceInfo); !ok {
		t.Fatalf("interfaces = %T", data["interfaces"])
	}
	if _, ok := data["auto"].(string); !ok {
		t.Fatalf("auto = %T", data["auto"])
	}
}

func TestDispatchStartCarriesBindPreference(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	sup := newSupervisor(nil)
	// A start that fails past the preference still has to have recorded it: the
	// binding is chosen before the core is located.
	dispatch(msgFor(t, `{"id":"8","type":"start","core":"sing-box","config":{},"bindInterface":"none"}`), sup, lg)
	if got := sup.boundInterface(); got != "" {
		t.Fatalf("bound interface = %q, want empty after a \"none\" start", got)
	}
	dispatch(msgFor(t, `{"id":"9","type":"reload","core":"sing-box","config":{},"bindInterface":"Wi-Fi"}`), sup, lg)
	if got := sup.boundInterface(); got != "Wi-Fi" {
		t.Fatalf("bound interface = %q, want Wi-Fi after a reload override", got)
	}
}

func TestIncomingMsgUnmarshal(t *testing.T) {
	var m incomingMsg
	data := []byte(`{"id":"7","type":"ping","extra":1}`)
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	if m.ID != "7" || m.Type != "ping" {
		t.Fatalf("msg = %+v", m)
	}
	if string(m.Raw) != string(data) {
		t.Fatalf("raw = %s", m.Raw)
	}
	if err := json.Unmarshal([]byte(`"just a string"`), &m); err == nil {
		t.Fatal("want error for non-object message")
	}
}

func TestSenderSend(t *testing.T) {
	var buf bytes.Buffer
	snd := &sender{out: bufio.NewWriter(&buf), mu: &sync.Mutex{}}
	if err := snd.send(map[string]string{"k": "v"}); err != nil {
		t.Fatal(err)
	}
	raw, err := readFrame(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"k":"v"`) {
		t.Fatalf("frame = %s", raw)
	}
	if err := snd.send(make(chan int)); err == nil {
		t.Fatal("want marshal error")
	}
}

func TestErrAck(t *testing.T) {
	a := errAck("42", fmt.Errorf("boom"))
	if a.ID != "42" || a.OK || a.Error != "boom" || a.Type != "ack" {
		t.Fatalf("ack = %+v", a)
	}
}

func discardLogger() *log.Logger { return log.New(io.Discard, "", 0) }

func msgFor(t *testing.T, raw string) *incomingMsg {
	t.Helper()
	var m incomingMsg
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatalf("bad test message %s: %v", raw, err)
	}
	return &m
}

func TestDispatchProbe(t *testing.T) {
	sup := newSupervisor(nil)
	lg := log.New(io.Discard, "", 0)
	orig := probeDial
	t.Cleanup(func() { probeDial = orig })
	probeDial = func(context.Context, string) (net.Conn, error) {
		return &scriptedConn{reader: strings.NewReader("")}, nil
	}

	a := dispatch(msgFor(t, `{"id":"1","type":"probe","host":"h.example","port":443}`), sup, lg)
	if !a.OK {
		t.Fatalf("probe ack = %+v, want ok", a)
	}
	res, ok := a.Data.(*probeResult)
	if !ok || res.Via != "direct" {
		t.Fatalf("probe data = %+v, want a direct result", a.Data)
	}

	// A dial that finds nothing is the server's answer, reported as an error.
	probeDial = func(context.Context, string) (net.Conn, error) {
		return nil, errors.New("connect: connection refused")
	}
	if a := dispatch(msgFor(t, `{"id":"2","type":"probe","host":"h.example","port":443}`), sup, lg); a.OK ||
		!strings.Contains(a.Error, "connection refused") {
		t.Fatalf("refused ack = %+v, want the dial error", a)
	}

	// A payload that is not a probe request at all.
	if a := dispatch(msgFor(t, `{"id":"3","type":"probe","port":"nope"}`), sup, lg); a.OK ||
		!strings.Contains(a.Error, "decode probe") {
		t.Fatalf("bad-args ack = %+v, want a decode error", a)
	}
}

func TestDispatchSimple(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", "")
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())
	sup := newSupervisor(nil)
	lg := discardLogger()

	hello := dispatch(msgFor(t, `{"id":"1","type":"hello"}`), sup, lg)
	if !hello.OK {
		t.Fatalf("hello = %+v", hello)
	}
	data := hello.Data.(map[string]any)
	if data["version"] != hostVersion || data["cores"] == nil || data["features"] == nil {
		t.Fatalf("hello data = %#v", data)
	}

	if a := dispatch(msgFor(t, `{"id":"2","type":"cores"}`), sup, lg); !a.OK {
		t.Fatalf("cores = %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"3","type":"ping"}`), sup, lg); !a.OK {
		t.Fatalf("ping = %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"4","type":"stop"}`), sup, lg); !a.OK {
		t.Fatalf("stop = %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"5","type":"stats"}`), sup, lg); !a.OK {
		t.Fatalf("stats = %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"6","type":"warp"}`), sup, lg); a.OK || !strings.Contains(a.Error, "unknown type") {
		t.Fatalf("unknown = %+v", a)
	}
}

func TestDispatchStart(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	lg := discardLogger()

	t.Run("bad-args", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"start","core":5}`), sup, lg); a.OK {
			t.Fatalf("want decode error, got %+v", a)
		}
	})
	t.Run("missing-config", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"start"}`), sup, lg); a.OK || !strings.Contains(a.Error, "missing config") {
			t.Fatalf("want missing-config error, got %+v", a)
		}
	})
	t.Run("unknown-core", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"start","core":"nope","config":{}}`), sup, lg); a.OK || !strings.Contains(a.Error, "unknown core") {
			t.Fatalf("want unknown-core error, got %+v", a)
		}
	})
	t.Run("bad-yaml-wrapper", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"start","core":"mihomo","config":{"a":1}}`), sup, lg); a.OK || !strings.Contains(a.Error, "JSON string") {
			t.Fatalf("want yaml wrapper error, got %+v", a)
		}
	})
	t.Run("start-fails", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", "")
		t.Setenv("PATH", t.TempDir())
		sup := newSupervisor(nil)
		raw, _ := json.Marshal(map[string]any{"id": "1", "type": "start", "core": "sing-box", "config": json.RawMessage(socksConfig(nil))})
		if a := dispatch(msgFor(t, string(raw)), sup, lg); a.OK {
			t.Fatalf("want start error, got %+v", a)
		}
	})
	t.Run("success", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		notify, events := collectNotify()
		sup := newSupervisor(notify)
		raw, _ := json.Marshal(map[string]any{"id": "1", "type": "start", "core": "sing-box", "config": json.RawMessage(socksConfig(nil))})
		a := dispatch(msgFor(t, string(raw)), sup, lg)
		if !a.OK {
			t.Fatalf("start = %+v", a)
		}
		if port := a.Data.(map[string]int)["socksPort"]; port <= 0 {
			t.Fatalf("socksPort = %d", port)
		}
		if a := dispatch(msgFor(t, `{"id":"2","type":"stop"}`), sup, lg); !a.OK {
			t.Fatalf("stop = %+v", a)
		}
		waitEvent(t, events, "child_exit", 5*time.Second)
	})
}

func TestDispatchReload(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	lg := discardLogger()

	t.Run("bad-args", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"reload","core":5}`), sup, lg); a.OK {
			t.Fatalf("want decode error, got %+v", a)
		}
	})
	t.Run("unknown-core", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"reload","core":"nope","config":{}}`), sup, lg); a.OK {
			t.Fatalf("want unknown-core error, got %+v", a)
		}
	})
	t.Run("bad-yaml-wrapper", func(t *testing.T) {
		sup := newSupervisor(nil)
		if a := dispatch(msgFor(t, `{"id":"1","type":"reload","core":"mihomo","config":{"a":1}}`), sup, lg); a.OK {
			t.Fatalf("want yaml wrapper error, got %+v", a)
		}
	})
	t.Run("reload-fails", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", "")
		t.Setenv("PATH", t.TempDir())
		sup := newSupervisor(nil)
		raw, _ := json.Marshal(map[string]any{"id": "1", "type": "reload", "core": "sing-box", "config": json.RawMessage(socksConfig(nil))})
		if a := dispatch(msgFor(t, string(raw)), sup, lg); a.OK {
			t.Fatalf("want reload error, got %+v", a)
		}
	})
	t.Run("success", func(t *testing.T) {
		t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
		notify, events := collectNotify()
		sup := newSupervisor(notify)
		raw, _ := json.Marshal(map[string]any{"id": "1", "type": "reload", "core": "sing-box", "config": json.RawMessage(socksConfig(nil))})
		a := dispatch(msgFor(t, string(raw)), sup, lg)
		if !a.OK {
			t.Fatalf("reload = %+v", a)
		}
		sup.stop()
		waitEvent(t, events, "child_exit", 5*time.Second)
	})
}

func TestDispatchFetch(t *testing.T) {
	lg := discardLogger()
	sup := newSupervisor(nil)

	if a := dispatch(msgFor(t, `{"id":"1","type":"fetch","url":5}`), sup, lg); a.OK {
		t.Fatalf("want decode error, got %+v", a)
	}
	if a := dispatch(msgFor(t, `{"id":"2","type":"fetch","url":"ftp://x"}`), sup, lg); a.OK || !strings.Contains(a.Error, "unsupported scheme") {
		t.Fatalf("want scheme error, got %+v", a)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		io.WriteString(w, "hello")
	}))
	defer srv.Close()
	raw, _ := json.Marshal(map[string]any{"id": "3", "type": "fetch", "url": srv.URL})
	a := dispatch(msgFor(t, string(raw)), sup, lg)
	if !a.OK {
		t.Fatalf("fetch = %+v", a)
	}
	if res := a.Data.(*fetchResult); res.Body != "hello" {
		t.Fatalf("body = %q", res.Body)
	}
}

// --- main() integration -----------------------------------------------------

type stdioHarness struct {
	stdinW    *os.File
	stdoutR   *os.File
	stderr    chan string // stderr lines
	stderrBuf []string    // lines already read but not yet matched
	done      chan struct{}
	msgs      *msgStream
}

type msgStream struct {
	t   *testing.T
	ch  chan map[string]any
	buf []map[string]any
}

func (s *msgStream) await(what string, pred func(map[string]any) bool) map[string]any {
	s.t.Helper()
	for i, m := range s.buf {
		if pred(m) {
			s.buf = append(s.buf[:i], s.buf[i+1:]...)
			return m
		}
	}
	deadline := time.After(15 * time.Second)
	for {
		select {
		case m, ok := <-s.ch:
			if !ok {
				s.t.Fatalf("output closed while waiting for %s", what)
			}
			if pred(m) {
				return m
			}
			s.buf = append(s.buf, m)
		case <-deadline:
			s.t.Fatalf("timed out waiting for %s", what)
		}
	}
}

func (s *msgStream) awaitAck(id string) map[string]any {
	s.t.Helper()
	return s.await("ack "+id, func(m map[string]any) bool {
		return m["type"] == "ack" && m["id"] == id
	})
}

func (s *msgStream) awaitEvent(name string) map[string]any {
	s.t.Helper()
	return s.await("event "+name, func(m map[string]any) bool {
		return m["type"] == "event" && m["event"] == name
	})
}

// startMainHarness swaps os.Stdin/Stdout/Stderr for pipes, runs main() in a
// goroutine, and exposes typed access to its frames and stderr log lines.
func startMainHarness(t *testing.T) *stdioHarness {
	t.Helper()
	stdinR, stdinW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	stdoutR, stdoutW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	oldIn, oldOut, oldErr := os.Stdin, os.Stdout, os.Stderr
	os.Stdin, os.Stdout, os.Stderr = stdinR, stdoutW, stderrW

	h := &stdioHarness{
		stdinW:  stdinW,
		stdoutR: stdoutR,
		stderr:  make(chan string, 256),
		done:    make(chan struct{}),
	}
	h.msgs = &msgStream{t: t, ch: make(chan map[string]any, 256)}

	go func() {
		defer close(h.msgs.ch)
		for {
			raw, err := readFrame(stdoutR)
			if err != nil {
				return
			}
			var m map[string]any
			if json.Unmarshal(raw, &m) == nil {
				h.msgs.ch <- m
			}
		}
	}()
	go func() {
		sc := bufio.NewScanner(stderrR)
		for sc.Scan() {
			select {
			case h.stderr <- sc.Text():
			default:
			}
		}
	}()
	go func() {
		main()
		close(h.done)
	}()

	t.Cleanup(func() {
		select {
		case <-h.done:
		case <-time.After(15 * time.Second):
			t.Error("main() did not exit")
		}
		os.Stdin, os.Stdout, os.Stderr = oldIn, oldOut, oldErr
		stdinR.Close()
		stdinW.Close()
		stdoutR.Close()
		stdoutW.Close()
		stderrR.Close()
		stderrW.Close()
	})
	return h
}

func (h *stdioHarness) send(t *testing.T, v any) {
	t.Helper()
	if err := writeFrame(h.stdinW, v); err != nil {
		t.Fatalf("send frame: %v", err)
	}
}

func (h *stdioHarness) awaitStderr(t *testing.T, substr string) {
	t.Helper()
	for i, line := range h.stderrBuf {
		if strings.Contains(line, substr) {
			h.stderrBuf = append(h.stderrBuf[:i], h.stderrBuf[i+1:]...)
			return
		}
	}
	deadline := time.After(15 * time.Second)
	for {
		select {
		case line := <-h.stderr:
			if strings.Contains(line, substr) {
				return
			}
			h.stderrBuf = append(h.stderrBuf, line)
		case <-deadline:
			t.Fatalf("timed out waiting for stderr line containing %q", substr)
		}
	}
}

func TestMainHappyFlow(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())

	h := startMainHarness(t)

	h.send(t, map[string]any{"id": "1", "type": "hello"})
	hello := h.msgs.awaitAck("1")
	if hello["ok"] != true {
		t.Fatalf("hello = %#v", hello)
	}

	// A frame that is not JSON is logged and skipped; the loop keeps serving.
	if _, err := h.stdinW.Write(frameBytes([]byte("this is not json"))); err != nil {
		t.Fatal(err)
	}
	h.send(t, map[string]any{"id": "2", "type": "ping"})
	if ack := h.msgs.awaitAck("2"); ack["ok"] != true {
		t.Fatalf("ping = %#v", ack)
	}

	h.send(t, map[string]any{
		"id": "3", "type": "start", "core": "sing-box",
		"config": json.RawMessage(socksConfig(map[string]any{"test_log": "main-flow-core"})),
	})
	ack := h.msgs.awaitAck("3")
	if ack["ok"] != true {
		t.Fatalf("start = %#v", ack)
	}
	port := ack["data"].(map[string]any)["socksPort"].(float64)
	if port <= 0 {
		t.Fatalf("socksPort = %v", port)
	}
	// Child log lines surface as events (notify success path). The helper's own
	// lines (bind interface) ride the same channel, so match on the line.
	h.msgs.await("core log line", func(m map[string]any) bool {
		if m["type"] != "event" || m["event"] != "log" {
			return false
		}
		pl, ok := m["payload"].(map[string]any)
		return ok && pl["line"] == "main-flow-core"
	})

	h.send(t, map[string]any{"id": "4", "type": "stats"})
	if ack := h.msgs.awaitAck("4"); ack["ok"] != true {
		t.Fatalf("stats = %#v", ack)
	}

	h.send(t, map[string]any{"id": "5", "type": "stop"})
	if ack := h.msgs.awaitAck("5"); ack["ok"] != true {
		t.Fatalf("stop = %#v", ack)
	}
	h.msgs.awaitEvent("child_exit")

	// EOF on stdin shuts the helper down.
	h.stdinW.Close()
	select {
	case <-h.done:
	case <-time.After(10 * time.Second):
		t.Fatal("main did not exit on stdin EOF")
	}
}

func TestMainReadError(t *testing.T) {
	h := startMainHarness(t)
	// An oversized length prefix with a truncated body leaves the stream
	// unreadable: log + stop + exit.
	var big [4]byte
	binary.LittleEndian.PutUint32(big[:], maxMessageSize+1)
	if _, err := h.stdinW.Write(big[:]); err != nil {
		t.Fatal(err)
	}
	h.stdinW.Close()
	select {
	case <-h.done:
	case <-time.After(10 * time.Second):
		t.Fatal("main did not exit on read error")
	}
}

// A complete frame past the size limit is dropped, not fatal. The extension
// keeps one port for every request, so exiting here took the running core down
// with it and read to the user as a helper that had stopped answering.
func TestMainSkipsOversizedInboundFrame(t *testing.T) {
	h := startMainHarness(t)

	var big [4]byte
	binary.LittleEndian.PutUint32(big[:], maxMessageSize+1)
	if _, err := h.stdinW.Write(big[:]); err != nil {
		t.Fatal(err)
	}
	if _, err := h.stdinW.Write(bytes.Repeat([]byte("x"), maxMessageSize+1)); err != nil {
		t.Fatal(err)
	}
	h.awaitStderr(t, "dropped inbound frame")

	h.send(t, map[string]any{"id": "after", "type": "ping"})
	if ack := h.msgs.awaitAck("after"); ack["ok"] != true {
		t.Fatalf("ping after an oversized frame = %#v", ack)
	}
	h.stdinW.Close()
}

// A dropped frame that still named its request is answered rather than left to
// time out: the caller's budget is spent on nothing otherwise, and the timeout
// it reports says nothing about the config having been too big to carry.
func TestMainAnswersOversizedInboundFrameWithASalvagedID(t *testing.T) {
	h := startMainHarness(t)

	body := append([]byte(`{"id":"fat","type":"start","core":"sing-box","config":"`),
		bytes.Repeat([]byte("x"), maxMessageSize+1)...)
	body = append(body, '"', '}')
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], uint32(len(body)))
	if _, err := h.stdinW.Write(size[:]); err != nil {
		t.Fatal(err)
	}
	if _, err := h.stdinW.Write(body); err != nil {
		t.Fatal(err)
	}

	ack := h.msgs.awaitAck("fat")
	if ack["ok"] != false {
		t.Fatalf("oversized start ack = %#v", ack)
	}
	if msg, _ := ack["error"].(string); !strings.Contains(msg, "frame too large") {
		t.Fatalf("error = %q, want it to name the frame size", msg)
	}

	h.send(t, map[string]any{"id": "after", "type": "ping"})
	if a := h.msgs.awaitAck("after"); a["ok"] != true {
		t.Fatalf("ping after an answered oversized frame = %#v", a)
	}
	h.stdinW.Close()
}

// An answer that cannot fit one frame comes back as an error ack. Nothing was
// written for the real answer, so the stream is free for a smaller one — and
// the caller learns why instead of watching its port die.
func TestMainAnswersOversizeWithErrorAck(t *testing.T) {
	// NUL bytes are valid UTF-8 and each escapes to six characters in JSON, so
	// a body well inside the fetch cap still overflows a native-messaging frame.
	body := bytes.Repeat([]byte{0}, 300<<10)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Write(body)
	}))
	defer srv.Close()

	h := startMainHarness(t)
	h.send(t, map[string]any{"id": "1", "type": "fetch", "url": srv.URL})
	ack := h.msgs.awaitAck("1")
	if ack["ok"] != false {
		t.Fatalf("oversized fetch ack = %#v", ack)
	}
	if msg, _ := ack["error"].(string); !strings.Contains(msg, "payload too large") {
		t.Fatalf("error = %q, want it to name the payload size", msg)
	}

	// Still serving.
	h.send(t, map[string]any{"id": "2", "type": "ping"})
	if a := h.msgs.awaitAck("2"); a["ok"] != true {
		t.Fatalf("ping after an oversized answer = %#v", a)
	}
	h.stdinW.Close()
}

func TestMainWriteAndNotifyErrors(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.11.0"))

	h := startMainHarness(t)

	h.send(t, map[string]any{
		"id": "1", "type": "start", "core": "sing-box",
		"config": json.RawMessage(socksConfig(nil)),
	})
	if ack := h.msgs.awaitAck("1"); ack["ok"] != true {
		t.Fatalf("start = %#v", ack)
	}

	// Break the outbound pipe: every further send (acks and events) fails.
	h.stdoutR.Close()

	// stop kills the child; its child_exit notify now fails, and the ack write
	// failure makes main exit through the write-error path.
	h.send(t, map[string]any{"id": "2", "type": "stop"})
	h.awaitStderr(t, "notify(child_exit) failed")
	h.awaitStderr(t, "write error")
	select {
	case <-h.done:
	case <-time.After(10 * time.Second):
		t.Fatal("main did not exit on write error")
	}
}

func TestPingReportsCorePort(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	sup := newSupervisor(nil)

	a := dispatch(msgFor(t, `{"id":"1","type":"ping"}`), sup, lg)
	data, ok := a.Data.(map[string]any)
	if !ok {
		t.Fatalf("ping data = %#v", a.Data)
	}
	if data["pong"] != "ok" {
		t.Fatalf("pong = %#v", data["pong"])
	}
	// No core running: the extension must be able to tell that apart from a
	// helper that simply cannot answer.
	if got, want := data["corePort"], 0; got != want {
		t.Fatalf("corePort = %#v, want %d", got, want)
	}

	sup.mu.Lock()
	sup.cmd = &exec.Cmd{}
	sup.port = 63135
	sup.mu.Unlock()

	a = dispatch(msgFor(t, `{"id":"2","type":"ping"}`), sup, lg)
	data = a.Data.(map[string]any)
	if got, want := data["corePort"], 63135; got != want {
		t.Fatalf("corePort = %#v, want %d", got, want)
	}
}

func TestReapStaleConfigs(t *testing.T) {
	tmp := t.TempDir()
	t.Setenv("TMPDIR", tmp)
	dir := filepath.Join(tmp, "noctis")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}

	// A dead session's leftovers, our own config, and a live session's config.
	dead := filepath.Join(dir, "config-999999.json")
	mine := filepath.Join(dir, fmt.Sprintf("config-%d.json", os.Getpid()))
	live := filepath.Join(dir, fmt.Sprintf("config-%d.yaml", os.Getppid()))
	junk := filepath.Join(dir, "notes.txt")
	for _, p := range []string{dead, mine, live, junk} {
		if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	reapStaleConfigs()

	if _, err := os.Stat(dead); !os.IsNotExist(err) {
		t.Fatalf("dead session config survived: %v", err)
	}
	for _, p := range []string{mine, live, junk} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s was removed: %v", filepath.Base(p), err)
		}
	}
}
