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
)

// Multi-core helper: hello reports `cores` (+ per-core versions). The extension
// treats a missing `cores` field in the hello ack as a pre-multi-core helper.
var hostVersion = "1.2.2"

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

func (s *sender) send(payload any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := writeFrame(s.out, payload); err != nil {
		return err
	}
	return s.out.Flush()
}

func main() {
	logger := log.New(os.Stderr, "noctis-host ", log.LstdFlags|log.Lmicroseconds)
	logger.Printf("starting v%s on %s/%s", hostVersion, runtime.GOOS, runtime.GOARCH)

	// Leftovers from sessions that are gone; harmless but they accumulate.
	reapStaleConfigs()

	in := bufio.NewReaderSize(os.Stdin, 64*1024)
	out := bufio.NewWriterSize(os.Stdout, 64*1024)
	defer out.Flush()

	var writeMu sync.Mutex
	snd := &sender{out: out, mu: &writeMu}

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

	for {
		raw, err := readFrame(in)
		if err != nil {
			if err == io.EOF {
				logger.Print("stdin closed, stopping")
				sup.stop()
				return
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
		response := dispatch(&msg, sup, logger)
		if err := snd.send(response); err != nil {
			logger.Printf("write error: %v", err)
			sup.stop()
			return
		}
	}
}

type startArgs struct {
	Core   string          `json:"core"`
	Config json.RawMessage `json:"config"`
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
				"bindInterface": defaultPhysicalInterface(),
				// Capabilities added after 1.1.2, advertised for future use. The
				// extension gates on the host version instead (helper-compat.ts):
				// a helper without "fetch" reads as outdated, not incompatible.
				"features": []string{"fetch", "route"},
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
