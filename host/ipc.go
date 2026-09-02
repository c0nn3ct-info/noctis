package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
)

const maxMessageSize = 1 << 20 // 1 MiB; matches Chrome's NM frame limit

// oversizeError marks a frame that breaks the size limit in either direction.
// It is deliberately its own type: an oversized frame is a fault of one
// message, not of the pipe, and the read loop keeps serving after it. Treating
// it like an I/O error is what turned a single fat config or fetch body into a
// helper that exited and read to the user as "the helper is not responding".
type oversizeError struct {
	dir  string // "frame" (inbound) or "payload" (outbound)
	size int
	// head is the first bytes of an oversized inbound frame, kept so the read
	// loop can name the request that was dropped and answer it. Nil for an
	// outbound payload, which the caller already holds whole.
	head []byte
}

// oversizeHeadSize is how much of a dropped frame is kept to identify the
// request inside it. Requests put `id` first, so a kilobyte is plenty.
const oversizeHeadSize = 1024

var frameIDRe = regexp.MustCompile(`"id"\s*:\s*"([^"]{1,128})"`)

// frameID pulls the request id out of the head of a frame that was never
// decoded. Empty when there is no readable id — nothing to answer then.
func frameID(head []byte) string {
	m := frameIDRe.FindSubmatch(head)
	if m == nil {
		return ""
	}
	return string(m[1])
}

func (e *oversizeError) Error() string {
	return fmt.Sprintf("%s too large: %d bytes (limit %d)", e.dir, e.size, maxMessageSize)
}

func readFrame(r io.Reader) ([]byte, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return nil, err
	}
	length := binary.LittleEndian.Uint32(lenBuf[:])
	if length == 0 {
		return nil, fmt.Errorf("zero-length frame")
	}
	if length > maxMessageSize {
		// The length prefix says exactly how much of the stream this frame
		// owns, so skipping it leaves the next frame header where it should
		// be. Only a failure to skip is fatal — the stream is unsynced then.
		// The first kilobyte is kept rather than skipped: it carries the
		// request id, which is what turns a silent drop into an answer.
		head := make([]byte, oversizeHeadSize)
		if _, err := io.ReadFull(r, head); err != nil {
			return nil, err
		}
		if _, err := io.CopyN(io.Discard, r, int64(length)-oversizeHeadSize); err != nil {
			return nil, err
		}
		return nil, &oversizeError{dir: "frame", size: int(length), head: head}
	}
	buf := make([]byte, length)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func writeFrame(w io.Writer, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	// Checked before a single byte goes out, so a rejected payload leaves the
	// stream untouched and the caller can answer with something smaller.
	if len(body) > maxMessageSize {
		return &oversizeError{dir: "payload", size: len(body)}
	}
	var lenBuf [4]byte
	binary.LittleEndian.PutUint32(lenBuf[:], uint32(len(body)))
	if _, err := w.Write(lenBuf[:]); err != nil {
		return err
	}
	if _, err := w.Write(body); err != nil {
		return err
	}
	return nil
}
