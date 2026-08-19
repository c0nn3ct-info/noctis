package main

import (
	"encoding/json"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestSingBoxInjectPortErrors(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.11.0")
	if _, err := (singBoxCore{}).InjectPort([]byte("nope"), 1); err == nil {
		t.Fatal("want json error")
	}
	if _, err := (singBoxCore{}).InjectPort([]byte(`{}`), 1); err == nil {
		t.Fatal("want missing-inbounds error")
	}
	// Non-map inbound entries are skipped; the socks map still gets patched.
	out, err := (singBoxCore{}).InjectPort([]byte(`{"inbounds":[5,{"type":"socks"}]}`), 777)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(out), "777") {
		t.Fatalf("port not injected: %s", out)
	}
}

func TestSingBoxInjectPortMigratesLegacyOnModernCore(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.13.13")
	legacy := []byte(`{
	  "inbounds":[{"type":"socks","listen":"127.0.0.1","listen_port":0,"sniff":true}],
	  "outbounds":[{"type":"vless","tag":"proxy-out"},{"type":"block","tag":"block"}]}`)
	out, err := (singBoxCore{}).InjectPort(legacy, 4242)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	ib := doc["inbounds"].([]any)[0].(map[string]any)
	if _, has := ib["sniff"]; has {
		t.Fatal("legacy config was not migrated on a >=1.12 core")
	}
	if int(ib["listen_port"].(float64)) != 4242 {
		t.Fatalf("listen_port = %v", ib["listen_port"])
	}
}

func TestSingBoxInjectBindInterfaceEdgeCases(t *testing.T) {
	if _, err := (singBoxCore{}).InjectBindInterface([]byte("nope"), "en0"); err == nil {
		t.Fatal("want json error")
	}
	// No outbounds: unchanged.
	raw := []byte(`{"route":{}}`)
	out, err := (singBoxCore{}).InjectBindInterface(raw, "en0")
	if err != nil || string(out) != string(raw) {
		t.Fatalf("out=%s err=%v", out, err)
	}
	// Non-map outbound entries are skipped.
	if _, err := (singBoxCore{}).InjectBindInterface([]byte(`{"outbounds":[5]}`), "en0"); err != nil {
		t.Fatal(err)
	}
}

func TestSingBoxInjectClashAPI(t *testing.T) {
	out, err := (singBoxCore{}).InjectClashAPI([]byte(`{}`), "127.0.0.1:9090", "s3cr3t")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	capi := doc["experimental"].(map[string]any)["clash_api"].(map[string]any)
	if capi["external_controller"] != "127.0.0.1:9090" || capi["secret"] != "s3cr3t" {
		t.Fatalf("clash_api = %#v", capi)
	}

	// Existing experimental section is preserved.
	out, err = (singBoxCore{}).InjectClashAPI([]byte(`{"experimental":{"other":true}}`), "a:1", "s")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	exp := doc["experimental"].(map[string]any)
	if exp["other"] != true || exp["clash_api"] == nil {
		t.Fatalf("experimental = %#v", exp)
	}

	if _, err := (singBoxCore{}).InjectClashAPI([]byte("nope"), "a:1", "s"); err == nil {
		t.Fatal("want json error")
	}
}

func TestSingBoxSupportsClashAPI(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.13.13")
	if !(singBoxCore{}).SupportsClashAPI() {
		t.Fatal("1.13 should support the Clash API")
	}
	versionCacheMu.Lock()
	versionCache["sing-box"] = "1.11.9"
	versionCacheMu.Unlock()
	if (singBoxCore{}).SupportsClashAPI() {
		t.Fatal("1.11 should not support the Clash API")
	}
}

func TestSingboxAtLeast(t *testing.T) {
	stashVersionCache(t)
	cases := []struct {
		version string
		want    bool
	}{
		{"", false},       // unknown version: stay legacy
		{"1", false},      // not enough parts
		{"x.y.z", false},  // unparseable
		{"1.x.0", false},  // minor unparseable
		{"1.11.9", false}, // below minimum
		{"1.12.0", true},  // exact minimum
		{"1.13.13", true}, // above
		{"2.0.0", true},   // newer major
		{"0.99.0", false}, // older major
	}
	for _, c := range cases {
		versionCacheMu.Lock()
		versionCache["sing-box"] = c.version
		versionCacheMu.Unlock()
		if got := singboxAtLeast(singBoxCore{}, 1, 12); got != c.want {
			t.Fatalf("singboxAtLeast(%q, 1, 12) = %v, want %v", c.version, got, c.want)
		}
	}
}

