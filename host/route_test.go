package main

import (
	"io"
	"log"
	"strconv"
	"strings"
	"testing"
)

// Lines are verbatim samples captured from each core running locally; the ANSI
// colour codes sing-box emits are included on purpose.
const (
	sbInbound  = "\x1b[36mINFO\x1b[0m[0001] [2418462885 0ms] inbound/mixed[in]: inbound connection to blocked.example:80"
	sbReject   = "\x1b[35mDEBUG\x1b[0m[0001] [2418462885 0ms] router: match[0] domain_suffix=blocked.example => reject"
	sbInbound2 = "INFO[0001] [612569992 0ms] inbound/mixed[in]: inbound connection to 2ip.ru:443"
	sbDirect   = "INFO[0001] [612569992 0ms] outbound/direct[direct]: outbound connection to 2ip.ru:443"
	sbProxied  = "INFO[0001] [612569992 0ms] outbound/vless[proxy]: outbound connection to 2ip.ru:443"

	xrayHit    = "2026/08/19 15:20:55 [Info] [1907051610] app/dispatcher: Hit route rule: [geosite:category-ads] so taking detour [blocked] for [tcp:blocked.example:80]"
	xrayDetour = "2026/08/19 15:20:35 [Info] [2552730573] app/dispatcher: taking detour [direct] for [tcp:2ip.ru:443]"
	xrayProxy  = "2026/08/19 15:20:35 [Info] [2552730573] app/dispatcher: taking detour [proxy] for [tcp:2ip.ru:443]"

	mihomoReject = `time="2026-08-19T15:21:14+03:00" level=info msg="[TCP] 127.0.0.1:52262 --> blocked.example:80 match DomainSuffix(blocked.example) using REJECT"`
	mihomoDirect = `time="2026-08-19T15:21:14+03:00" level=info msg="[TCP] 127.0.0.1:52263 --> 2ip.ru:443 match Match using DIRECT"`
	mihomoProxy  = `time="2026-08-19T15:21:14+03:00" level=info msg="[TCP] 127.0.0.1:52264 --> 2ip.ru:443 match GeoSite(geolocation-!cn) using 🇩🇪 Germany"`
)

func TestRouteJournalSingBox(t *testing.T) {
	j := newRouteJournal()

	// sing-box needs two lines glued by connection id: the host arrives first,
	// the verdict second.
	j.consume("sing-box", sbInbound, 1_000)
	if v := j.get("blocked.example", 1_000); v != nil {
		t.Fatalf("verdict before the router line: %+v", v)
	}
	j.consume("sing-box", sbReject, 1_100)
	v := j.get("blocked.example", 1_100)
	if v == nil || v.Verdict != "block" || v.Rule != "domain_suffix=blocked.example" {
		t.Fatalf("reject verdict = %+v", v)
	}

	j.consume("sing-box", sbInbound2, 2_000)
	j.consume("sing-box", sbDirect, 2_000)
	if v := j.get("2ip.ru", 2_000); v == nil || v.Verdict != "direct" {
		t.Fatalf("direct verdict = %+v", v)
	}

	j.consume("sing-box", sbProxied, 2_100)
	if v := j.get("2ip.ru", 2_100); v == nil || v.Verdict != "proxy" {
		t.Fatalf("proxy verdict = %+v", v)
	}
}

func TestRouteJournalXray(t *testing.T) {
	j := newRouteJournal()

	j.consume("xray", xrayHit, 1_000)
	v := j.get("blocked.example", 1_000)
	if v == nil || v.Verdict != "block" || v.Rule != "geosite:category-ads" {
		t.Fatalf("hit verdict = %+v", v)
	}

	// Without a ruleTag xray still names the outbound it chose.
	j.consume("xray", xrayDetour, 1_000)
	if v := j.get("2ip.ru", 1_000); v == nil || v.Verdict != "direct" || v.Rule != "" {
		t.Fatalf("detour verdict = %+v", v)
	}
	j.consume("xray", xrayProxy, 1_100)
	if v := j.get("2ip.ru", 1_100); v == nil || v.Verdict != "proxy" {
		t.Fatalf("proxy verdict = %+v", v)
	}
}

