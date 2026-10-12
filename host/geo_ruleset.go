package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// sing-box matches geo categories through rule-sets, and the extension names
// them as remote .srs files on GitHub. sing-box downloads every one of those
// before it opens its SOCKS port, through the proxy it is about to serve: a
// server that resets the connection, a slow GitHub or a blocked one, and the
// connect fails on rule data rather than on anything about the server.
//
// xray and mihomo read the same categories from geosite.dat / geoip.dat on
// disk. So the helper builds sing-box's rule-sets from those databases -- the
// profile's own when it names them, merged over the built-in ones -- compiles
// each with sing-box itself, keeps the result, and points the config at the
// local file. A connect then reads rule data off disk on every core, and all
// three match a category against the same list.
//
// A category the databases lack keeps its remote rule-set when the extension
// gave it a URL (sing-box may still find it on GitHub), and is skipped with a
// log line when it did not. Remote rule-sets that remain are cached by
// sing-box itself, so only the first connect ever waits for them.

var (
	// geoRuleSetRoot keeps compiled rule-sets across connects.
	geoRuleSetRoot = func() string { return filepath.Join(os.TempDir(), "noctis", "rule-sets") }
	// geoAssetDir is where the installers put geosite.dat / geoip.dat: beside
	// the helper.
	geoAssetDir = func() string {
		exe, err := osExecutable()
		if err != nil {
			return ""
		}
		return filepath.Dir(exe)
	}
	// compileRuleSet turns a source rule-set into a binary one with the sing-box
	// that will read it. A seam for tests.
	compileRuleSet = func(bin, src, out string) error {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		b, err := exec.CommandContext(ctx, bin, "rule-set", "compile", "--output", out, src).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%v: %s", err, strings.TrimSpace(string(b)))
		}
		return nil
	}
)

// ruleSetSourceVersion is the source format sing-box 1.10 and later read.
const ruleSetSourceVersion = 2

// geoRuleSetTag splits a rule-set tag the extension writes ("geosite-cn",
// "geosite-google@cn", "geoip-ru") into kind, category code and attribute.
func geoRuleSetTag(tag string) (kind, code, attr string, ok bool) {
	for _, k := range []string{"geosite", "geoip"} {
		if rest, found := strings.CutPrefix(strings.ToLower(tag), k+"-"); found && rest != "" {
			if k == "geosite" {
				if at := strings.IndexByte(rest, '@'); at >= 0 {
					rest, attr = rest[:at], rest[at+1:]
				}
			}
			return k, rest, attr, rest != ""
		}
	}
	return "", "", "", false
}

// headlessRule is one source rule-set rule; only the fields geo data fills.
type headlessRule struct {
	Domain        []string `json:"domain,omitempty"`
	DomainSuffix  []string `json:"domain_suffix,omitempty"`
	DomainKeyword []string `json:"domain_keyword,omitempty"`
	DomainRegex   []string `json:"domain_regex,omitempty"`
	IPCIDR        []string `json:"ip_cidr,omitempty"`
}

func (r headlessRule) empty() bool {
	return len(r.Domain)+len(r.DomainSuffix)+len(r.DomainKeyword)+len(r.DomainRegex)+len(r.IPCIDR) == 0
}

// geoEntries returns the raw database entry of each wanted code (lowercase).
func geoEntries(path string, want map[string]bool) (map[string][]byte, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	out := map[string][]byte{}
	err = walkProto(b, func(num int, entry []byte) error {
		if num != 1 {
			return nil
		}
		if code := geoEntryCode(entry); want[code] {
			if _, seen := out[code]; !seen {
				out[code] = entry
			}
		}
		return nil
	})
	return out, err
}

// Domain.Type in v2fly's geosite.proto.
const (
	geoDomainPlain  = 0
	geoDomainRegex  = 1
	geoDomainSuffix = 2
	geoDomainFull   = 3
)

// siteRule reads one geosite entry into a rule. attr, when set, keeps only the
// domains carrying that attribute ("google@cn").
func siteRule(entry []byte, attr string) (headlessRule, error) {
	var r headlessRule
	err := walkProtoFields(entry, func(num int, varint uint64, payload []byte) error {
		if num != 2 {
			return nil
		}
		var typ uint64
		var value string
		attrs := map[string]bool{}
		if err := walkProtoFields(payload, func(n int, v uint64, p []byte) error {
			switch n {
			case 1:
				typ = v
			case 2:
				value = string(p)
			case 3:
				_ = walkProtoFields(p, func(an int, _ uint64, ap []byte) error {
					if an == 1 {
						attrs[strings.ToLower(string(ap))] = true
					}
					return nil
				})
			}
			return nil
		}); err != nil {
			return err
		}
		if value == "" || (attr != "" && !attrs[attr]) {
			return nil
		}
		switch typ {
		case geoDomainPlain:
			r.DomainKeyword = append(r.DomainKeyword, value)
		case geoDomainRegex:
			// v2fly writes RE2, which is what sing-box compiles; one it cannot
			// would fail the whole rule-set, so it goes alone.
			if _, err := regexp.Compile(value); err == nil {
				r.DomainRegex = append(r.DomainRegex, value)
			}
		case geoDomainSuffix:
			r.DomainSuffix = append(r.DomainSuffix, value)
		case geoDomainFull:
			r.Domain = append(r.Domain, value)
		}
		return nil
	})
	return r, err
}

