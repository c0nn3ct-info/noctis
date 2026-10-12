package main

import (
	"encoding/json"
	"errors"
	"net"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func protoVarintField(num int, v uint64) []byte {
	out := []byte{byte(num << 3)}
	for v >= 0x80 {
		out = append(out, byte(v)|0x80)
		v >>= 7
	}
	return append(out, byte(v))
}

// siteDomain encodes one geosite Domain with optional attribute keys.
func siteDomain(typ uint64, value string, attrs ...string) []byte {
	d := append(protoVarintField(1, typ), protoField(2, []byte(value))...)
	for _, a := range attrs {
		d = append(d, protoField(3, append(protoField(1, []byte(a)), protoVarintField(2, 1)...))...)
	}
	return protoField(2, d)
}

func siteEntry(code string, domains ...[]byte) []byte {
	e := protoField(1, []byte(code))
	for _, d := range domains {
		e = append(e, d...)
	}
	return e
}

func ipCIDR(ip net.IP, prefix uint64) []byte {
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}
	return protoField(2, append(protoField(1, ip), protoVarintField(2, prefix)...))
}

func ipEntry(code string, reverse bool, cidrs ...[]byte) []byte {
	e := protoField(1, []byte(code))
	for _, c := range cidrs {
		e = append(e, c...)
	}
	if reverse {
		e = append(e, protoVarintField(3, 1)...)
	}
	return e
}

func datOf(entries ...[]byte) []byte {
	var out []byte
	for _, e := range entries {
		out = append(out, protoField(1, e)...)
	}
	return out
}

func TestGeoRuleSetTag(t *testing.T) {
	cases := []struct {
		tag, kind, code, attr string
		ok                    bool
	}{
		{"geosite-cn", "geosite", "cn", "", true},
		{"geosite-Google@CN", "geosite", "google", "cn", true},
		{"geosite-geolocation-!cn", "geosite", "geolocation-!cn", "", true},
		{"geoip-ru", "geoip", "ru", "", true},
		{"geoip-a@b", "geoip", "a@b", "", true},
		{"geosite-", "", "", "", false},
		{"custom-list", "", "", "", false},
	}
	for _, c := range cases {
		kind, code, attr, ok := geoRuleSetTag(c.tag)
		if kind != c.kind || code != c.code || attr != c.attr || ok != c.ok {
			t.Errorf("%s: got %q %q %q %v", c.tag, kind, code, attr, ok)
		}
	}
}

func TestSiteRule(t *testing.T) {
	entry := siteEntry("google",
		siteDomain(geoDomainPlain, "goog"),
		siteDomain(geoDomainRegex, `^r\d+\.googlevideo\.com$`, "cn"),
		siteDomain(geoDomainRegex, `(?<=x)y`), // not RE2
		siteDomain(geoDomainSuffix, "google.cn", "cn"),
		siteDomain(geoDomainFull, "www.google.com"),
		siteDomain(geoDomainFull, ""),
		siteDomain(9, "unknown.type"),
	)
	all, err := siteRule(entry, "")
	if err != nil {
		t.Fatal(err)
	}
	want := headlessRule{
		Domain:        []string{"www.google.com"},
		DomainSuffix:  []string{"google.cn"},
		DomainKeyword: []string{"goog"},
		DomainRegex:   []string{`^r\d+\.googlevideo\.com$`},
	}
	if !reflect.DeepEqual(all, want) {
		t.Fatalf("got %+v", all)
	}
	cn, _ := siteRule(entry, "cn")
	if !reflect.DeepEqual(cn, headlessRule{DomainSuffix: []string{"google.cn"}, DomainRegex: []string{`^r\d+\.googlevideo\.com$`}}) {
		t.Fatalf("attr: got %+v", cn)
	}
	if _, err := siteRule(append(protoField(1, []byte("x")), 0x12, 0x05, 0x0a), ""); err == nil {
		t.Fatal("want truncation error")
	}
	if _, err := siteRule(protoField(2, []byte{0x0a, 0x09}), ""); err == nil {
		t.Fatal("want error from a truncated domain")
	}
}