func TestXrayInjectPortErrors(t *testing.T) {
	if _, err := (xrayCore{}).InjectPort([]byte("nope"), 1); err == nil {
		t.Fatal("want json error")
	}
	if _, err := (xrayCore{}).InjectPort([]byte(`{}`), 1); err == nil {
		t.Fatal("want missing-inbounds error")
	}
	// Non-map entries skipped and nothing to patch: error.
	if _, err := (xrayCore{}).InjectPort([]byte(`{"inbounds":[5]}`), 1); err == nil {
		t.Fatal("want no-socks error")
	}
	// http inbound is also patched.
	out, err := (xrayCore{}).InjectPort([]byte(`{"inbounds":[{"protocol":"http"}]}`), 888)
	if err != nil || !strings.Contains(string(out), "888") {
		t.Fatalf("out=%s err=%v", out, err)
	}
}

func TestXrayClashAPI(t *testing.T) {
	if (xrayCore{}).SupportsClashAPI() {
		t.Fatal("xray has no Clash API")
	}
	raw := []byte(`{"x":1}`)
	out, err := (xrayCore{}).InjectClashAPI(raw, "a:1", "s")
	if err != nil || string(out) != string(raw) {
		t.Fatalf("InjectClashAPI should be a no-op: %s %v", out, err)
	}
}

func TestXrayInjectBindInterfaceEdgeCases(t *testing.T) {
	if _, err := (xrayCore{}).InjectBindInterface([]byte("nope"), "en0"); err == nil {
		t.Fatal("want json error")
	}
	raw := []byte(`{"routing":{}}`)
	out, err := (xrayCore{}).InjectBindInterface(raw, "en0")
	if err != nil || string(out) != string(raw) {
		t.Fatalf("no outbounds: %s %v", out, err)
	}
	if _, err := (xrayCore{}).InjectBindInterface([]byte(`{"outbounds":[5]}`), "en0"); err != nil {
		t.Fatal(err)
	}
	// Existing streamSettings/sockopt maps are reused, not replaced.
	out, err = (xrayCore{}).InjectBindInterface(
		[]byte(`{"outbounds":[{"protocol":"vless","streamSettings":{"network":"tcp","sockopt":{"mark":1}}}]}`), "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	ss := doc["outbounds"].([]any)[0].(map[string]any)["streamSettings"].(map[string]any)
	if ss["network"] != "tcp" {
		t.Fatalf("streamSettings replaced: %#v", ss)
	}
	sock := ss["sockopt"].(map[string]any)
	if sock["interface"] != "en0" || sock["mark"] == nil {
		t.Fatalf("sockopt = %#v", sock)
	}
	// Empty iface: no-op.
	out, err = (xrayCore{}).InjectBindInterface(raw, "")
	if err != nil || string(out) != string(raw) {
		t.Fatalf("empty iface: %s %v", out, err)
	}
}

func TestMihomoInjectPortVariants(t *testing.T) {
	if _, err := (mihomoCore{}).InjectPort([]byte("{"), 1); err == nil {
		t.Fatal("want yaml error")
	}
	if _, err := (mihomoCore{}).InjectPort([]byte("log-level: info\n"), 1); err == nil {
		t.Fatal("want no-listener error")
	}
	// Shorthand keys are honored.
	out, err := (mihomoCore{}).InjectPort([]byte("mixed-port: 0\nsocks-port: 0\nport: 0\n"), 999)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"mixed-port", "socks-port", "port"} {
		if doc[k] != 999 {
			t.Fatalf("%s = %v", k, doc[k])
		}
	}
	// Non-map listener entries alone: nothing patched.
	if _, err := (mihomoCore{}).InjectPort([]byte("listeners:\n  - 5\n"), 1); err == nil {
		t.Fatal("want no-listener error for non-map listeners")
	}
}

func TestMihomoClashAPI(t *testing.T) {
	if !(mihomoCore{}).SupportsClashAPI() {
		t.Fatal("mihomo always has a Clash API")
	}
	out, err := (mihomoCore{}).InjectClashAPI([]byte("log-level: info\n"), "127.0.0.1:9090", "s3c")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	if doc["external-controller"] != "127.0.0.1:9090" || doc["secret"] != "s3c" {
		t.Fatalf("doc = %#v", doc)
	}
	if _, err := (mihomoCore{}).InjectClashAPI([]byte("{"), "a:1", "s"); err == nil {
		t.Fatal("want yaml error")
	}
}

func TestMihomoInjectBindInterfaceEdgeCases(t *testing.T) {
	if _, err := (mihomoCore{}).InjectBindInterface([]byte("{"), "en0"); err == nil {
		t.Fatal("want yaml error")
	}
	raw := []byte("log-level: info\n")
	out, err := (mihomoCore{}).InjectBindInterface(raw, "")
	if err != nil || string(out) != string(raw) {
		t.Fatalf("empty iface: %s %v", out, err)
	}
}

func TestDecodeConfigYamlNotAString(t *testing.T) {
	if _, err := decodeConfig(mihomoCore{}, json.RawMessage(`{"a":1}`)); err == nil {
		t.Fatal("want error when yaml config is not a JSON string")
	}
}