// ipRule reads one geoip entry into a rule. An entry marked reverse_match
// means "everything but these", which a rule-set cannot say; ok is false then.
func ipRule(entry []byte) (r headlessRule, ok bool, err error) {
	ok = true
	err = walkProtoFields(entry, func(num int, varint uint64, payload []byte) error {
		switch num {
		case 2:
			var ip []byte
			var prefix uint64
			_ = walkProtoFields(payload, func(n int, v uint64, p []byte) error {
				switch n {
				case 1:
					ip = p
				case 2:
					prefix = v
				}
				return nil
			})
			if len(ip) == net.IPv4len || len(ip) == net.IPv6len {
				r.IPCIDR = append(r.IPCIDR, fmt.Sprintf("%s/%d", net.IP(ip).String(), prefix))
			}
		case 3:
			if varint != 0 {
				ok = false
			}
		}
		return nil
	})
	return r, ok, err
}

// walkProtoFields is walkProto that also hands over varint fields.
func walkProtoFields(b []byte, fn func(num int, varint uint64, payload []byte) error) error {
	for i := 0; i < len(b); {
		key, n := protoVarint(b[i:])
		if n == 0 {
			return errGeoTruncated
		}
		i += n
		num := int(key >> 3)
		switch key & 7 {
		case 0:
			v, n := protoVarint(b[i:])
			if n == 0 {
				return errGeoTruncated
			}
			i += n
			if err := fn(num, v, nil); err != nil {
				return err
			}
		case 1:
			i += 8
		case 5:
			i += 4
		case 2:
			l, n := protoVarint(b[i:])
			if n == 0 || uint64(len(b)-i-n) < l {
				return errGeoTruncated
			}
			i += n
			if err := fn(num, 0, b[i:i+int(l)]); err != nil {
				return err
			}
			i += int(l)
		default:
			return errGeoTruncated
		}
		if i > len(b) {
			return errGeoTruncated
		}
	}
	return nil
}

// geoRuleSetJob is one rule-set to build.
type geoRuleSetJob struct {
	tag, kind, code, attr string
	db                    string // the .dat it comes from
}

// buildGeoRuleSet writes the compiled rule-set for job and returns its path
// and format. A copy built from the same database by the same sing-box is
// reused. "" means the database has nothing for it.
func buildGeoRuleSet(bin, binStamp string, job geoRuleSetJob, entry []byte) (string, string, error) {
	var rule headlessRule
	var err error
	if job.kind == "geoip" {
		var ok bool
		if rule, ok, err = ipRule(entry); err == nil && !ok {
			return "", "", nil
		}
	} else {
		rule, err = siteRule(entry, job.attr)
	}
	if err != nil {
		return "", "", err
	}
	if rule.empty() {
		return "", "", nil
	}
	base := ruleSetBase(job, binStamp)
	if _, err := os.Stat(base + ".srs"); err == nil {
		return base + ".srs", "binary", nil
	}
	if err := os.MkdirAll(geoRuleSetRoot(), 0o700); err != nil {
		return "", "", err
	}
	src, err := json.Marshal(map[string]any{"version": ruleSetSourceVersion, "rules": []headlessRule{rule}})
	if err != nil {
		return "", "", err
	}
	if err := os.WriteFile(base+".json", src, 0o600); err != nil {
		return "", "", err
	}
	if err := compileRuleSet(bin, base+".json", base+".srs.part"); err != nil {
		// sing-box reads the source format as well, only slower to load.
		_ = os.Remove(base + ".srs.part")
		return base + ".json", "source", nil
	}
	if err := os.Rename(base+".srs.part", base+".srs"); err != nil {
		return base + ".json", "source", nil
	}
	_ = os.Remove(base + ".json")
	return base + ".srs", "binary", nil
}

// ruleSetBase is the cache path, less extension, of job's rule-set: one per
// database copy, tag and sing-box binary, since the binary format follows the
// sing-box that compiles it.
func ruleSetBase(job geoRuleSetJob, binStamp string) string {
	sum := sha256.Sum256([]byte(fileStamp(job.db) + "|" + job.tag + "|" + binStamp))
	return filepath.Join(geoRuleSetRoot(), hex.EncodeToString(sum[:12]))
}