func TestRouteJournalMihomo(t *testing.T) {
	j := newRouteJournal()

	j.consume("mihomo", mihomoReject, 1_000)
	v := j.get("blocked.example", 1_000)
	if v == nil || v.Verdict != "block" || v.Rule != "DomainSuffix(blocked.example)" {
		t.Fatalf("reject verdict = %+v", v)
	}

	j.consume("mihomo", mihomoDirect, 1_000)
	if v := j.get("2ip.ru", 1_000); v == nil || v.Verdict != "direct" {
		t.Fatalf("direct verdict = %+v", v)
	}

	// Any outbound that is neither DIRECT nor REJECT is the tunnel.
	j.consume("mihomo", mihomoProxy, 1_100)
	if v := j.get("2ip.ru", 1_100); v == nil || v.Verdict != "proxy" || v.Rule != "GeoSite(geolocation-!cn)" {
		t.Fatalf("proxy verdict = %+v", v)
	}
}

func TestRouteJournalIgnoresNoise(t *testing.T) {
	j := newRouteJournal()
	for _, line := range []string{
		"INFO[0000] sing-box started (0.00s)",
		"INFO[0000] clash-api: restful api listening at 127.0.0.1:19081",
		`time="2026-08-19T15:21:11+03:00" level=info msg="Sniffer is closed"`,
		"2026/08/19 15:20:33 [Warning] core: Xray 26.3.27 started",
		"",
	} {
		j.consume("sing-box", line, 1)
		j.consume("xray", line, 1)
		j.consume("mihomo", line, 1)
	}
	if n := j.size(); n != 0 {
		t.Fatalf("journal grew on noise: %d", n)
	}
}

func TestRouteJournalForgetsOldVerdicts(t *testing.T) {
	j := newRouteJournal()
	j.consume("mihomo", mihomoDirect, 1_000)
	if v := j.get("2ip.ru", 1_000+routeTTLMillis); v == nil {
		t.Fatal("verdict expired exactly at the TTL")
	}
	if v := j.get("2ip.ru", 1_000+routeTTLMillis+1); v != nil {
		t.Fatalf("stale verdict served: %+v", v)
	}
}

func TestRouteJournalBounded(t *testing.T) {
	j := newRouteJournal()
	for i := range routeJournalCap + 50 {
		j.consume("xray", xrayDetourFor(i), int64(1_000+i))
	}
	if n := j.size(); n > routeJournalCap {
		t.Fatalf("journal size %d exceeds cap %d", n, routeJournalCap)
	}
	// The newest host survives the pruning; the oldest does not.
	if v := j.get("h0.example", int64(1_000+routeJournalCap+50)); v != nil {
		t.Fatal("oldest verdict outlived the cap")
	}
	last := routeJournalCap + 49
	if v := j.get(hostFor(last), int64(1_000+last)); v == nil {
		t.Fatal("newest verdict was pruned")
	}
}

// Only sing-box needs its debug chatter kept out of the user-visible log; every
// other line the cores print still belongs there.
func TestRouteLineHidden(t *testing.T) {
	if !routeLineHidden("sing-box", sbReject) {
		t.Fatal("sing-box router debug line should not reach the log")
	}
	if routeLineHidden("sing-box", sbInbound) {
		t.Fatal("sing-box inbound line belongs in the log")
	}
	if routeLineHidden("xray", xrayHit) || routeLineHidden("mihomo", mihomoReject) {
		t.Fatal("info-level route lines belong in the log")
	}
}

func hostFor(i int) string {
	return "h" + strconv.Itoa(i) + ".example"
}

func xrayDetourFor(i int) string {
	return "2026/08/19 15:20:35 [Info] [1] app/dispatcher: taking detour [direct] for [tcp:" + hostFor(i) + ":443]"
}