func TestIPRule(t *testing.T) {
	entry := ipEntry("ru", false,
		ipCIDR(net.ParseIP("77.88.0.0"), 16),
		ipCIDR(net.ParseIP("2a02:6b8::"), 32),
		protoField(2, protoField(1, []byte{1, 2, 3})), // neither v4 nor v6
	)
	r, ok, err := ipRule(entry)
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if !reflect.DeepEqual(r.IPCIDR, []string{"77.88.0.0/16", "2a02:6b8::/32"}) {
		t.Fatalf("got %v", r.IPCIDR)
	}
	if _, ok, _ := ipRule(ipEntry("not-ru", true, ipCIDR(net.ParseIP("1.1.1.1"), 32))); ok {
		t.Fatal("reverse_match must not build")
	}
	if _, ok, _ := ipRule(append(protoField(1, []byte("x")), protoVarintField(3, 0)...)); !ok {
		t.Fatal("reverse_match false is a plain entry")
	}
}

func TestWalkProtoFieldsTruncated(t *testing.T) {
	noop := func(int, uint64, []byte) error { return nil }
	for name, b := range map[string][]byte{
		"key":           {0x80},
		"varint":        {0x08, 0x80},
		"length":        {0x0a, 0x80},
		"short payload": {0x0a, 0x05, 0x01},
		"fixed64":       {0x09, 1, 2},
		"fixed32":       {0x0d, 1},
		"bad wire type": {0x0b},
	} {
		if err := walkProtoFields(b, noop); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
	if err := walkProtoFields(append([]byte{0x09, 1, 2, 3, 4, 5, 6, 7, 8, 0x0d, 1, 2, 3, 4}, protoVarintField(1, 3)...), noop); err != nil {
		t.Fatal(err)
	}
	stop := errors.New("stop")
	if err := walkProtoFields(protoVarintField(1, 1), func(int, uint64, []byte) error { return stop }); err != stop {
		t.Fatalf("varint callback error lost: %v", err)
	}
	if err := walkProtoFields(protoField(1, nil), func(int, uint64, []byte) error { return stop }); err != stop {
		t.Fatalf("payload callback error lost: %v", err)
	}
}

// isolateRuleSets points the compiled cache and the asset dir at temp dirs and
// replaces the compiler; compiled counts the compiles that ran.
func isolateRuleSets(t *testing.T, compileErr error) (assets string, compiled *int) {
	t.Helper()
	isolateGeo(t)
	root := t.TempDir()
	assets = t.TempDir()
	prevRoot, prevAssets, prevCompile := geoRuleSetRoot, geoAssetDir, compileRuleSet
	geoRuleSetRoot = func() string { return root }
	geoAssetDir = func() string { return assets }
	n := 0
	compileRuleSet = func(bin, src, out string) error {
		n++
		if compileErr != nil {
			return compileErr
		}
		b, err := os.ReadFile(src)
		if err != nil {
			return err
		}
		return os.WriteFile(out, append([]byte("SRS"), b...), 0o600)
	}
	t.Cleanup(func() { geoRuleSetRoot, geoAssetDir, compileRuleSet = prevRoot, prevAssets, prevCompile })
	return assets, &n
}

func writeDats(t *testing.T, dir string) {
	t.Helper()
	site := datOf(
		siteEntry("CN", siteDomain(geoDomainSuffix, "baidu.com")),
		siteEntry("google", siteDomain(geoDomainSuffix, "google.com"), siteDomain(geoDomainSuffix, "google.cn", "cn")),
		siteEntry("cn", siteDomain(geoDomainSuffix, "duplicate.example")), // the first entry of a code wins
		siteEntry("empty"),
	)
	ip := datOf(ipEntry("ru", false, ipCIDR(net.ParseIP("77.88.0.0"), 16)), ipEntry("inverted", true, ipCIDR(net.ParseIP("1.1.1.1"), 32)))
	if err := os.WriteFile(filepath.Join(dir, "geosite.dat"), site, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "geoip.dat"), ip, 0o600); err != nil {
		t.Fatal(err)
	}
}

func singBoxDoc(sets []any, rules []any, extra map[string]any) []byte {
	doc := map[string]any{"route": map[string]any{"rule_set": sets, "rules": rules}}
	for k, v := range extra {
		doc[k] = v
	}
	b, _ := json.Marshal(doc)
	return b
}

func remoteSet(tag, url string) map[string]any {
	m := map[string]any{"tag": tag, "type": "remote", "format": "binary", "download_detour": "proxy-out"}
	if url != "" {
		m["url"] = url
	}
	return m
}