// localizeRuleSets points the config's geo rule-sets at files built from the
// geo databases. A config it cannot parse goes out unchanged.
func (s *supervisor) localizeRuleSets(bin, dataDir string, raw []byte) []byte {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return raw
	}
	route, _ := doc["route"].(map[string]any)
	sets, _ := route["rule_set"].([]any)
	if len(sets) == 0 {
		return raw
	}

	dir := geoAssetDir()
	if custom := s.customGeoDir("sing-box", dir, s.geoURLs()); custom != "" {
		dir = custom
	}
	dbs := map[string]string{
		"geosite": filepath.Join(dir, "geosite.dat"),
		"geoip":   filepath.Join(dir, "geoip.dat"),
	}

	var jobs []geoRuleSetJob
	want := map[string]map[string]bool{"geosite": {}, "geoip": {}}
	for _, v := range sets {
		m, _ := v.(map[string]any)
		if t, _ := m["type"].(string); t != "remote" {
			continue
		}
		tag, _ := m["tag"].(string)
		kind, code, attr, ok := geoRuleSetTag(tag)
		if !ok {
			continue
		}
		jobs = append(jobs, geoRuleSetJob{tag: tag, kind: kind, code: code, attr: attr, db: dbs[kind]})
		want[kind][code] = true
	}
	if len(jobs) == 0 {
		return raw
	}

	entries := map[string]map[string][]byte{}
	for kind, codes := range want {
		if len(codes) == 0 {
			continue
		}
		// An unreadable database builds nothing; its rule-sets stay remote.
		if e, err := geoEntries(dbs[kind], codes); err == nil {
			entries[kind] = e
		}
	}

	binStamp := fileStamp(bin)
	type built struct{ path, format string }
	results := make([]built, len(jobs))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	for i, job := range jobs {
		entry := entries[job.kind][job.code]
		if entry == nil {
			continue
		}
		wg.Add(1)
		go func(i int, job geoRuleSetJob, entry []byte) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			path, format, err := buildGeoRuleSet(bin, binStamp, job, entry)
			if err != nil {
				s.helperLog("sing-box rule-set %s not built: %v", job.tag, err)
				return
			}
			results[i] = built{path, format}
		}(i, job, entry)
	}
	wg.Wait()

	byTag := map[string]built{}
	for i, job := range jobs {
		byTag[job.tag] = results[i]
	}
	var local, remote, skipped []string
	keptSets := make([]any, 0, len(sets))
	for _, v := range sets {
		m, _ := v.(map[string]any)
		tag, _ := m["tag"].(string)
		b, isJob := byTag[tag]
		switch {
		case !isJob:
			keptSets = append(keptSets, v)
		case b.path != "":
			local = append(local, tag)
			keptSets = append(keptSets, map[string]any{"tag": tag, "type": "local", "format": b.format, "path": b.path})
		case m["url"] != nil && m["url"] != "":
			remote = append(remote, tag)
			keptSets = append(keptSets, v)
		default:
			skipped = append(skipped, tag)
		}
	}
	route["rule_set"] = keptSets
	if len(skipped) > 0 {
		gone := map[string]bool{}
		for _, t := range skipped {
			gone[t] = true
		}
		dropRuleSetRefs(route, gone)
		if dns, ok := doc["dns"].(map[string]any); ok {
			dropRuleSetRefs(dns, gone)
		}
		if len(keptSets) == 0 {
			delete(route, "rule_set")
		}
		s.helperLog("sing-box: geo databases lack %s; those rules are skipped", strings.Join(sorted(skipped), ", "))
	}
	if len(remote) > 0 {
		enableRuleSetCache(doc, dataDir)
		s.helperLog("sing-box: geo databases lack %s; sing-box fetches those itself", strings.Join(sorted(remote), ", "))
	}
	out, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return raw
	}
	return out
}

// dropRuleSetRefs removes the gone tags from every rule under parent["rules"],
// logical rules included. A rule whose only matcher was those rule-sets goes:
// left without one it would match every connection.
func dropRuleSetRefs(parent map[string]any, gone map[string]bool) {
	rules, ok := parent["rules"].([]any)
	if !ok {
		return
	}
	kept := make([]any, 0, len(rules))
	for _, r := range rules {
		m, ok := r.(map[string]any)
		if !ok {
			kept = append(kept, r)
			continue
		}
		if _, nested := m["rules"].([]any); nested {
			dropRuleSetRefs(m, gone)
			if inner, _ := m["rules"].([]any); len(inner) == 0 {
				continue
			}
		}
		if refs, ok := m["rule_set"].([]any); ok {
			left := make([]any, 0, len(refs))
			for _, t := range refs {
				if s, _ := t.(string); !gone[s] {
					left = append(left, t)
				}
			}
			if len(left) == 0 {
				continue
			}
			m["rule_set"] = left
		}
		kept = append(kept, m)
	}
	parent["rules"] = kept
}

// enableRuleSetCache has sing-box keep the remote rule-sets it fetched, so
// the next connect starts from the copy and refreshes it in the background.
func enableRuleSetCache(doc map[string]any, dataDir string) {
	exp, ok := doc["experimental"].(map[string]any)
	if !ok {
		exp = map[string]any{}
		doc["experimental"] = exp
	}
	if _, set := exp["cache_file"]; set {
		return
	}
	exp["cache_file"] = map[string]any{"enabled": true, "path": filepath.Join(dataDir, "cache.db")}
}

func sorted(in []string) []string {
	out := append([]string(nil), in...)
	sort.Strings(out)
	return out
}
