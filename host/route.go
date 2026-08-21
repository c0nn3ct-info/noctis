package main

import (
	"regexp"
	"strings"
	"sync"
	"time"
)

// Why a journal at all: the browser only learns that a navigation failed, never
// why. The core knows — it applied the rule — but says so only in its log. The
// helper reads that log anyway, so it keeps the last verdict per host and hands
// it to the extension on request. That turns "the page may be blocked by a rule"
// into a fact, and keeps the interstitial away from failures nobody caused.
//
// Verdicts are short-lived on purpose: they answer a question the browser asks
// seconds after the fact, and holding a longer history of visited hosts in the
// helper would be a privacy cost with no user benefit.
const (
	routeTTLMillis  = 60_000
	routeJournalCap = 200
)

// RouteVerdict is what the extension gets back for a host.
//
//	direct — the core sent it out on the real connection
//	proxy  — the core sent it through the tunnel
//	block  — a rule inside the core rejected it
type RouteVerdict struct {
	Host    string `json:"host"`
	Verdict string `json:"verdict"`
	Rule    string `json:"rule"`
	TS      int64  `json:"ts"`
}

// nowMillis is the journal's clock: verdicts are matched against a browser
// question that arrives seconds later, so millisecond wall time is enough.
func nowMillis() int64 {
	return time.Now().UnixMilli()
}

var ansiRe = regexp.MustCompile(`\x1b\[[0-9;]*m`)

// sing-box splits the story across two lines glued by connection id: the host
// arrives on the inbound line, the decision on the router (debug) or outbound
// line. Everything else has host and decision on one line.
var (
	sbInboundRe  = regexp.MustCompile(`\[(\d+) [^\]]*\] inbound/[^:]+: inbound connection to (\S+):(\d+)$`)
	sbRouterRe   = regexp.MustCompile(`\[(\d+) [^\]]*\] router: match\[\d+\] (.+) => (\S+)$`)
	sbOutboundRe = regexp.MustCompile(`\[(\d+) [^\]]*\] outbound/[^\[]+\[([^\]]+)\]: outbound connection to (\S+):(\d+)$`)

	xrayHitRe    = regexp.MustCompile(`Hit route rule: \[([^\]]*)\] so taking detour \[([^\]]+)\] for \[\w+:(\S+):(\d+)\]`)
	xrayDetourRe = regexp.MustCompile(`taking detour \[([^\]]+)\] for \[\w+:(\S+):(\d+)\]`)

	mihomoRe = regexp.MustCompile(`\[(?:TCP|UDP)\] \S+ --> (\S+):(\d+) match (.+) using (.+?)"?$`)
)

type routeJournal struct {
	mu      sync.Mutex
	entries map[string]RouteVerdict
	order   []string
	// sing-box connection id -> host, waiting for the decision line.
	pending map[string]string
	pendOrd []string
}

func newRouteJournal() *routeJournal {
	return &routeJournal{
		entries: make(map[string]RouteVerdict),
		pending: make(map[string]string),
	}
}

func (j *routeJournal) size() int {
	j.mu.Lock()
	defer j.mu.Unlock()
	return len(j.entries)
}

func (j *routeJournal) get(host string, now int64) *RouteVerdict {
	j.mu.Lock()
	defer j.mu.Unlock()
	v, ok := j.entries[host]
	if !ok {
		return nil
	}
	if now-v.TS > routeTTLMillis {
		delete(j.entries, host)
		return nil
	}
	out := v
	return &out
}

// consume feeds one log line to the journal. Unknown lines are ignored, so the
// cores can grow new messages without breaking anything here.
func (j *routeJournal) consume(coreID, line string, now int64) {
	line = strings.TrimRight(ansiRe.ReplaceAllString(line, ""), "\r\n ")
	if line == "" {
		return
	}
	switch coreID {
	case "sing-box":
		j.consumeSingBox(line, now)
	case "xray":
		j.consumeXray(line, now)
	case "mihomo":
		j.consumeMihomo(line, now)
	}
}