func TestLocalizeRuleSets(t *testing.T) {
	assets, compiled := isolateRuleSets(t, nil)
	writeDats(t, assets)
	var logs []string
	sup := newSupervisor(func(ev string, p any) {
		if m, ok := p.(map[string]any); ok && ev == "log" {
			logs = append(logs, m["line"].(string))
		}
	})
	sets := []any{
		remoteSet("geosite-cn", "https://x/geosite-cn.srs"),
		remoteSet("geosite-google@cn", "https://x/geosite-google@cn.srs"),
		remoteSet("geoip-ru", "https://x/geoip-ru.srs"),
		remoteSet("geosite-netflix", "https://x/geosite-netflix.srs"), // not in the database, has a URL
		remoteSet("geosite-whitelist", ""),                            // not in the database, no URL
		remoteSet("geosite-empty", ""),                                // in it, but empty
		remoteSet("geoip-inverted", "https://x/geoip-inverted.srs"),   // reverse_match
		map[string]any{"tag": "own", "type": "local", "format": "source", "path": "/x.json"},
		remoteSet("custom-list", "https://x/custom.srs"),
		"not a map",
	}
	rules := []any{
		map[string]any{"rule_set": []any{"geosite-cn"}, "outbound": "direct"},
		map[string]any{"rule_set": []any{"geosite-whitelist"}, "outbound": "direct"},
		map[string]any{"rule_set": []any{"geosite-whitelist", "geoip-ru"}, "outbound": "proxy-out"},
		map[string]any{"type": "logical", "mode": "or", "rules": []any{
			map[string]any{"rule_set": []any{"geosite-empty"}},
		}, "outbound": "direct"},
		map[string]any{"type": "logical", "mode": "or", "rules": []any{
			map[string]any{"rule_set": []any{"geosite-empty"}},
			map[string]any{"domain": []any{"a.example"}},
		}, "outbound": "direct"},
		map[string]any{"action": "sniff"},
		"not a map",
	}
	dns := map[string]any{"rules": []any{map[string]any{"rule_set": []any{"geosite-whitelist"}, "server": "dns-direct"}}}
	out := sup.localizeRuleSets("/bin/sing-box", "/data", singBoxDoc(sets, rules, map[string]any{"dns": dns}))

	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	route := doc["route"].(map[string]any)
	byTag := map[string]map[string]any{}
	for _, v := range route["rule_set"].([]any) {
		if m, ok := v.(map[string]any); ok {
			byTag[m["tag"].(string)] = m
		}
	}
	for _, tag := range []string{"geosite-cn", "geosite-google@cn", "geoip-ru"} {
		m := byTag[tag]
		if m["type"] != "local" || m["format"] != "binary" {
			t.Fatalf("%s not localized: %v", tag, m)
		}
		if b, err := os.ReadFile(m["path"].(string)); err != nil || !strings.HasPrefix(string(b), "SRS") {
			t.Fatalf("%s: compiled file %q %v", tag, b, err)
		}
	}
	b, _ := os.ReadFile(byTag["geosite-google@cn"]["path"].(string))
	if strings.Contains(string(b), "google.com") || !strings.Contains(string(b), "google.cn") {
		t.Fatalf("attribute filter lost: %s", b)
	}
	b, _ = os.ReadFile(byTag["geosite-cn"]["path"].(string))
	if !strings.Contains(string(b), `"version":2`) || !strings.Contains(string(b), "baidu.com") || strings.Contains(string(b), "duplicate") {
		t.Fatalf("cn source: %s", b)
	}
	for _, tag := range []string{"geosite-netflix", "geoip-inverted", "custom-list"} {
		if byTag[tag]["type"] != "remote" {
			t.Fatalf("%s should stay remote: %v", tag, byTag[tag])
		}
	}
	for _, tag := range []string{"geosite-whitelist", "geosite-empty"} {
		if _, ok := byTag[tag]; ok {
			t.Fatalf("%s should be gone", tag)
		}
	}
	if byTag["own"]["path"] != "/x.json" {
		t.Fatal("a local rule-set is left alone")
	}

	gotRules, _ := json.Marshal(route["rules"])
	wantRules := `[{"outbound":"direct","rule_set":["geosite-cn"]},{"outbound":"proxy-out","rule_set":["geoip-ru"]},` +
		`{"mode":"or","outbound":"direct","rules":[{"domain":["a.example"]}],"type":"logical"},{"action":"sniff"},"not a map"]`
	if string(gotRules) != wantRules {
		t.Fatalf("rules:\n got %s\nwant %s", gotRules, wantRules)
	}
	if r := doc["dns"].(map[string]any)["rules"].([]any); len(r) != 0 {
		t.Fatalf("dns rule on a skipped rule-set kept: %v", r)
	}
	cache := doc["experimental"].(map[string]any)["cache_file"].(map[string]any)
	if cache["enabled"] != true || cache["path"] != filepath.Join("/data", "cache.db") {
		t.Fatalf("cache_file: %v", cache)
	}
	joined := strings.Join(logs, "\n")
	for _, want := range []string{
		"geo databases lack geosite-empty, geosite-whitelist; those rules are skipped",
		"geo databases lack geoip-inverted, geosite-netflix; sing-box fetches those itself",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("log lacks %q:\n%s", want, joined)
		}
	}

	// The second connect reuses every compiled file.
	before := *compiled
	sup.localizeRuleSets("/bin/sing-box", "/data", singBoxDoc(sets, rules, nil))
	if *compiled != before {
		t.Fatalf("recompiled %d rule-sets", *compiled-before)
	}
}

