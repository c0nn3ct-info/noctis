package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"gopkg.in/yaml.v3"
)

// protoField encodes one length-delimited protobuf field.
func protoField(num int, payload []byte) []byte {
	out := []byte{byte(num<<3 | 2)}
	n := len(payload)
	for n >= 0x80 {
		out = append(out, byte(n)|0x80)
		n >>= 7
	}
	out = append(out, byte(n))
	return append(out, payload...)
}

// geoDat builds a minimal geosite.dat/geoip.dat: entries carrying a code (field
// 1) and a body field the reader has to skip.
func geoDat(codes ...string) []byte {
	var out []byte
	for _, c := range codes {
		entry := append(protoField(1, []byte(c)), protoField(2, []byte("body"))...)
		entry = append(entry, 0x18, 0x96, 0x01) // field 3, varint 150
		out = append(out, protoField(1, entry)...)
	}
	return out
}

func writeGeo(t *testing.T, dir string, site, ip []string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, "geosite.dat"), geoDat(site...), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "geoip.dat"), geoDat(ip...), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestReadGeoCodes(t *testing.T) {
	dir := t.TempDir()
	writeGeo(t, dir, []string{"CATEGORY-RU", "YOUTUBE"}, []string{"PRIVATE"})
	got, err := readGeoCodes(filepath.Join(dir, "geosite.dat"))
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, map[string]bool{"category-ru": true, "youtube": true}) {
		t.Fatalf("codes=%v", got)
	}
	if _, err := readGeoCodes(filepath.Join(dir, "missing.dat")); err == nil {
		t.Fatal("expected an error for a missing file")
	}
	bad := filepath.Join(dir, "bad.dat")
	os.WriteFile(bad, []byte{0x0a, 0x7f}, 0o644)
	if _, err := readGeoCodes(bad); err == nil {
		t.Fatal("expected an error for a truncated file")
	}
}

func TestLoadGeoFilterWithoutDatabasesKeepsEverything(t *testing.T) {
	f := loadGeoFilter(t.TempDir())
	if !f.known("geosite", "anything") || !f.known("geoip", "anything") {
		t.Fatal("a missing database must not prune anything")
	}
}