func TestLogPipeFeedsJournalAndFiltersDebug(t *testing.T) {
	var lines []string
	notify := func(event string, payload any) {
		if event != "log" {
			return
		}
		p := payload.(map[string]any)
		lines = append(lines, p["line"].(string))
	}
	j := newRouteJournal()
	p := newLogPipe(notify, "stdout")
	p.route = j
	p.coreID = "sing-box"

	if _, err := p.Write([]byte(sbInbound + "\n" + sbReject + "\n")); err != nil {
		t.Fatal(err)
	}
	// The host line reaches the log, the debug line that carries the verdict
	// does not, and the verdict is recorded either way.
	if len(lines) != 1 || !strings.Contains(lines[0], "inbound connection to blocked.example:80") {
		t.Fatalf("forwarded lines = %#v", lines)
	}
	if v := j.get("blocked.example", nowMillis()); v == nil || v.Verdict != "block" {
		t.Fatalf("verdict = %+v", v)
	}
}

func TestDispatchRouteVerdict(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	sup := newSupervisor(nil)
	sup.route.consume("mihomo", mihomoReject, nowMillis())

	a := dispatch(msgFor(t, `{"id":"1","type":"route-verdict","host":"blocked.example"}`), sup, lg)
	if !a.OK {
		t.Fatalf("ack = %+v", a)
	}
	v, ok := a.Data.(*RouteVerdict)
	if !ok || v.Verdict != "block" || v.Rule != "DomainSuffix(blocked.example)" {
		t.Fatalf("data = %#v", a.Data)
	}

	// A host nobody routed is a null answer, not an error: the extension must be
	// able to tell "no verdict" from "the helper broke".
	a = dispatch(msgFor(t, `{"id":"2","type":"route-verdict","host":"never.seen"}`), sup, lg)
	if !a.OK || a.Data != nil {
		t.Fatalf("unknown host ack = %+v", a)
	}

	a = dispatch(msgFor(t, `{"id":"3","type":"route-verdict"}`), sup, lg)
	if a.OK || !strings.Contains(a.Error, "host or hosts") {
		t.Fatalf("missing host ack = %+v", a)
	}
}

func TestHelloAdvertisesRouteFeature(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	a := dispatch(msgFor(t, `{"id":"1","type":"hello"}`), newSupervisor(nil), lg)
	data := a.Data.(map[string]any)
	feats, _ := data["features"].([]string)
	var found bool
	for _, f := range feats {
		if f == "route" {
			found = true
		}
	}
	if !found {
		t.Fatalf("features = %#v", feats)
	}
}

func TestRouteJournalEdges(t *testing.T) {
	j := newRouteJournal()

	// A router line whose connection id was never announced has no host to
	// attach the verdict to.
	j.consume("sing-box", "DEBUG[0001] [999 0ms] router: match[0] domain_suffix=x.example => reject", 1)
	if j.size() != 0 {
		t.Fatal("verdict recorded without a host")
	}

	// Neither an empty host nor an empty verdict is a verdict.
	j.put("", "direct", "", 1)
	j.put("h.example", "", "", 1)
	if j.size() != 0 {
		t.Fatalf("journal = %d entries", j.size())
	}

	// The same connection id announced twice keeps the newer host.
	j.consume("sing-box", "INFO[0001] [7 0ms] inbound/mixed[in]: inbound connection to first.example:80", 1)
	j.consume("sing-box", "INFO[0001] [7 0ms] inbound/mixed[in]: inbound connection to second.example:80", 1)
	j.consume("sing-box", "DEBUG[0001] [7 0ms] router: match[1] domain_suffix=second.example => direct", 1)
	if v := j.get("second.example", 1); v == nil || v.Verdict != "direct" {
		t.Fatalf("second host verdict = %+v", v)
	}
	if v := j.get("first.example", 1); v != nil {
		t.Fatalf("stale pending host got a verdict: %+v", v)
	}
}

