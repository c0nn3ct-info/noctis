package main

import (
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"
)

// A core that cannot start says why on its own output and exits: sing-box with
// "FATAL ... start service: initialize rule-set ...", xray with "Failed to
// start: ...". Waiting out the bind timeout after that, then reporting only
// that the port never opened, put a generic line in front of the user and left
// the reason in a log few people open. A start is a race of three outcomes --
// the port opens, the process exits, the clock runs out -- and the two
// failures carry the core's own words.

// coreBindTimeout is how long a started core gets to open its SOCKS port. A var
// so tests can shorten it.
var coreBindTimeout = 5 * time.Second

// startTailLines is how many of the core's last lines a failed start can quote
// from.
const startTailLines = 64

// maxFailureLine caps the quoted line: a rule-set failure lists every rule-set
// that failed, and the message travels to a toast.
const maxFailureLine = 600

var errCoreExited = errors.New("core exited")

// waitReady returns nil once port accepts a connection, errCoreExited as soon
// as exited closes, or a timeout error.
func waitReady(port int, timeout time.Duration, exited <-chan struct{}) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	for {
		select {
		case <-exited:
			return errCoreExited
		default:
		}
		c, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = c.Close()
			return nil
		}
		if !time.Now().Before(deadline) {
			return fmt.Errorf("port %d not ready after %s", port, timeout)
		}
		select {
		case <-exited:
			return errCoreExited
		case <-time.After(80 * time.Millisecond):
		}
	}
}

// startFailure words a failed start. "did not bind socks" stays at the front:
// extensions up to 1.6.0 recognise a start failure by it and offer a report.
func startFailure(coreID string, err error, lines []string) error {
	line := failureLine(lines)
	if errors.Is(err, errCoreExited) {
		if line == "" {
			line = "no output"
		}
		return fmt.Errorf("%s did not bind socks: exited: %s", coreID, line)
	}
	if line != "" {
		return fmt.Errorf("%s did not bind socks: %v; last log line: %s", coreID, err, line)
	}
	return fmt.Errorf("%s did not bind socks: %v", coreID, err)
}

var (
	// sing-box's "FATAL[0000] ", xray's "2026/10/08 07:57:44.949577 [Error] "
	// and mihomo's `time="..." level=error msg="..."` prefixes.
	logPrefixRe = regexp.MustCompile(`^(?:[A-Z]+\[\d+\]\s*|\d{4}/\d\d/\d\d \d\d:\d\d:\d\d(?:\.\d+)?\s*(?:\[\w+\]\s*)?)`)
	mihomoMsgRe = regexp.MustCompile(`level=(\w+) msg="((?:[^"\\]|\\.)*)"`)
	failureRe   = regexp.MustCompile(`(?i)\b(fatal|panic|error|failed)\b`)
)

// failureLine picks the line that says why: the last one naming a failure,
// else the last line at all, cleaned of colour codes and log prefixes.
func failureLine(lines []string) string {
	pick := ""
	for i := len(lines) - 1; i >= 0; i-- {
		l := cleanLogLine(lines[i])
		if l == "" {
			continue
		}
		if pick == "" {
			pick = l
		}
		if failureRe.MatchString(ansiRe.ReplaceAllString(lines[i], "")) {
			pick = l
			break
		}
	}
	if len(pick) > maxFailureLine {
		pick = pick[:maxFailureLine] + "…"
	}
	return pick
}

func cleanLogLine(l string) string {
	l = strings.TrimSpace(ansiRe.ReplaceAllString(l, ""))
	if m := mihomoMsgRe.FindStringSubmatch(l); m != nil {
		return strings.ReplaceAll(m[2], `\"`, `"`)
	}
	return strings.TrimSpace(logPrefixRe.ReplaceAllString(l, ""))
}

// lineTail is a ring of the last lines written to it.
type lineTail struct {
	mu    sync.Mutex
	max   int
	items []string
}

func newLineTail(max int) *lineTail { return &lineTail{max: max} }

func (t *lineTail) add(line string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.items = append(t.items, line)
	if len(t.items) > t.max {
		t.items = t.items[len(t.items)-t.max:]
	}
}

func (t *lineTail) lines() []string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]string(nil), t.items...)
}