func TestTypedDNSServer(t *testing.T) {
	cases := []struct {
		address string
		want    map[string]any
	}{
		{"local", map[string]any{"type": "udp", "server": "local"}},
		{"1.1.1.1", map[string]any{"type": "udp", "server": "1.1.1.1"}},
		{"https://1.1.1.1/dns-query", map[string]any{"type": "https", "server": "1.1.1.1"}},
		{"https://dns.example:8443/custom", map[string]any{"type": "https", "server": "dns.example", "server_port": 8443, "path": "/custom"}},
		{"tls://9.9.9.9", map[string]any{"type": "tls", "server": "9.9.9.9"}},
		{"h3://dns.example/xyz", map[string]any{"type": "h3", "server": "dns.example", "path": "/xyz"}},
		{"weird://dns.example", map[string]any{"type": "https", "server": "dns.example"}},
		{"tcp://8.8.8.8:53", map[string]any{"type": "tcp", "server": "8.8.8.8", "server_port": 53}},
	}
	for _, c := range cases {
		got := typedDNSServer("remote", c.address, "proxy-out")
		if got["tag"] != "remote" || got["detour"] != "proxy-out" {
			t.Fatalf("%s: tag/detour missing: %#v", c.address, got)
		}
		for k, v := range c.want {
			if got[k] != v {
				t.Fatalf("%s: %s = %#v, want %#v", c.address, k, got[k], v)
			}
		}
		if _, has := c.want["path"]; !has {
			if _, got := got["path"]; got {
				t.Fatalf("%s: unexpected path", c.address)
			}
		}
	}
}

func TestIsLegacySingBoxConfigVariants(t *testing.T) {
	modern := map[string]any{
		"dns": map[string]any{"servers": []any{
			map[string]any{"tag": "remote", "type": "https", "server": "1.1.1.1"}, 5,
		}},
		"inbounds":  []any{map[string]any{"type": "socks"}, 5},
		"outbounds": []any{map[string]any{"type": "vless"}, 5},
	}
	if isLegacySingBoxConfig(modern) {
		t.Fatal("modern config misdetected as legacy")
	}
	if !isLegacySingBoxConfig(map[string]any{
		"outbounds": []any{map[string]any{"type": "dns"}},
	}) {
		t.Fatal("dns outbound should flag legacy")
	}
	if !isLegacySingBoxConfig(map[string]any{
		"inbounds": []any{map[string]any{"sniff": true}},
	}) {
		t.Fatal("inbound sniff should flag legacy")
	}
	if !isLegacySingBoxConfig(map[string]any{
		"dns": map[string]any{"servers": []any{map[string]any{"address": "local"}}},
	}) {
		t.Fatal("dns address should flag legacy")
	}
	if isLegacySingBoxConfig(map[string]any{}) {
		t.Fatal("empty config is not legacy")
	}
}

func TestMigrateLegacySingBoxMinimal(t *testing.T) {
	// No dns, no route, no outbounds: defaults are synthesized.
	doc := map[string]any{}
	migrateLegacySingBox(doc)
	dns := doc["dns"].(map[string]any)
	servers := dns["servers"].([]any)
	if len(servers) != 2 {
		t.Fatalf("servers = %#v", servers)
	}
	if servers[0].(map[string]any)["server"] != "1.1.1.1" {
		t.Fatalf("default remote = %#v", servers[0])
	}
	route := doc["route"].(map[string]any)
	rules := route["rules"].([]any)
	if len(rules) != 1 || rules[0].(map[string]any)["action"] != "sniff" {
		t.Fatalf("rules = %#v", rules)
	}
	if _, has := route["rule_set"]; has {
		t.Fatal("rule_set should be absent with no geosite/geoip rules")
	}

	// Non-map rules and rules that reduce to nothing are dropped; a plain
	// outbound rule keeps its outbound.
	doc2 := map[string]any{
		"route": map[string]any{"rules": []any{
			5,
			map[string]any{"outbound": ""},
			map[string]any{"domain_suffix": []any{"x.example"}, "outbound": "proxy-out"},
		}},
	}
	migrateLegacySingBox(doc2)
	rules2 := doc2["route"].(map[string]any)["rules"].([]any)
	if len(rules2) != 2 { // sniff + the domain_suffix rule
		t.Fatalf("rules2 = %#v", rules2)
	}
	last := rules2[1].(map[string]any)
	if last["outbound"] != "proxy-out" || last["domain_suffix"] == nil {
		t.Fatalf("rule = %#v", last)
	}

	// Existing rule_set from a previous shape is dropped when unused.
	doc3 := map[string]any{"route": map[string]any{"rule_set": []any{"old"}}}
	migrateLegacySingBox(doc3)
	if _, has := doc3["route"].(map[string]any)["rule_set"]; has {
		t.Fatal("stale rule_set not removed")
	}
}
