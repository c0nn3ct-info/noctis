package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"runtime"
	"sync"
	"time"
)

// Multi-core helper: hello reports `cores` (+ per-core versions). The extension
// treats a missing `cores` field in the hello ack as a pre-multi-core helper.
var hostVersion = "1.2.5"

type incomingMsg struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Raw  json.RawMessage `json:"-"`
}

func (m *incomingMsg) UnmarshalJSON(data []byte) error {
	type alias struct {
		ID   string `json:"id"`
		Type string `json:"type"`
	}
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	m.ID = a.ID
	m.Type = a.Type
	m.Raw = append([]byte(nil), data...)
	return nil
}

type ack struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
	Data  any    `json:"data,omitempty"`
}

type sender struct {
	out *bufio.Writer
	mu  *sync.Mutex
}

// flush drains the buffer under the same lock every write takes. main defers it
// rather than calling out.Flush() directly: handler goroutines can still be
// writing when the read loop returns, and an unsynchronized flush beside them is
// a data race on the bufio.Writer.
func (s *sender) flush() {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.out.Flush()
}

func (s *sender) send(payload any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := writeFrame(s.out, payload); err != nil {
		return err
	}
	return s.out.Flush()
}

func main() {
	// Through helperStderr, not straight to os.Stderr: the same lines have to
	// reach the ring a problem report reads from.
	logger := log.New(helperStderr, "noctis-host ", log.LstdFlags|log.Lmicroseconds)
	logger.Printf("starting v%s on %s/%s", hostVersion, runtime.GOOS, runtime.GOARCH)

	// Leftovers from sessions that are gone; harmless but they accumulate.
	reapStaleConfigs()

	// Probe the core versions now, in the background, so the first hello can
	// answer from a warm cache. A cold exec of a core binary can take seconds,
	// and hello used to pay for all three of them in series.
	warmVersions()

	in := bufio.NewReaderSize(os.Stdin, 64*1024)
	out := bufio.NewWriterSize(os.Stdout, 64*1024)

	var writeMu sync.Mutex
	snd := &sender{out: out, mu: &writeMu}
	defer snd.flush()

	notify := func(event string, payload any) {
		if err := snd.send(map[string]any{
			"type":    "event",
			"event":   event,
			"payload": payload,
		}); err != nil {
			logger.Printf("notify(%s) failed: %v", event, err)
		}
	}

	sup := newSupervisor(notify)

	// A broken stdout used to be handled by returning from the loop below. Now
	// that handlers answer off it, the failure can happen on any goroutine, so
	// it closes stdin instead: the blocked read wakes with an error and main
	// leaves through the same path it always did.
	stdin := os.Stdin
	var failOnce sync.Once
	fail := func(err error) {
		logger.Printf("write error: %v", err)
		failOnce.Do(func() {
			sup.stop()
			_ = stdin.Close()
		})
	}
	// The one way an answer leaves the helper. `kind` and `id` only name the
	// request in the log; a dropped inbound frame answers through here too,
	// with the id salvaged out of its head.
	send := func(id, kind string, a ack) {
		err := snd.send(a)
		// An answer too big for one frame is this request's problem, not the
		// pipe's: nothing was written, so say so in an ack that fits and keep
		// the helper alive. Dying here made one oversized `fetch` body look
		// like a helper that had stopped answering altogether.
		var oversize *oversizeError
		if errors.As(err, &oversize) {
			logger.Printf("answer to %q (%s) dropped: %v", kind, id, oversize)
			err = snd.send(errAck(id, oversize))
		}
		if err != nil {
			fail(err)
		}
	}
	serve := func(msg *incomingMsg) {
		send(msg.ID, msg.Type, dispatch(msg, sup, logger))
	}

	// One pipe carries every request, and dispatch blocks: a `fetch` with no
	// route out holds the pipe for its full 15s, and the `hello` and `ping`
	// queued behind it time out in the extension — which then reports the
	// helper as missing while it is merely busy. So only the core lifecycle
	// keeps a single ordered queue (start/stop/reload must not interleave);
	// every other handler is read-only or network I/O and answers on its own
	// goroutine, capped so a burst of probes can't spawn unbounded work.
	lifecycle := make(chan *incomingMsg, 64)
	defer close(lifecycle)
	go func() {
		for msg := range lifecycle {
			// Bracketed in the log on purpose: a lifecycle command that never
			// answers is the one failure a report cannot otherwise place. With
			// only the failure line to go on, a request that never arrived and
			// one that arrived and hung in a core spawn read the same.
			logger.Printf("%s (%s) received, %d bytes", msg.Type, msg.ID, len(msg.Raw))
			at := time.Now()
			serve(msg)
			logger.Printf("%s (%s) answered in %s", msg.Type, msg.ID, time.Since(at).Round(time.Millisecond))
		}
	}()
	sem := make(chan struct{}, maxConcurrentHandlers)

	for {
		raw, err := readFrame(in)
		if err != nil {
			if err == io.EOF {
				logger.Print("stdin closed, stopping")
				sup.stop()
				return
			}
			// A frame past the size limit was skipped whole, so the stream is
			// still aligned and the next request is readable. Only a genuine
			// stream error ends the loop.
			var oversize *oversizeError
			if errors.As(err, &oversize) {
				logger.Printf("dropped inbound frame: %v", oversize)
				// Answered whenever the head named a request. Dropping it in
				// silence spends the caller's whole budget on an ack that is
				// never coming, and the timeout it then reports says nothing
				// about the config having been too big to carry.
				if id := frameID(oversize.head); id != "" {
					send(id, "oversized frame", errAck(id, oversize))
				}
				continue
			}
			logger.Printf("read error: %v", err)
			sup.stop()
			return
		}
		var msg incomingMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			logger.Printf("decode error: %v", err)
			continue
		}
		if isLifecycle(msg.Type) {
			lifecycle <- &msg
			continue
		}
		// The semaphore is taken inside the goroutine on purpose: taking it here
		// would put the read loop back behind the handlers it is meant to escape.
		go func(msg *incomingMsg) {
			sem <- struct{}{}
			defer func() { <-sem }()
			serve(msg)
		}(&msg)
	}
}