func TestLocalizeRuleSetsLeavesWhatItCannotUse(t *testing.T) {
	assets, _ := isolateRuleSets(t, nil)
	sup := newSupervisor(nil)
	for name, raw := range map[string][]byte{
		"not json":     []byte("{"),
		"no rule sets": singBoxDoc(nil, nil, nil),
		"no geo jobs":  singBoxDoc([]any{remoteSet("custom", "https://x")}, nil, nil),
	} {
		if got := sup.localizeRuleSets("/bin/sing-box", "/data", raw); string(got) != string(raw) {
			t.Errorf("%s: changed to %s", name, got)
		}
	}

	// No databases at all: every geo rule-set keeps its URL, and one without a
	// URL goes, leaving the route without rule-sets.
	raw := singBoxDoc([]any{remoteSet("geosite-cn", "")}, []any{map[string]any{"rule_set": []any{"geosite-cn"}}}, nil)
	var doc map[string]any
	_ = json.Unmarshal(sup.localizeRuleSets("/bin/sing-box", "/data", raw), &doc)
	if _, has := doc["route"].(map[string]any)["rule_set"]; has {
		t.Fatalf("emptied rule_set kept: %v", doc["route"])
	}

	// An experimental block that already caches is left as it was.
	raw = singBoxDoc([]any{remoteSet("geosite-cn", "https://x")}, nil,
		map[string]any{"experimental": map[string]any{"cache_file": map[string]any{"enabled": false}}})
	_ = json.Unmarshal(sup.localizeRuleSets("/bin/sing-box", "/data", raw), &doc)
	if c := doc["experimental"].(map[string]any)["cache_file"].(map[string]any); c["enabled"] != false {
		t.Fatalf("cache_file overwritten: %v", c)
	}
	_ = assets
}

func TestLocalizeRuleSetsUsesTheProfileDatabases(t *testing.T) {
	assets, _ := isolateRuleSets(t, nil)
	writeDats(t, assets)
	own := datOf(siteEntry("whitelist", siteDomain(geoDomainFull, "gosuslugi.ru")))
	srv, _ := geoServer(t, 200, own, 0)
	sup := newSupervisor(nil)
	sup.setGeoURLs(geoURLs{Geosite: srv.URL + "/geosite.dat"})
	raw := singBoxDoc([]any{remoteSet("geosite-whitelist", ""), remoteSet("geosite-cn", "")}, nil, nil)
	var doc map[string]any
	_ = json.Unmarshal(sup.localizeRuleSets("/bin/sing-box", "/data", raw), &doc)
	for _, v := range doc["route"].(map[string]any)["rule_set"].([]any) {
		if m := v.(map[string]any); m["type"] != "local" {
			t.Fatalf("%v not built from the merged databases", m)
		}
	}
}