func TestXrayPruneUnknownGeo(t *testing.T) {
	dir := t.TempDir()
	writeGeo(t, dir, []string{"CATEGORY-RU", "YOUTUBE"}, []string{"PRIVATE"})
	raw := []byte(`{"routing":{"rules":[
		{"type":"field","domain":["geosite:torrent","geosite:win-spy"],"outboundTag":"block"},
		{"type":"field","domain":["geosite:youtube","geosite:Twitch-Ads","example.com"],"outboundTag":"proxy-out"},
		{"type":"field","domain":["geosite:category-ru@ads","ext:roscom.dat:whitelist"],"outboundTag":"direct"},
		{"type":"field","ip":["geoip:private","geoip:!direct"],"outboundTag":"direct"},
		{"type":"field","ip":["geoip:direct"],"port":"53","outboundTag":"direct"},
		{"type":"field","inboundTag":["socks-in"],"outboundTag":"proxy-out"}
	]}}`)
	out, dropped, err := xrayCore{}.PruneUnknownGeo(raw, loadGeoFilter(dir))
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Routing struct {
			Rules []map[string]any `json:"rules"`
		} `json:"routing"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	rules := doc.Routing.Rules
	// The all-unknown block rule is gone: with no matcher left it would match
	// every connection.
	if len(rules) != 5 {
		t.Fatalf("rules=%d %v", len(rules), rules)
	}
	if got := rules[0]["domain"]; !reflect.DeepEqual(got, []any{"geosite:youtube", "example.com"}) {
		t.Fatalf("proxy domains=%v", got)
	}
	if got := rules[1]["domain"]; !reflect.DeepEqual(got, []any{"geosite:category-ru@ads", "ext:roscom.dat:whitelist"}) {
		t.Fatalf("direct domains=%v", got)
	}
	if got := rules[2]["ip"]; !reflect.DeepEqual(got, []any{"geoip:private"}) {
		t.Fatalf("ips=%v", got)
	}
	// A rule that keeps another matcher survives without its ip list.
	if _, has := rules[3]["ip"]; has || rules[3]["port"] != "53" {
		t.Fatalf("port rule=%v", rules[3])
	}
	want := []string{"geoip:direct", "geosite:torrent", "geosite:twitch-ads", "geosite:win-spy"}
	if !reflect.DeepEqual(dropped, want) {
		t.Fatalf("dropped=%v", dropped)
	}
}

func TestXrayPruneUnknownGeoLeavesConfigWithoutRules(t *testing.T) {
	raw := []byte(`{"outbounds":[]}`)
	out, dropped, err := xrayCore{}.PruneUnknownGeo(raw, geoFilter{})
	if err != nil || string(out) != string(raw) || dropped != nil {
		t.Fatalf("out=%s dropped=%v err=%v", out, dropped, err)
	}
	if _, _, err := (xrayCore{}).PruneUnknownGeo([]byte("{"), geoFilter{}); err == nil {
		t.Fatal("expected a parse error")
	}
}

func TestMihomoPruneUnknownGeo(t *testing.T) {
	dir := t.TempDir()
	writeGeo(t, dir, []string{"CATEGORY-ADS"}, []string{"PRIVATE"})
	raw := []byte("mixed-port: 0\nrules:\n  - GEOSITE,torrent,REJECT\n  - GEOSITE,category-ads,REJECT\n  - GEOIP,direct,DIRECT,no-resolve\n  - GEOIP,private,DIRECT\n  - DOMAIN-SUFFIX,example.com,proxy-out\n  - MATCH,DIRECT\n")
	out, dropped, err := mihomoCore{}.PruneUnknownGeo(raw, loadGeoFilter(dir))
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Rules []string `yaml:"rules"`
	}
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	want := []string{"GEOSITE,category-ads,REJECT", "GEOIP,private,DIRECT", "DOMAIN-SUFFIX,example.com,proxy-out", "MATCH,DIRECT"}
	if !reflect.DeepEqual(doc.Rules, want) {
		t.Fatalf("rules=%v", doc.Rules)
	}
	if strings.Join(dropped, ",") != "geoip:direct,geosite:torrent" {
		t.Fatalf("dropped=%v", dropped)
	}
	unchanged, d2, err := mihomoCore{}.PruneUnknownGeo([]byte("rules:\n  - MATCH,DIRECT\n"), loadGeoFilter(dir))
	if err != nil || d2 != nil || !strings.Contains(string(unchanged), "MATCH,DIRECT") {
		t.Fatalf("out=%s dropped=%v err=%v", unchanged, d2, err)
	}
	if _, _, err := (mihomoCore{}).PruneUnknownGeo([]byte(":\n- ["), geoFilter{}); err == nil {
		t.Fatal("expected a parse error")
	}
}

func TestGeoDirs(t *testing.T) {
	if got := (mihomoCore{}).GeoDir("/opt/mihomo", "/tmp/data"); got != "/tmp/data" {
		t.Fatalf("mihomo geo dir=%s", got)
	}
	t.Setenv("XRAY_LOCATION_ASSET", "")
	if got := (xrayCore{}).GeoDir("/opt/noctis/xray", "/tmp/data"); got != "/opt/noctis" {
		t.Fatalf("xray geo dir=%s", got)
	}
	t.Setenv("XRAY_LOCATION_ASSET", "/assets")
	if got := (xrayCore{}).GeoDir("/opt/noctis/xray", "/tmp/data"); got != "/assets" {
		t.Fatalf("xray geo dir with env=%s", got)
	}
}

func TestSupervisorPruneUnknownGeo(t *testing.T) {
	dir := t.TempDir()
	writeGeo(t, dir, []string{"YOUTUBE"}, []string{"PRIVATE"})
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	raw := []byte(`{"routing":{"rules":[{"type":"field","domain":["geosite:torrent","geosite:youtube"],"outboundTag":"block"}]}}`)
	out := sup.pruneUnknownGeo(xrayCore{}, dir, raw)
	if strings.Contains(string(out), "torrent") || !strings.Contains(string(out), "youtube") {
		t.Fatalf("out=%s", out)
	}
	ev := waitEvent(t, events, "log", time.Second)
	if line := ev.payload.(map[string]any)["line"].(string); !strings.Contains(line, "geosite:torrent") {
		t.Fatalf("log line=%q", line)
	}

	// Cores without geo databases, and configs that do not parse, go out as-is.
	if got := sup.pruneUnknownGeo(singBoxCore{}, "", raw); string(got) != string(raw) {
		t.Fatalf("sing-box config changed: %s", got)
	}
	if got := sup.pruneUnknownGeo(xrayCore{}, dir, []byte("{")); string(got) != "{" {
		t.Fatalf("unparsable config changed: %s", got)
	}
}
