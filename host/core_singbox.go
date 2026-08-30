package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

func init() { registerCore(singBoxCore{}) }

// singBoxCore drives SagerNet/sing-box. Config is JSON; launched with
// `sing-box run -c <config.json>`; SOCKS port lives at inbounds[].listen_port;
// outbounds are bound to a physical interface via `bind_interface`.
type singBoxCore struct{}

func (singBoxCore) ID() string        { return "sing-box" }
func (singBoxCore) ConfigExt() string { return "json" }

func (singBoxCore) Locate() (string, error) {
	return locateBinary("SINGBOX_BIN", []string{"sing-box"})
}

func (singBoxCore) RunArgs(cfgPath, _ string) []string {
	return []string{"run", "-c", cfgPath}
}

func (c singBoxCore) InjectPort(raw []byte, port int) ([]byte, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("config not json: %w", err)
	}
	// Old Noctis extensions emit the pre-1.12 config schema. If this sing-box is
	// new enough to reject it (>=1.12), rewrite it to the modern schema first so
	// an outdated extension still connects. On old sing-box we leave it as-is —
	// the legacy schema is exactly what it expects.
	if isLegacySingBoxConfig(doc) && singboxAtLeast(c, 1, 12) {
		migrateLegacySingBox(doc)
	}
	inbounds, ok := doc["inbounds"].([]any)
	if !ok || len(inbounds) == 0 {
		return nil, errors.New("config missing inbounds")
	}
	patched := false
	for _, ib := range inbounds {
		m, ok := ib.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := m["type"].(string); t == "socks" {
			m["listen_port"] = port
			patched = true
		}
	}
	if !patched {
		return nil, errors.New("config has no socks inbound")
	}
	return json.MarshalIndent(doc, "", "  ")
}

var proxyOutboundTypes = map[string]bool{
	"vless": true, "vmess": true, "trojan": true, "shadowsocks": true,
	"hysteria": true, "hysteria2": true, "tuic": true, "wireguard": true,
	"anytls": true, "shadowtls": true, "ssh": true, "socks": true, "http": true,
}

func isProxyOutboundType(t string) bool {
	return proxyOutboundTypes[t]
}

// SupportsClashAPI gates the Clash API on sing-box >=1.12. Older builds get the
// legacy config schema untouched (and no stats) — safest for the legacy path.
func (c singBoxCore) SupportsClashAPI() bool {
	return singboxAtLeast(c, 1, 12)
}

// InjectClashAPI adds experimental.clash_api with just external_controller +
// secret (the stable subset; the deprecated store_* fields are omitted). Runs
// after InjectPort, so any legacy→modern migration has already happened.
func (singBoxCore) InjectClashAPI(raw []byte, addr, secret string) ([]byte, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	exp, ok := doc["experimental"].(map[string]any)
	if !ok {
		exp = map[string]any{}
		doc["experimental"] = exp
	}
	exp["clash_api"] = map[string]any{
		"external_controller": addr,
		"secret":              secret,
	}
	return json.MarshalIndent(doc, "", "  ")
}