func TestBuildGeoRuleSetFallsBackToSource(t *testing.T) {
	_, _ = isolateRuleSets(t, errors.New("unknown command"))
	db := filepath.Join(t.TempDir(), "geosite.dat")
	_ = os.WriteFile(db, nil, 0o600)
	job := geoRuleSetJob{tag: "geosite-x", kind: "geosite", code: "x", db: db}
	entry := siteEntry("x", siteDomain(geoDomainFull, "x.example"))
	path, format, err := buildGeoRuleSet("/bin/sing-box", "s", job, entry)
	if err != nil || format != "source" || !strings.HasSuffix(path, ".json") {
		t.Fatalf("got %q %q %v", path, format, err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatal(err)
	}
}

func TestBuildGeoRuleSetFailures(t *testing.T) {
	_, _ = isolateRuleSets(t, nil)
	job := geoRuleSetJob{tag: "geosite-x", kind: "geosite", code: "x", db: "/nope"}
	if _, _, err := buildGeoRuleSet("b", "s", job, []byte{0x80}); err == nil {
		t.Fatal("want a parse error")
	}
	if _, _, err := buildGeoRuleSet("b", "s", geoRuleSetJob{kind: "geoip"}, []byte{0x80}); err == nil {
		t.Fatal("want a geoip parse error")
	}
	entry := siteEntry("x", siteDomain(geoDomainFull, "x.example"))

	// A root that is a file cannot hold the cache.
	file := filepath.Join(t.TempDir(), "file")
	_ = os.WriteFile(file, nil, 0o600)
	prev := geoRuleSetRoot
	geoRuleSetRoot = func() string { return filepath.Join(file, "sub") }
	if _, _, err := buildGeoRuleSet("b", "s", job, entry); err == nil {
		t.Fatal("want a mkdir error")
	}
	geoRuleSetRoot = prev

	// A source file that cannot be written.
	sum := ruleSetBase(job, "s")
	_ = os.MkdirAll(sum+".json", 0o700)
	if _, _, err := buildGeoRuleSet("b", "s", job, entry); err == nil {
		t.Fatal("want a write error")
	}
	_ = os.RemoveAll(sum + ".json")

	// A compiled file that cannot be moved into place leaves the source.
	prevCompile := compileRuleSet
	compileRuleSet = func(bin, src, out string) error {
		// The rename target is a non-empty directory.
		_ = os.MkdirAll(filepath.Join(strings.TrimSuffix(out, ".part"), "x"), 0o700)
		return os.WriteFile(out, []byte("SRS"), 0o600)
	}
	t.Cleanup(func() { compileRuleSet = prevCompile })
	path, format, err := buildGeoRuleSet("b", "s2", job, entry)
	if err != nil || format != "source" {
		t.Fatalf("got %q %q %v", path, format, err)
	}
}

func TestLocalizeRuleSetsLogsABuildError(t *testing.T) {
	assets, _ := isolateRuleSets(t, nil)
	writeDats(t, assets)
	file := filepath.Join(t.TempDir(), "file")
	_ = os.WriteFile(file, nil, 0o600)
	geoRuleSetRoot = func() string { return filepath.Join(file, "sub") }
	var logs []string
	sup := newSupervisor(func(ev string, p any) {
		if m, ok := p.(map[string]any); ok && ev == "log" {
			logs = append(logs, m["line"].(string))
		}
	})
	raw := singBoxDoc([]any{remoteSet("geosite-cn", "https://x")}, nil, nil)
	var doc map[string]any
	_ = json.Unmarshal(sup.localizeRuleSets("/bin/sing-box", "/data", raw), &doc)
	if m := doc["route"].(map[string]any)["rule_set"].([]any)[0].(map[string]any); m["type"] != "remote" {
		t.Fatalf("an unbuilt rule-set must stay remote: %v", m)
	}
	if !strings.Contains(strings.Join(logs, "\n"), "sing-box rule-set geosite-cn not built") {
		t.Fatalf("logs: %v", logs)
	}
}

func TestCompileRuleSetReportsTheCoreOutput(t *testing.T) {
	dir := t.TempDir()
	script := func(name, body string) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte("#!/bin/sh\n"+body+"\n"), 0o700); err != nil {
			t.Fatal(err)
		}
		return p
	}
	err := compileRuleSet(script("bad", "echo 'bad rule' >&2; exit 3"), "in.json", "out.srs")
	if err == nil || !strings.Contains(err.Error(), "bad rule") {
		t.Fatalf("want the core's own words, got %v", err)
	}
	if got := compileRuleSet(script("good", "exit 0"), "in.json", "out.srs"); got != nil {
		t.Fatalf("got %v", got)
	}
}

func TestGeoAssetDir(t *testing.T) {
	prev := osExecutable
	t.Cleanup(func() { osExecutable = prev })
	osExecutable = func() (string, error) { return "/opt/noctis/noctis-host", nil }
	if got := geoAssetDir(); got != "/opt/noctis" {
		t.Fatalf("got %q", got)
	}
	osExecutable = func() (string, error) { return "", errors.New("no") }
	if got := geoAssetDir(); got != "" {
		t.Fatalf("got %q", got)
	}
}