func TestRouteJournalPendingBounded(t *testing.T) {
	j := newRouteJournal()
	for i := range routeJournalCap + 10 {
		id := strconv.Itoa(i)
		j.consume("sing-box", "INFO[0001] ["+id+" 0ms] inbound/mixed[in]: inbound connection to "+hostFor(i)+":80", 1)
	}
	// The oldest ids are dropped, so a late decision line for them finds nothing.
	j.consume("sing-box", "DEBUG[0001] [0 0ms] router: match[0] domain_suffix=x => reject", 1)
	if v := j.get("h0.example", 1); v != nil {
		t.Fatalf("dropped pending id still resolved: %+v", v)
	}
	j.consume("sing-box", "DEBUG[0001] ["+strconv.Itoa(routeJournalCap+9)+" 0ms] router: match[0] domain_suffix=y => reject", 1)
	if v := j.get(hostFor(routeJournalCap+9), 1); v == nil {
		t.Fatal("newest pending id was dropped")
	}
}

func TestDispatchRouteVerdictRejectsMalformedArgs(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	a := dispatch(msgFor(t, `{"id":"1","type":"route-verdict","host":5}`), newSupervisor(nil), lg)
	if a.OK || !strings.Contains(a.Error, "decode route-verdict") {
		t.Fatalf("ack = %+v", a)
	}
}

func TestRouteJournalKeepsRuleAcrossLinesWithoutOne(t *testing.T) {
	j := newRouteJournal()
	// mihomo names the rule; a later line for the same host and the same verdict
	// carries no name and must not erase it.
	j.consume("mihomo", mihomoProxy, 1_000)
	j.consume("xray", xrayProxy, 1_100)
	v := j.get("2ip.ru", 1_100)
	if v == nil || v.Verdict != "proxy" || v.Rule != "GeoSite(geolocation-!cn)" {
		t.Fatalf("verdict = %+v", v)
	}
	// A different verdict replaces the rule instead of inheriting it.
	j.consume("xray", xrayDetour, 1_200)
	if v := j.get("2ip.ru", 1_200); v == nil || v.Verdict != "direct" || v.Rule != "" {
		t.Fatalf("verdict after direct = %+v", v)
	}
}

func TestDispatchRouteVerdictBulk(t *testing.T) {
	lg := log.New(io.Discard, "", 0)
	sup := newSupervisor(nil)
	sup.route.consume("mihomo", mihomoReject, nowMillis())
	sup.route.consume("mihomo", mihomoDirect, nowMillis())

	// The badge asks about every open tab at once; one round trip answers all of
	// them, and hosts with no verdict are simply absent from the map.
	a := dispatch(msgFor(t, `{"id":"1","type":"route-verdict","hosts":["blocked.example","2ip.ru","never.seen"]}`), sup, lg)
	if !a.OK {
		t.Fatalf("ack = %+v", a)
	}
	m, ok := a.Data.(map[string]*RouteVerdict)
	if !ok {
		t.Fatalf("data = %#v", a.Data)
	}
	if len(m) != 2 {
		t.Fatalf("map = %#v", m)
	}
	if m["blocked.example"].Verdict != "block" || m["2ip.ru"].Verdict != "direct" {
		t.Fatalf("verdicts = %+v / %+v", m["blocked.example"], m["2ip.ru"])
	}
	if _, present := m["never.seen"]; present {
		t.Fatal("unknown host got an entry")
	}

	// An empty list is a valid question with an empty answer, not an error.
	a = dispatch(msgFor(t, `{"id":"2","type":"route-verdict","hosts":[]}`), sup, lg)
	if !a.OK {
		t.Fatalf("empty hosts ack = %+v", a)
	}
	if m, ok := a.Data.(map[string]*RouteVerdict); !ok || len(m) != 0 {
		t.Fatalf("empty hosts data = %#v", a.Data)
	}
}