func (singBoxCore) InjectBindInterface(raw []byte, iface string) ([]byte, error) {
	if iface == "" {
		return raw, nil
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	obs, ok := doc["outbounds"].([]any)
	if !ok {
		return raw, nil
	}
	for _, ob := range obs {
		m, ok := ob.(map[string]any)
		if !ok {
			continue
		}
		if t, _ := m["type"].(string); isProxyOutboundType(t) {
			m["bind_interface"] = iface
		}
	}
	return json.MarshalIndent(doc, "", "  ")
}

// singboxAtLeast reports whether the located sing-box is >= major.minor. An
// unknown version returns false (don't migrate — safest for an old sing-box).
func singboxAtLeast(c singBoxCore, major, minor int) bool {
	v := coreVersion(c)
	parts := strings.SplitN(v, ".", 3)
	if len(parts) < 2 {
		return false
	}
	maj, err1 := strconv.Atoi(parts[0])
	min, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil {
		return false
	}
	if maj != major {
		return maj > major
	}
	return min >= minor
}

// isLegacySingBoxConfig detects the pre-1.12 schema old extensions emit: DNS
// servers with a string `address` (vs typed `type`/`server`), the removed
// `block`/`dns` special outbounds, or legacy inbound `sniff`.
func isLegacySingBoxConfig(doc map[string]any) bool {
	if dns, ok := doc["dns"].(map[string]any); ok {
		if servers, ok := dns["servers"].([]any); ok {
			for _, s := range servers {
				if m, ok := s.(map[string]any); ok {
					if _, has := m["address"]; has {
						return true
					}
				}
			}
		}
	}
	if obs, ok := doc["outbounds"].([]any); ok {
		for _, ob := range obs {
			if m, ok := ob.(map[string]any); ok {
				if t, _ := m["type"].(string); t == "block" || t == "dns" {
					return true
				}
			}
		}
	}
	if ibs, ok := doc["inbounds"].([]any); ok {
		for _, ib := range ibs {
			if m, ok := ib.(map[string]any); ok {
				if _, has := m["sniff"]; has {
					return true
				}
			}
		}
	}
	return false
}

var dnsURLRe = regexp.MustCompile(`(?i)^([a-z0-9]+)://([^/:]+)(?::(\d+))?(/.*)?$`)

// typedDNSServer mirrors the extension's buildDnsServer: a legacy DNS `address`
// (e.g. "https://1.1.1.1/dns-query", "tls://9.9.9.9", or a bare host) becomes a
// 1.12 typed server.
func typedDNSServer(tag, address, detour string) map[string]any {
	out := map[string]any{"tag": tag, "detour": detour}
	m := dnsURLRe.FindStringSubmatch(address)
	if m == nil {
		out["type"] = "udp"
		out["server"] = address
		return out
	}
	byScheme := map[string]string{"https": "https", "h3": "h3", "tls": "tls", "quic": "quic", "tcp": "tcp", "udp": "udp"}
	t := byScheme[strings.ToLower(m[1])]
	if t == "" {
		t = "https"
	}
	out["type"] = t
	out["server"] = m[2]
	if m[3] != "" {
		if p, err := strconv.Atoi(m[3]); err == nil {
			out["server_port"] = p
		}
	}
	if m[4] != "" && m[4] != "/dns-query" && (t == "https" || t == "h3") {
		out["path"] = m[4]
	}
	return out
}

// migrateLegacySingBox rewrites a pre-1.12 config in place to the modern 1.13
// schema, mirroring the extension's modern builder:
//   - inbounds: drop legacy sniff/domain_strategy fields
//   - dns: typed remote server + a direct resolver; drop legacy dns.rules/strategy
//   - outbounds: drop the removed block/dns special outbounds
//   - route: prepend sniff + hijack-dns actions, outbound:block -> action:reject,
//     geosite/geoip -> remote rule_set, add default_domain_resolver
func migrateLegacySingBox(doc map[string]any) {
	if ibs, ok := doc["inbounds"].([]any); ok {
		for _, ib := range ibs {
			if m, ok := ib.(map[string]any); ok {
				delete(m, "sniff")
				delete(m, "sniff_override_destination")
				delete(m, "domain_strategy")
			}
		}
	}

	if obs, ok := doc["outbounds"].([]any); ok {
		kept := make([]any, 0, len(obs))
		for _, ob := range obs {
			if m, ok := ob.(map[string]any); ok {
				if t, _ := m["type"].(string); t == "block" || t == "dns" {
					continue
				}
			}
			kept = append(kept, ob)
		}
		doc["outbounds"] = kept
	}

	dnsRemote := "https://1.1.1.1/dns-query"
	if dns, ok := doc["dns"].(map[string]any); ok {
		if servers, ok := dns["servers"].([]any); ok {
			for _, s := range servers {
				if m, ok := s.(map[string]any); ok {
					if tag, _ := m["tag"].(string); tag == "remote" {
						if a, _ := m["address"].(string); a != "" {
							dnsRemote = a
						}
					}
				}
			}
		}
	}
	doc["dns"] = map[string]any{
		"servers": []any{
			typedDNSServer("remote", dnsRemote, "proxy-out"),
			map[string]any{"tag": "dns-direct", "type": "udp", "server": "1.1.1.1"},
		},
		"final": "remote",
	}

	route, _ := doc["route"].(map[string]any)
	if route == nil {
		route = map[string]any{}
	}
	oldRules, _ := route["rules"].([]any)
	newRules := []any{map[string]any{"action": "sniff"}}
	var ruleSets []any
	seenRS := map[string]bool{}
	addRuleSet := func(kind, code string) string {
		clean := strings.TrimPrefix(strings.TrimPrefix(code, "geosite-"), "geoip-")
		tag := kind + "-" + clean
		if !seenRS[tag] {
			seenRS[tag] = true
			base := "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set"
			if kind == "geoip" {
				base = "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set"
			}
			ruleSets = append(ruleSets, map[string]any{
				"tag":             tag,
				"type":            "remote",
				"format":          "binary",
				"url":             fmt.Sprintf("%s/%s-%s.srs", base, kind, clean),
				"download_detour": "proxy-out",
			})
		}
		return tag
	}

	for _, r := range oldRules {
		m, ok := r.(map[string]any)
		if !ok {
			continue
		}
		if p, _ := m["protocol"].(string); p == "dns" {
			newRules = append(newRules, map[string]any{"protocol": "dns", "action": "hijack-dns"})
			continue
		}
		nr := map[string]any{}
		// Domain matchers carry over verbatim: 1.12 changed the geo fields, not
		// these. domain_regex is how a wildcard routing entry ("rutracker.*")
		// reaches the router, so dropping it here would silently unroute it.
		for _, k := range []string{"domain", "domain_suffix", "domain_keyword", "domain_regex"} {
			if v, ok := m[k]; ok {
				nr[k] = v
			}
		}
		var tags []any
		if gs, ok := m["geosite"].([]any); ok {
			for _, g := range gs {
				if name, ok := g.(string); ok {
					tags = append(tags, addRuleSet("geosite", name))
				}
			}
		}
		if gi, ok := m["geoip"].([]any); ok {
			for _, g := range gi {
				if name, ok := g.(string); ok {
					tags = append(tags, addRuleSet("geoip", name))
				}
			}
		}
		if len(tags) > 0 {
			nr["rule_set"] = tags
		}
		if ob, _ := m["outbound"].(string); ob == "block" {
			nr["action"] = "reject"
		} else if ob != "" {
			nr["outbound"] = ob
		}
		if len(nr) > 0 {
			newRules = append(newRules, nr)
		}
	}
	route["rules"] = newRules
	if len(ruleSets) > 0 {
		route["rule_set"] = ruleSets
	} else {
		delete(route, "rule_set")
	}
	route["default_domain_resolver"] = map[string]any{"server": "dns-direct", "strategy": "prefer_ipv4"}
	doc["route"] = route
}
