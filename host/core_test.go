package main

import (
	"encoding/json"
	"fmt"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestBinaryNameVariants(t *testing.T) {
	// On Windows the installed core carries a .exe suffix and lives beside the
	// helper (a dir not on PATH), so the bare name never resolves there -- both
	// must be probed. Elsewhere the binary is extensionless.
	win := binaryNameVariants("sing-box", "windows")
	if len(win) != 2 || win[0] != "sing-box" || win[1] != "sing-box.exe" {
		t.Fatalf("windows variants = %v, want [sing-box sing-box.exe]", win)
	}
	nix := binaryNameVariants("sing-box", "linux")
	if len(nix) != 1 || nix[0] != "sing-box" {
		t.Fatalf("linux variants = %v, want [sing-box]", nix)
	}
}

func TestSingBoxCoreMeta(t *testing.T) {
	c := singBoxCore{}
	if c.ID() != "sing-box" {
		t.Fatalf("ID=%q", c.ID())
	}
	if c.ConfigExt() != "json" {
		t.Fatalf("ext=%q", c.ConfigExt())
	}
	args := c.RunArgs("/tmp/x.json", "")
	if len(args) != 3 || args[0] != "run" || args[1] != "-c" || args[2] != "/tmp/x.json" {
		t.Fatalf("RunArgs=%v", args)
	}
}

func TestSingBoxInjectPort(t *testing.T) {
	raw := []byte(`{"inbounds":[{"type":"socks","tag":"socks-in","listen":"127.0.0.1","listen_port":0}],"outbounds":[{"type":"vless","tag":"proxy-out"}]}`)
	out, err := singBoxCore{}.InjectPort(raw, 12345)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	ib := doc["inbounds"].([]any)[0].(map[string]any)
	if int(ib["listen_port"].(float64)) != 12345 {
		t.Fatalf("listen_port=%v", ib["listen_port"])
	}
}

func TestSingBoxInjectPortNoSocks(t *testing.T) {
	raw := []byte(`{"inbounds":[{"type":"http"}]}`)
	if _, err := (singBoxCore{}).InjectPort(raw, 1); err == nil {
		t.Fatal("expected error for missing socks inbound")
	}
}

func TestSingBoxInjectBindInterface(t *testing.T) {
	raw := []byte(`{"outbounds":[{"type":"vless","tag":"proxy-out"},{"type":"direct","tag":"direct"}]}`)
	out, err := singBoxCore{}.InjectBindInterface(raw, "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	obs := doc["outbounds"].([]any)
	vless := obs[0].(map[string]any)
	if vless["bind_interface"] != "en0" {
		t.Fatalf("vless bind_interface=%v", vless["bind_interface"])
	}
	direct := obs[1].(map[string]any)
	if _, ok := direct["bind_interface"]; ok {
		t.Fatal("direct should not get bind_interface")
	}
}

func TestSingBoxInjectBindInterfaceEmptyNoop(t *testing.T) {
	raw := []byte(`{"outbounds":[{"type":"vless"}]}`)
	out, err := singBoxCore{}.InjectBindInterface(raw, "")
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != string(raw) {
		t.Fatalf("expected unchanged, got %s", out)
	}
}

func TestCoreByID(t *testing.T) {
	c, err := coreByID("")
	if err != nil || c.ID() != "sing-box" {
		t.Fatalf("default core: %v %v", c, err)
	}
	if _, err := coreByID("nope"); err == nil {
		t.Fatal("expected error for unknown core")
	}
	if c, err := coreByID("xray"); err != nil || c.ID() != "xray" {
		t.Fatalf("xray core: %v %v", c, err)
	}
	if c, err := coreByID("mihomo"); err != nil || c.ID() != "mihomo" {
		t.Fatalf("mihomo core: %v %v", c, err)
	}
}

func TestMihomoCoreMeta(t *testing.T) {
	c := mihomoCore{}
	if c.ID() != "mihomo" {
		t.Fatalf("ID=%q", c.ID())
	}
	if c.ConfigExt() != "yaml" {
		t.Fatalf("ext=%q", c.ConfigExt())
	}
	args := c.RunArgs("/tmp/c.yaml", "/tmp/data")
	if len(args) != 4 || args[0] != "-d" || args[1] != "/tmp/data" || args[2] != "-f" || args[3] != "/tmp/c.yaml" {
		t.Fatalf("RunArgs=%v", args)
	}
}

func TestMihomoInjectPort(t *testing.T) {
	raw := []byte("listeners:\n  - name: mixed-in\n    type: mixed\n    listen: 127.0.0.1\n    port: 0\n")
	out, err := mihomoCore{}.InjectPort(raw, 34567)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	l := doc["listeners"].([]any)[0].(map[string]any)
	if fmt.Sprintf("%v", l["port"]) != "34567" {
		t.Fatalf("listener port=%v", l["port"])
	}
}

func TestMihomoInjectBindInterface(t *testing.T) {
	raw := []byte("proxies:\n  - name: proxy-out\n    type: vless\n")
	out, err := mihomoCore{}.InjectBindInterface(raw, "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := yaml.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	if doc["interface-name"] != "en0" {
		t.Fatalf("interface-name=%v", doc["interface-name"])
	}
}

func TestInstalledCoresShape(t *testing.T) {
	cs := installedCores()
	if len(cs) != 3 {
		t.Fatalf("expected 3 cores, got %d", len(cs))
	}
	wantOrder := []string{"sing-box", "xray", "mihomo"}
	for i, c := range cs {
		if c["id"] != wantOrder[i] {
			t.Fatalf("core[%d].id=%v, want %s", i, c["id"], wantOrder[i])
		}
		if _, ok := c["available"].(bool); !ok {
			t.Fatalf("core[%d].available not a bool: %v", i, c["available"])
		}
	}
}

func TestDecodeConfigYamlUnwrapsJSONString(t *testing.T) {
	yamlText := "log-level: warning\nproxies: []\n"
	// The extension sends YAML as a JSON string value.
	payload, _ := json.Marshal(yamlText)
	out, err := decodeConfig(mihomoCore{}, payload)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != yamlText {
		t.Fatalf("decoded=%q want %q", out, yamlText)
	}
}

func TestDecodeConfigJSONPassthrough(t *testing.T) {
	raw := json.RawMessage(`{"inbounds":[]}`)
	out, err := decodeConfig(singBoxCore{}, raw)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != string(raw) {
		t.Fatalf("json core should pass through unchanged; got %s", out)
	}
}

func TestXrayCoreMeta(t *testing.T) {
	c := xrayCore{}
	if c.ID() != "xray" {
		t.Fatalf("ID=%q", c.ID())
	}
	if c.ConfigExt() != "json" {
		t.Fatalf("ext=%q", c.ConfigExt())
	}
	args := c.RunArgs("/tmp/x.json", "")
	if len(args) != 3 || args[0] != "run" || args[1] != "-c" || args[2] != "/tmp/x.json" {
		t.Fatalf("RunArgs=%v", args)
	}
}

func TestXrayInjectPort(t *testing.T) {
	// xray inbounds use `port`, not sing-box's `listen_port`.
	raw := []byte(`{"inbounds":[{"tag":"socks-in","protocol":"socks","listen":"127.0.0.1","port":0}]}`)
	out, err := xrayCore{}.InjectPort(raw, 23456)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	ib := doc["inbounds"].([]any)[0].(map[string]any)
	if int(ib["port"].(float64)) != 23456 {
		t.Fatalf("port=%v", ib["port"])
	}
}

func TestXrayInjectBindInterface(t *testing.T) {
	// xray binds via streamSettings.sockopt.interface on proxy outbounds.
	raw := []byte(`{"outbounds":[{"tag":"proxy-out","protocol":"vless"},{"tag":"direct","protocol":"freedom"}]}`)
	out, err := xrayCore{}.InjectBindInterface(raw, "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	obs := doc["outbounds"].([]any)
	ss := obs[0].(map[string]any)["streamSettings"].(map[string]any)
	sock := ss["sockopt"].(map[string]any)
	if sock["interface"] != "en0" {
		t.Fatalf("vless sockopt.interface=%v", sock["interface"])
	}
	if _, ok := obs[1].(map[string]any)["streamSettings"]; ok {
		t.Fatal("freedom outbound should not get streamSettings")
	}
}

func TestMigrateLegacySingBox(t *testing.T) {
	// A pre-1.12 rules-mode config (what an old extension emits): legacy DNS
	// `address`, block/dns special outbounds, inbound `sniff`, geosite/geoip +
	// block route rules. The new helper must rewrite it to the modern schema.
	raw := []byte(`{
	  "dns":{"servers":[
	    {"tag":"remote","address":"https://1.1.1.1/dns-query","detour":"proxy-out"},
	    {"tag":"local","address":"local","detour":"direct"}],
	    "rules":[{"outbound":["any"],"server":"local"}],"strategy":"prefer_ipv4","final":"remote"},
	  "inbounds":[{"type":"socks","tag":"socks-in","listen":"127.0.0.1","listen_port":0,"sniff":true}],
	  "outbounds":[
	    {"type":"vless","tag":"proxy-out"},{"type":"direct","tag":"direct"},
	    {"type":"block","tag":"block"},{"type":"dns","tag":"dns-out"}],
	  "route":{"rules":[
	    {"protocol":"dns","outbound":"dns-out"},
	    {"geosite":["google"],"outbound":"proxy-out"},
	    {"geoip":["cn"],"outbound":"direct"},
	    {"domain_suffix":["ads.example"],"outbound":"block"}],
	    "final":"proxy-out"}}`)
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if !isLegacySingBoxConfig(doc) {
		t.Fatal("expected legacy config detection")
	}
	migrateLegacySingBox(doc)

	if _, ok := doc["inbounds"].([]any)[0].(map[string]any)["sniff"]; ok {
		t.Fatal("inbound sniff not stripped")
	}
	servers := doc["dns"].(map[string]any)["servers"].([]any)
	for _, s := range servers {
		m := s.(map[string]any)
		if _, ok := m["address"]; ok {
			t.Fatalf("legacy dns address remains: %v", m)
		}
		if m["type"] == nil {
			t.Fatalf("dns server missing type: %v", m)
		}
	}
	for _, o := range doc["outbounds"].([]any) {
		if ot, _ := o.(map[string]any)["type"].(string); ot == "block" || ot == "dns" {
			t.Fatalf("special outbound %q not removed", ot)
		}
	}
	route := doc["route"].(map[string]any)
	if route["default_domain_resolver"] == nil {
		t.Fatal("missing default_domain_resolver")
	}
	rules := route["rules"].([]any)
	if rules[0].(map[string]any)["action"] != "sniff" {
		t.Fatalf("first rule is not the sniff action: %v", rules[0])
	}
	var sawHijack, sawReject bool
	for _, r := range rules {
		m := r.(map[string]any)
		if m["protocol"] == "dns" && m["action"] == "hijack-dns" {
			sawHijack = true
		}
		if m["action"] == "reject" {
			sawReject = true
		}
	}
	if !sawHijack {
		t.Fatal("dns rule not converted to hijack-dns action")
	}
	if !sawReject {
		t.Fatal("outbound:block not converted to reject action")
	}
	tags := map[string]string{}
	for _, e := range route["rule_set"].([]any) {
		m := e.(map[string]any)
		tags[m["tag"].(string)] = m["url"].(string)
	}
	if u := tags["geosite-google"]; u != "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-google.srs" {
		t.Fatalf("geosite-google rule_set url=%q", u)
	}
	if u := tags["geoip-cn"]; u != "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs" {
		t.Fatalf("geoip-cn rule_set url=%q", u)
	}
}

// The direct resolver dials the proxy server's own hostname, and an unbound
// query follows the default route — into a system VPN's tunnel, where the
// answer is that VPN's to give. With fake-ip DNS that answer is an address in
// 198.18/16 which the bound outbound then cannot reach at all. A resolver that
// names a detour already dials through that outbound and is left alone.
func TestSingBoxInjectBindInterfaceBindsTheDirectResolver(t *testing.T) {
	raw := []byte(`{"dns":{"servers":[
		{"tag":"remote","type":"https","server":"1.1.1.1","detour":"proxy-out"},
		{"tag":"dns-direct","type":"udp","server":"1.1.1.1"}]},
	 "outbounds":[{"type":"vless","tag":"proxy-out"},{"type":"direct","tag":"direct"}]}`)
	out, err := singBoxCore{}.InjectBindInterface(raw, "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	servers := doc["dns"].(map[string]any)["servers"].([]any)
	remote := servers[0].(map[string]any)
	if _, ok := remote["bind_interface"]; ok {
		t.Fatalf("remote resolver = %+v, want it left to its detour", remote)
	}
	direct := servers[1].(map[string]any)
	if direct["bind_interface"] != "en0" {
		t.Fatalf("direct resolver = %+v, want it bound to en0", direct)
	}
}

// A pre-1.12 config keeps the legacy resolver shape (`address`, no `type`), and
// that schema knows no dial fields: writing one in would have the old sing-box
// reject the config outright. Those configs reach here only beside an old
// sing-box, since InjectPort migrates the rest.
func TestSingBoxInjectBindInterfaceLeavesALegacyResolverAlone(t *testing.T) {
	raw := []byte(`{"dns":{"servers":[{"tag":"dns-direct","address":"1.1.1.1"}]},
	 "outbounds":[{"type":"vless","tag":"proxy-out"}]}`)
	out, err := singBoxCore{}.InjectBindInterface(raw, "en0")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(out, &doc); err != nil {
		t.Fatal(err)
	}
	server := doc["dns"].(map[string]any)["servers"].([]any)[0].(map[string]any)
	if _, ok := server["bind_interface"]; ok {
		t.Fatalf("legacy resolver = %+v, want it untouched", server)
	}
	// The outbound is still bound: that is the part both schemas share.
	ob := doc["outbounds"].([]any)[0].(map[string]any)
	if ob["bind_interface"] != "en0" {
		t.Fatalf("outbound = %+v, want it bound", ob)
	}
}
