package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

// xray and mihomo abort at startup on a geosite/geoip category their database
// does not carry ("code not found in geosite.dat: TORRENT"), so one category
// from a profile written for other data -- RoscomVPN's `torrent`, `whitelist`,
// geoip `direct` -- stops the whole tunnel. sing-box already drops those in the
// extension, which can check SagerNet's list; for these two cores only the
// helper can see the .dat they will read, so it prunes the rules against it
// before launch. The rest of the profile keeps working.

// geoPruner is implemented by cores that read v2fly-format geo databases.
type geoPruner interface {
	// GeoDir is where the core will look for geosite.dat / geoip.dat.
	GeoDir(bin, dataDir string) string
	// UseGeoDir points the core at dir instead: it returns the data dir to run
	// with and any environment to add.
	UseGeoDir(dir, dataDir string) (string, []string)
	// PruneUnknownGeo drops the categories f does not know and returns them as
	// "geosite:x" / "geoip:x", sorted.
	PruneUnknownGeo(raw []byte, f geoFilter) ([]byte, []string, error)
}

// pruneUnknownGeo applies the core's geoPruner, if it has one, and names what
// it skipped in the log: a rule that silently stops matching is otherwise
// invisible from the browser. A config it cannot parse goes out unchanged, and
// the core reports the problem itself.
func (s *supervisor) pruneUnknownGeo(core Core, geoDir string, raw []byte) []byte {
	p, ok := core.(geoPruner)
	if !ok {
		return raw
	}
	out, dropped, err := p.PruneUnknownGeo(raw, loadGeoFilter(geoDir))
	if err != nil {
		return raw
	}
	if len(dropped) > 0 {
		s.helperLog("%s geo databases lack %s; those rules are skipped", core.ID(), strings.Join(dropped, ", "))
	}
	return out
}

// geoFilter holds the lowercase category codes of each database. A nil set
// means that database is unreadable, and nothing is pruned against it.
type geoFilter struct {
	site, ip map[string]bool
}

func (f geoFilter) known(kind, code string) bool {
	set := f.site
	if kind == "geoip" {
		set = f.ip
	}
	return set == nil || set[strings.ToLower(code)]
}

type geoCacheEntry struct {
	size  int64
	mtime int64
	codes map[string]bool
}

var (
	geoCacheMu sync.Mutex
	geoCache   = map[string]geoCacheEntry{}
)

func loadGeoFilter(dir string) geoFilter {
	return geoFilter{
		site: cachedGeoCodes(filepath.Join(dir, "geosite.dat")),
		ip:   cachedGeoCodes(filepath.Join(dir, "geoip.dat")),
	}
}

// cachedGeoCodes reparses a database only when it changed: geosite.dat is
// tens of megabytes and every connect would otherwise read it again.
func cachedGeoCodes(path string) map[string]bool {
	fi, err := os.Stat(path)
	if err != nil {
		return nil
	}
	geoCacheMu.Lock()
	defer geoCacheMu.Unlock()
	if e, ok := geoCache[path]; ok && e.size == fi.Size() && e.mtime == fi.ModTime().UnixNano() {
		return e.codes
	}
	codes, err := readGeoCodes(path)
	if err != nil {
		return nil
	}
	geoCache[path] = geoCacheEntry{size: fi.Size(), mtime: fi.ModTime().UnixNano(), codes: codes}
	return codes
}

var errGeoTruncated = errors.New("geo database truncated")

