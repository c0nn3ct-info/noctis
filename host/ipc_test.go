package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func frameBytes(body []byte) []byte {
	var lenBuf [4]byte
	binary.LittleEndian.PutUint32(lenBuf[:], uint32(len(body)))
	return append(lenBuf[:], body...)
}

func TestReadFrameOK(t *testing.T) {
	body := []byte(`{"id":"1"}`)
	got, err := readFrame(bytes.NewReader(frameBytes(body)))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(body) {
		t.Fatalf("got %q want %q", got, body)
	}
}

func TestReadFrameErrors(t *testing.T) {
	// EOF before any header byte.
	if _, err := readFrame(bytes.NewReader(nil)); err == nil {
		t.Fatal("want error on empty input")
	}
	// Truncated header.
	if _, err := readFrame(bytes.NewReader([]byte{1, 0})); err == nil {
		t.Fatal("want error on short header")
	}
	// Zero-length frame.
	if _, err := readFrame(bytes.NewReader(frameBytes(nil))); err == nil || !strings.Contains(err.Error(), "zero-length") {
		t.Fatalf("want zero-length error, got %v", err)
	}
	// Oversized frame with nothing behind it: the stream ended mid-frame, which
	// is a real read error and not something a caller can skip past.
	var big [4]byte
	binary.LittleEndian.PutUint32(big[:], maxMessageSize+1)
	if _, err := readFrame(bytes.NewReader(big[:])); err == nil {
		t.Fatal("want error on truncated oversized frame")
	}
	// Truncated body.
	if _, err := readFrame(bytes.NewReader(frameBytes([]byte("ab"))[:5])); err == nil {
		t.Fatal("want error on short body")
	}
}

func TestWriteFrameRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	if err := writeFrame(&buf, map[string]string{"a": "b"}); err != nil {
		t.Fatal(err)
	}
	raw, err := readFrame(&buf)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]string
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	if m["a"] != "b" {
		t.Fatalf("round trip = %v", m)
	}
}

func TestWriteFrameMarshalError(t *testing.T) {
	var buf bytes.Buffer
	if err := writeFrame(&buf, make(chan int)); err == nil {
		t.Fatal("want marshal error for chan payload")
	}
}

func TestWriteFrameTooLarge(t *testing.T) {
	var buf bytes.Buffer
	// A 1 MiB string serializes to 1 MiB + 2 quote bytes > maxMessageSize.
	err := writeFrame(&buf, strings.Repeat("a", maxMessageSize))
	var oversize *oversizeError
	if !errors.As(err, &oversize) {
		t.Fatalf("want *oversizeError, got %v", err)
	}
	// Nothing may reach the wire: the caller answers with something smaller on
	// the same stream, which only works if this one wrote no header.
	if buf.Len() != 0 {
		t.Fatalf("wrote %d bytes for a rejected payload", buf.Len())
	}
}

// An inbound frame past the limit is skipped whole, not fatal: the length
// prefix says how much of the stream it owns, so the frame behind it still
// reads. Killing the helper here is what turned one fat config into a
// "the helper is not responding".
func TestReadFrameSkipsOversizedAndStaysInSync(t *testing.T) {
	var stream bytes.Buffer
	var big [4]byte
	binary.LittleEndian.PutUint32(big[:], maxMessageSize+1)
	stream.Write(big[:])
	stream.Write(bytes.Repeat([]byte("x"), maxMessageSize+1))
	stream.Write(frameBytes([]byte(`{"id":"2"}`)))

	_, err := readFrame(&stream)
	var oversize *oversizeError
	if !errors.As(err, &oversize) {
		t.Fatalf("want *oversizeError, got %v", err)
	}
	if oversize.size != maxMessageSize+1 {
		t.Fatalf("reported size = %d", oversize.size)
	}
	next, err := readFrame(&stream)
	if err != nil {
		t.Fatalf("next frame after an oversized one: %v", err)
	}
	if string(next) != `{"id":"2"}` {
		t.Fatalf("next frame = %q", next)
	}
}

// failAfterWriter accepts n bytes then fails every write.
type failAfterWriter struct{ n int }

func (w *failAfterWriter) Write(p []byte) (int, error) {
	if w.n <= 0 {
		return 0, errors.New("sink broken")
	}
	if len(p) > w.n {
		n := w.n
		w.n = 0
		return n, errors.New("sink broken")
	}
	w.n -= len(p)
	return len(p), nil
}

func TestWriteFrameWriteErrors(t *testing.T) {
	// Header write fails.
	if err := writeFrame(&failAfterWriter{n: 0}, "x"); err == nil {
		t.Fatal("want header write error")
	}
	// Header succeeds, body write fails.
	if err := writeFrame(&failAfterWriter{n: 4}, "x"); err == nil {
		t.Fatal("want body write error")
	}
}

func TestFrameIDSalvagesTheIDFromAHead(t *testing.T) {
	if got := frameID([]byte(`{"id":"abc-123","type":"start","config":{"x":`)); got != "abc-123" {
		t.Fatalf("frameID = %q", got)
	}
	if got := frameID([]byte(`{"type":"start","config":{"x":`)); got != "" {
		t.Fatalf("frameID without an id = %q, want empty", got)
	}
}

func TestReadFrameKeepsTheHeadOfAnOversizedFrame(t *testing.T) {
	body := append([]byte(`{"id":"fat","type":"start","config":"`),
		bytes.Repeat([]byte("x"), maxMessageSize)...)
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], uint32(len(body)))
	r := bytes.NewReader(append(size[:], body...))

	_, err := readFrame(r)
	var oversize *oversizeError
	if !errors.As(err, &oversize) {
		t.Fatalf("want *oversizeError, got %v", err)
	}
	if len(oversize.head) != oversizeHeadSize {
		t.Fatalf("head = %d bytes, want %d", len(oversize.head), oversizeHeadSize)
	}
	if got := frameID(oversize.head); got != "fat" {
		t.Fatalf("id out of the head = %q", got)
	}
}

func TestReadFrameFailsWhenAnOversizedFrameEndsBeforeItsLength(t *testing.T) {
	// Head reads fine, the skip past it does not: the stream is unsynced, so
	// this is an error and not a droppable frame.
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], maxMessageSize+1)
	body := bytes.Repeat([]byte("x"), oversizeHeadSize+16)
	if _, err := readFrame(bytes.NewReader(append(size[:], body...))); err == nil {
		t.Fatal("want an error when the frame is shorter than its length prefix")
	}
}

func TestReadFrameFailsOnAnOversizedFrameTruncatedInsideItsHead(t *testing.T) {
	var size [4]byte
	binary.LittleEndian.PutUint32(size[:], maxMessageSize+1)
	r := bytes.NewReader(append(size[:], []byte(`{"id":"fat"`)...))
	if _, err := readFrame(r); err == nil {
		t.Fatal("want an error when the head itself is truncated")
	}
}