// How many non-lifecycle handlers may run at once. Enough that a popup's worth
// of concurrent probes overlaps, low enough that a runaway caller cannot make
// the helper fork work without bound.
const maxConcurrentHandlers = 8

// Commands that change the running child. They answer one at a time, in arrival
// order: a `start` racing the `stop` before it would leave two cores fighting
// over one port.
func isLifecycle(t string) bool {
	switch t {
	case "start", "stop", "reload":
		return true
	}
	return false
}

type startArgs struct {
	Core   string          `json:"core"`
	Config json.RawMessage `json:"config"`
	// BindInterface is the extension's adapter preference: "auto" (or absent),
	// "none", or a name from the `interfaces` ack. An automatic pick can land on
	// a LAN emulator like Hamachi, where every outbound dial dies silently, so
	// the user gets the last word.
	BindInterface string `json:"bindInterface"`
}

func dispatch(msg *incomingMsg, sup *supervisor, logger *log.Logger) ack {
	switch msg.Type {
	case "hello":
		return ack{
			ID:   msg.ID,
			Type: "ack",
			OK:   true,
			Data: map[string]any{
				"version":  hostVersion,
				"platform": fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH),
				"cores":    installedCores(),
				// The adapter outbound connections get bound to. Reported so the
				// extension can show the real one instead of a guess: a wrong pick
				// (a virtual adapter on Windows) kills every dial silently.
				"bindInterface": sup.boundInterface(),
				// Capabilities added after 1.1.2, advertised for future use. The
				// extension gates on the host version instead (helper-compat.ts):
				// a helper without "fetch" reads as outdated, not incompatible.
				"features": []string{"fetch", "route", "interfaces", "diagnostics"},
			},
		}
	case "cores":
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: map[string]any{"cores": installedCores()}}
	case "route-verdict":
		var args struct {
			Host  string    `json:"host"`
			Hosts *[]string `json:"hosts"`
		}
		if err := json.Unmarshal(msg.Raw, &args); err != nil {
			return errAck(msg.ID, fmt.Errorf("decode route-verdict: %w", err))
		}
		// The badge asks about every open tab at once, so a list answers with a
		// map and saves a round trip per tab. Hosts with no verdict are absent
		// rather than null: "not in the map" is the only shape the caller needs.
		if args.Hosts != nil {
			now := nowMillis()
			out := make(map[string]*RouteVerdict, len(*args.Hosts))
			for _, h := range *args.Hosts {
				if v := sup.route.get(h, now); v != nil {
					out[h] = v
				}
			}
			return ack{ID: msg.ID, Type: "ack", OK: true, Data: out}
		}
		if args.Host == "" {
			return errAck(msg.ID, errors.New("route-verdict: host or hosts is required"))
		}
		// A host nobody routed answers null rather than failing: "no verdict" and
		// "the helper broke" must not look the same to the extension. Spelled out
		// rather than passing the pointer straight through, so a missing verdict is
		// a nil interface and not a typed nil pretending to be an answer.
		if v := sup.route.get(args.Host, nowMillis()); v != nil {
			return ack{ID: msg.ID, Type: "ack", OK: true, Data: v}
		}
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: nil}
	case "diagnostics":
		// One round trip for a problem report: versions, core paths, the adapter
		// binding and the helper's own recent stderr. Read-only, and it carries
		// nothing about the servers the user configured.
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: sup.diagnostics()}
	case "interfaces":
		// The picker's source: every adapter that could carry traffic, plus what
		// "auto" resolves to right now, so the UI can label the automatic choice.
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: map[string]any{
			"interfaces": listInterfaces(),
			"auto":       defaultPhysicalInterface(),
		}}
	case "ping":
		// corePort is the port a running core listens on, 0 when none runs under
		// this helper. The extension needs the difference: a helper that answers
		// while holding no core means the stored "connected" state is a lie.
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: map[string]any{
			"pong":     "ok",
			"corePort": sup.currentPort(),
		}}
	case "start":
		var args startArgs
		if err := json.Unmarshal(msg.Raw, &args); err != nil {
			return errAck(msg.ID, fmt.Errorf("decode start: %w", err))
		}
		if len(args.Config) == 0 {
			return errAck(msg.ID, fmt.Errorf("start: missing config"))
		}
		core, err := coreByID(args.Core)
		if err != nil {
			return errAck(msg.ID, err)
		}
		raw, err := decodeConfig(core, args.Config)
		if err != nil {
			return errAck(msg.ID, err)
		}
		sup.setBindPref(args.BindInterface)
		port, err := sup.start(core, raw)
		if err != nil {
			logger.Printf("start failed: %v", err)
			return errAck(msg.ID, err)
		}
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: map[string]int{"socksPort": port}}
	case "stop":
		sup.stop()
		return ack{ID: msg.ID, Type: "ack", OK: true}
	case "reload":
		var args startArgs
		if err := json.Unmarshal(msg.Raw, &args); err != nil {
			return errAck(msg.ID, fmt.Errorf("decode reload: %w", err))
		}
		core, err := coreByID(args.Core)
		if err != nil {
			return errAck(msg.ID, err)
		}
		raw, err := decodeConfig(core, args.Config)
		if err != nil {
			return errAck(msg.ID, err)
		}
		sup.setBindPref(args.BindInterface)
		port, err := sup.reload(core, raw)
		if err != nil {
			logger.Printf("reload failed: %v", err)
			return errAck(msg.ID, err)
		}
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: map[string]int{"socksPort": port}}
	case "stats":
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: sup.statsSnapshot()}
	case "probe":
		var args probeArgs
		if err := json.Unmarshal(msg.Raw, &args); err != nil {
			return errAck(msg.ID, fmt.Errorf("decode probe: %w", err))
		}
		result, err := doProbe(args)
		if err != nil {
			return errAck(msg.ID, err)
		}
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: result}
	case "fetch":
		var args fetchArgs
		if err := json.Unmarshal(msg.Raw, &args); err != nil {
			return errAck(msg.ID, fmt.Errorf("decode fetch: %w", err))
		}
		result, err := doFetch(args, sup.currentPort())
		if err != nil {
			logger.Printf("fetch failed: %v", err)
			return errAck(msg.ID, err)
		}
		return ack{ID: msg.ID, Type: "ack", OK: true, Data: result}
	default:
		return ack{
			ID:    msg.ID,
			Type:  "ack",
			OK:    false,
			Error: fmt.Sprintf("unknown type: %q", msg.Type),
		}
	}
}

func errAck(id string, err error) ack {
	return ack{ID: id, Type: "ack", OK: false, Error: err.Error()}
}