// readGeoCodes lists the category codes of a geosite.dat / geoip.dat: a
// protobuf message whose repeated field 1 holds entries, each naming its code
// in its own field 1. Only those names are read; the rest is skipped.
func readGeoCodes(path string) (map[string]bool, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	codes := map[string]bool{}
	err = walkProto(b, func(num int, payload []byte) error {
		if num != 1 {
			return nil
		}
		return walkProto(payload, func(n int, v []byte) error {
			if n == 1 {
				codes[strings.ToLower(string(v))] = true
				return errStopWalk
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return codes, nil
}

var errStopWalk = errors.New("stop")

// walkProto calls fn for each length-delimited field and skips the others.
func walkProto(b []byte, fn func(num int, payload []byte) error) error {
	for i := 0; i < len(b); {
		key, n := protoVarint(b[i:])
		if n == 0 {
			return errGeoTruncated
		}
		i += n
		switch key & 7 {
		case 0:
			_, n := protoVarint(b[i:])
			if n == 0 {
				return errGeoTruncated
			}
			i += n
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
			if err := fn(int(key>>3), b[i:i+int(l)]); err != nil {
				if err == errStopWalk {
					return nil
				}
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

func protoVarint(b []byte) (uint64, int) {
	var v uint64
	for i := 0; i < len(b) && i < 10; i++ {
		v |= uint64(b[i]&0x7f) << (7 * i)
		if b[i] < 0x80 {
			return v, i + 1
		}
	}
	return 0, 0
}

// geoToken splits "geosite:x", "geosite:x@attr" and "geoip:!x" into kind and
// bare code; anything else (domains, CIDRs, ext: files) reports ok=false.
func geoToken(s string) (kind, code string, ok bool) {
	lower := strings.ToLower(s)
	for _, k := range []string{"geosite", "geoip"} {
		if rest, found := strings.CutPrefix(lower, k+":"); found {
			rest = strings.TrimPrefix(rest, "!")
			if at := strings.IndexByte(rest, '@'); at >= 0 {
				rest = rest[:at]
			}
			return k, rest, rest != ""
		}
	}
	return "", "", false
}

func sortedKeys(m map[string]bool) []string {
	if len(m) == 0 {
		return nil
	}
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// xrayMatchers are the rule fields that select traffic. A rule left with none
// of them matches every connection, so it goes rather than run that way.
var xrayMatchers = []string{
	"domain", "ip", "port", "sourcePort", "localPort", "network", "source", "sourceIP",
	"localIP", "user", "vlessRoute", "inboundTag", "protocol", "attrs", "process",
}

func (xrayCore) GeoDir(bin, _ string) string {
	if dir := os.Getenv("XRAY_LOCATION_ASSET"); dir != "" {
		return dir
	}
	return filepath.Dir(bin)
}

// UseGeoDir sets xray's asset path, which it reads for every geo lookup.
func (xrayCore) UseGeoDir(dir, dataDir string) (string, []string) {
	return dataDir, []string{"XRAY_LOCATION_ASSET=" + dir}
}

func (xrayCore) PruneUnknownGeo(raw []byte, f geoFilter) ([]byte, []string, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, nil, err
	}
	routing, _ := doc["routing"].(map[string]any)
	rules, _ := routing["rules"].([]any)
	if rules == nil {
		return raw, nil, nil
	}
	dropped := map[string]bool{}
	kept := make([]any, 0, len(rules))
	for _, r := range rules {
		m, ok := r.(map[string]any)
		if !ok {
			kept = append(kept, r)
			continue
		}
		emptied := false
		for _, field := range []string{"domain", "ip"} {
			list, ok := m[field].([]any)
			if !ok {
				continue
			}
			left := make([]any, 0, len(list))
			for _, v := range list {
				s, _ := v.(string)
				if kind, code, isGeo := geoToken(s); isGeo && !f.known(kind, code) {
					dropped[kind+":"+code] = true
					continue
				}
				left = append(left, v)
			}
			if len(left) == 0 {
				delete(m, field)
				emptied = true
			} else {
				m[field] = left
			}
		}
		if emptied && !hasAnyKey(m, xrayMatchers) {
			continue
		}
		kept = append(kept, m)
	}
	if len(dropped) == 0 {
		return raw, nil, nil
	}
	routing["rules"] = kept
	out, err := json.MarshalIndent(doc, "", "  ")
	return out, sortedKeys(dropped), err
}

func hasAnyKey(m map[string]any, keys []string) bool {
	for _, k := range keys {
		if _, ok := m[k]; ok {
			return true
		}
	}
	return false
}

func (mihomoCore) GeoDir(_, dataDir string) string { return dataDir }

// UseGeoDir runs mihomo with dir as its home: mihomo has no separate setting
// for where its databases live.
func (mihomoCore) UseGeoDir(dir, _ string) (string, []string) { return dir, nil }

func (mihomoCore) PruneUnknownGeo(raw []byte, f geoFilter) ([]byte, []string, error) {
	var doc map[string]any
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, nil, err
	}
	rules, _ := doc["rules"].([]any)
	dropped := map[string]bool{}
	kept := make([]any, 0, len(rules))
	for _, r := range rules {
		s, _ := r.(string)
		parts := strings.SplitN(s, ",", 3)
		if len(parts) == 3 {
			kind := strings.ToLower(strings.TrimSpace(parts[0]))
			code := strings.ToLower(strings.TrimSpace(parts[1]))
			if (kind == "geosite" || kind == "geoip") && !f.known(kind, code) {
				dropped[kind+":"+code] = true
				continue
			}
		}
		kept = append(kept, r)
	}
	if len(dropped) == 0 {
		return raw, nil, nil
	}
	doc["rules"] = kept
	out, err := yaml.Marshal(doc)
	return out, sortedKeys(dropped), err
}
