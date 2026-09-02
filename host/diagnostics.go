package main

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// The helper's stderr is the browser's business, not the user's: Chrome writes
// it to a log nobody opens. Keeping the last lines in memory is what lets the
// extension's problem report carry them — "bind_interface=... not applied" and
// "dropped inbound frame" are exactly the lines that explain a report, and
// exactly the ones nobody could reach.
const stderrRingSize = 100

type lineRing struct {
	mu    sync.Mutex
	buf   bytes.Buffer
	lines []string
	max   int
}

func newLineRing(max int) *lineRing { return &lineRing{max: max} }

// Write splits on newlines and keeps the last `max` complete lines. A partial
// line waits for its terminator, so a log call that arrives in two writes is
// one entry and not two.
func (r *lineRing) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buf.Write(p)
	for {
		idx := bytes.IndexByte(r.buf.Bytes(), '\n')
		if idx < 0 {
			// Bound the pending fragment the same way logPipe does, so a writer
			// that never terminates a line cannot grow this without limit.
			if r.buf.Len() > maxLogLine {
				r.push(string(r.buf.Bytes()[:maxLogLine]))
				r.buf.Next(maxLogLine)
				continue
			}
			break
		}
		r.push(string(r.buf.Bytes()[:idx]))
		r.buf.Next(idx + 1)
	}
	return len(p), nil
}

func (r *lineRing) push(line string) {
	line = strings.TrimRight(line, "\r")
	r.lines = append(r.lines, line)
	if len(r.lines) > r.max {
		r.lines = r.lines[len(r.lines)-r.max:]
	}
}

func (r *lineRing) snapshot() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]string(nil), r.lines...)
}

// helperStderr is where every line the helper writes about itself goes: the
// real stderr, so the browser's log still has it, and the ring the extension
// can ask for.
//
// os.Stderr is read per write rather than captured once, because it is a
// variable: the test harness swaps it for a pipe, and a writer bound at init
// would keep writing to the descriptor the process started with.
type teeStderr struct{ ring *lineRing }

func (t teeStderr) Write(p []byte) (int, error) {
	_, _ = t.ring.Write(p)
	return os.Stderr.Write(p)
}

var (
	helperLogRing           = newLineRing(stderrRingSize)
	helperStderr  io.Writer = teeStderr{ring: helperLogRing}
)

// startedAt is the helper's own start, reported so a report can tell a helper
// the browser has just respawned from one that has been up for hours — the
// difference between "it never worked" and "it stopped working".
var startedAt = time.Now()

// coreDiagnostic is one engine as the helper sees it: whether it can be
// launched at all, from where, and at what version. `available: false` with a
// path is impossible; `available: true` with an empty version means the probe
// had not finished.
type coreDiagnostic struct {
	ID        string `json:"id"`
	Available bool   `json:"available"`
	Path      string `json:"path,omitempty"`
	Version   string `json:"version,omitempty"`
	Error     string `json:"error,omitempty"`
}

// diagnostics is everything the helper knows about its own installation, in one
// round trip. Assembled for a user's problem report, so it names paths and
// versions but never touches a proxy config: what the user routes where is not
// ours to hand to a bug tracker.
func (s *supervisor) diagnostics() map[string]any {
	cores := make([]coreDiagnostic, 0, len(coreOrder))
	for _, id := range coreOrder {
		c, ok := registeredCore(id)
		if !ok {
			continue
		}
		d := coreDiagnostic{ID: id}
		path, err := c.Locate()
		if err != nil {
			d.Error = err.Error()
		} else {
			d.Available = true
			d.Path = path
			// Cached by now in the common case; a cold probe is worth the wait
			// here, where the whole point is an accurate picture.
			d.Version = coreVersion(c)
		}
		cores = append(cores, d)
	}

	s.mu.Lock()
	pref := s.bindPref
	port := s.port
	running := s.cmd != nil
	sessionStart := s.sessionStart
	s.mu.Unlock()

	var sessionMs int64
	if running && !sessionStart.IsZero() {
		sessionMs = time.Since(sessionStart).Milliseconds()
	}

	exe, _ := osExecutable()
	return map[string]any{
		"version":    hostVersion,
		"platform":   runtime.GOOS + "-" + runtime.GOARCH,
		"uptimeMs":   time.Since(startedAt).Milliseconds(),
		"installDir": filepath.Dir(exe),
		"configDir":  filepath.Join(os.TempDir(), "noctis"),
		"cores":      cores,
		"bindInterface": map[string]any{
			"preference": pref,
			"resolved":   resolveBindInterface(pref),
		},
		"core": map[string]any{
			"running":   running,
			"socksPort": port,
			"sessionMs": sessionMs,
		},
		"stderr": helperLogRing.snapshot(),
	}
}

// registeredCore reads the registry without the "unknown core" error coreByID
// returns; diagnostics walks a fixed order and skips what is not registered.
func registeredCore(id string) (Core, bool) {
	c, ok := cores[id]
	return c, ok
}
