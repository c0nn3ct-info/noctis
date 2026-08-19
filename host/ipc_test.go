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
	// Oversized frame.
	var big [4]byte
	binary.LittleEndian.PutUint32(big[:], maxMessageSize+1)
	if _, err := readFrame(bytes.NewReader(big[:])); err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("want too-large error, got %v", err)
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
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Fatalf("want too-large error, got %v", err)
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