func (j *routeJournal) consumeSingBox(line string, now int64) {
	if m := sbInboundRe.FindStringSubmatch(line); m != nil {
		j.rememberPending(m[1], m[2])
		return
	}
	if m := sbRouterRe.FindStringSubmatch(line); m != nil {
		host := j.takePending(m[1])
		if host == "" {
			return
		}
		j.put(host, verdictForTag(m[3]), strings.TrimSpace(m[2]), now)
		return
	}
	if m := sbOutboundRe.FindStringSubmatch(line); m != nil {
		j.put(m[3], verdictForTag(m[2]), "", now)
	}
}

func (j *routeJournal) consumeXray(line string, now int64) {
	if m := xrayHitRe.FindStringSubmatch(line); m != nil {
		j.put(m[3], verdictForTag(m[2]), m[1], now)
		return
	}
	if m := xrayDetourRe.FindStringSubmatch(line); m != nil {
		j.put(m[2], verdictForTag(m[1]), "", now)
	}
}

func (j *routeJournal) consumeMihomo(line string, now int64) {
	m := mihomoRe.FindStringSubmatch(line)
	if m == nil {
		return
	}
	j.put(m[1], verdictForTag(strings.TrimSpace(m[4])), strings.TrimSpace(m[3]), now)
}

// verdictForTag maps whatever the core calls its outbound onto the three answers
// the extension can act on. Tags come from our own generated configs (direct /
// proxy / block) and from mihomo's built-ins (DIRECT / REJECT), but a
// subscription can name a proxy group anything, so anything unrecognised is the
// tunnel — that is where a named outbound sends traffic.
func verdictForTag(tag string) string {
	switch strings.ToLower(strings.Trim(tag, "[]")) {
	case "direct", "freedom", "bypass":
		return "direct"
	case "reject", "block", "blocked", "blackhole", "reject-drop", "reject-tinygif":
		return "block"
	default:
		return "proxy"
	}
}

func (j *routeJournal) put(host, verdict, rule string, now int64) {
	if host == "" || verdict == "" {
		return
	}
	j.mu.Lock()
	defer j.mu.Unlock()
	// A decision line without a rule name must not erase the name an earlier
	// line for the same host and the same verdict already gave.
	if rule == "" {
		if prev, ok := j.entries[host]; ok && prev.Verdict == verdict && prev.Rule != "" {
			rule = prev.Rule
		}
	}
	if _, seen := j.entries[host]; !seen {
		j.order = append(j.order, host)
	}
	j.entries[host] = RouteVerdict{Host: host, Verdict: verdict, Rule: rule, TS: now}
	for len(j.entries) > routeJournalCap && len(j.order) > 0 {
		oldest := j.order[0]
		j.order = j.order[1:]
		delete(j.entries, oldest)
	}
}

func (j *routeJournal) rememberPending(id, host string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if _, seen := j.pending[id]; !seen {
		j.pendOrd = append(j.pendOrd, id)
	}
	j.pending[id] = host
	// Connections whose decision line never arrived (rejected before routing,
	// closed mid-handshake) would otherwise pile up forever.
	for len(j.pending) > routeJournalCap && len(j.pendOrd) > 0 {
		oldest := j.pendOrd[0]
		j.pendOrd = j.pendOrd[1:]
		delete(j.pending, oldest)
	}
}

func (j *routeJournal) takePending(id string) string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.pending[id]
}

// routeLineHidden keeps the user-visible log looking like it did before the
// route journal needed sing-box at debug level. Only sing-box debug lines are
// held back; every core's info and above still reaches the extension.
func routeLineHidden(coreID, line string) bool {
	if coreID != "sing-box" {
		return false
	}
	return strings.HasPrefix(ansiRe.ReplaceAllString(line, ""), "DEBUG")
}
