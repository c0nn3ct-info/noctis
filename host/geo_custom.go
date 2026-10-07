package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// A routing profile can name its own geosite.dat / geoip.dat (Happ's
// Geositeurl / Geoipurl): RoscomVPN's categories -- `whitelist`, `torrent`,
// geoip `direct` -- exist only there. sing-box gets those as .srs rule-sets
// from the extension; xray and mihomo read .dat files off disk, so the helper
// fetches the profile's databases, keeps them, and points the core at a
// directory holding them in place of the ones it ships with.

// geoURLs is the profile's own databases, as the extension sends them on
// start/reload. Either may be empty; that database stays the built-in one.
type geoURLs struct {
	Geosite string `json:"geositeUrl"`
	Geoip   string `json:"geoipUrl"`
}

var maxGeoBytes int64 = 64 << 20

var (
	// geoCacheRoot keeps downloads across connects, keyed by URL.
	geoCacheRoot = func() string { return filepath.Join(os.TempDir(), "noctis", "geo-cache") }
	// A copy younger than this is used as is; an older one is still used, and
	// replaced in the background for the next connect.
	geoFreshFor = 24 * time.Hour
	// How long a connect waits for a database it has never fetched. The
	// extension gives start/reload 14s and the core needs up to 5s of that to
	// bind, so past this the connect goes ahead on the built-in database.
	geoFirstWait = 6 * time.Second
	geoClient    = &http.Client{Timeout: 60 * time.Second}
)

var (
	geoFetchMu sync.Mutex
	geoFetches = map[string]chan struct{}{}
)

func geoCachePath(url string) string {
	sum := sha256.Sum256([]byte(url))
	return filepath.Join(geoCacheRoot(), hex.EncodeToString(sum[:8])+".dat")
}

// cachedGeo returns the local copy of url, fetching it first when there is
// none (for at most geoFirstWait) and refreshing it in the background when it
// is stale. "" means no copy is ready for this connect.
func (s *supervisor) cachedGeo(url string) string {
	path := geoCachePath(url)
	fi, err := os.Stat(path)
	if err == nil {
		if time.Since(fi.ModTime()) > geoFreshFor {
			s.fetchGeo(url, path)
		}
		return path
	}
	select {
	case <-s.fetchGeo(url, path):
	case <-time.After(geoFirstWait):
		return ""
	}
	if _, err := os.Stat(path); err != nil {
		return ""
	}
	return path
}

// fetchGeo downloads url to path unless a download of it is already running,
// and returns a channel that closes when that download ends either way.
func (s *supervisor) fetchGeo(url, path string) <-chan struct{} {
	geoFetchMu.Lock()
	defer geoFetchMu.Unlock()
	if done, ok := geoFetches[url]; ok {
		return done
	}
	done := make(chan struct{})
	geoFetches[url] = done
	go func() {
		err := downloadGeo(url, path)
		geoFetchMu.Lock()
		delete(geoFetches, url)
		geoFetchMu.Unlock()
		close(done)
		if err != nil {
			s.helperLog("geo database %s not fetched: %v", url, err)
		}
	}()
	return done
}

// downloadGeo writes url to path only once the body has read as a geo
// database: a captive portal's HTML or a truncated file would otherwise reach
// the core, which aborts on it.
func downloadGeo(url, path string) error {
	if !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "http://") {
		return errors.New("not an http(s) URL")
	}
	resp, err := geoClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp := path + ".part"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	n, err := io.Copy(f, io.LimitReader(resp.Body, maxGeoBytes+1))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err == nil && n > maxGeoBytes {
		err = fmt.Errorf("larger than %d MB", maxGeoBytes>>20)
	}
	if err == nil {
		var codes map[string]bool
		if codes, err = readGeoCodes(tmp); err == nil && len(codes) == 0 {
			err = errors.New("no categories in it")
		}
		if err != nil {
			err = fmt.Errorf("not a geo database: %w", err)
		}
	}
	if err == nil {
		err = os.Rename(tmp, path)
	}
	if err != nil {
		_ = os.Remove(tmp)
	}
	return err
}

// customGeoDir assembles the directory a core reads its databases from for
// this connect: for each database the profile names and could get, its own
// categories over the built-in ones; the built-in database as is for the rest.
// "" means nothing of the profile's is ready, and the core keeps its usual
// directory.
func (s *supervisor) customGeoDir(coreID, defDir string, urls geoURLs) string {
	picked := map[string]string{}
	for name, url := range map[string]string{"geosite.dat": urls.Geosite, "geoip.dat": urls.Geoip} {
		if url == "" {
			continue
		}
		if p := s.cachedGeo(url); p != "" {
			picked[name] = p
		} else {
			s.helperLog("%s: %s is still downloading; the built-in %s serves this connect", coreID, url, name)
		}
	}
	if len(picked) == 0 {
		return ""
	}
	dir := filepath.Join(os.TempDir(), "noctis", coreID+"-geo")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		s.helperLog("%s: profile geo databases not used: %v", coreID, err)
		return ""
	}
	for _, name := range geoAssetNames {
		def, to := filepath.Join(defDir, name), filepath.Join(dir, name)
		var err error
		if own, ok := picked[name]; ok {
			err = mergeGeo(own, def, to)
		} else {
			err = syncFile(def, to)
		}
		if err != nil {
			s.helperLog("%s: profile geo databases not used: %v", coreID, err)
			return ""
		}
	}
	return dir
}

// mergeGeo writes the profile's database followed by every built-in category
// it lacks. The union matters to mihomo most: it checks a geosite.dat for
// `cn` and, finding none -- RoscomVPN's has none -- replaces the file with a
// download of its own. A category the profile's database does carry keeps the
// profile's definition. The result is rebuilt only when an input changed.
func mergeGeo(own, def, to string) error {
	stamp := fileStamp(own) + "|" + fileStamp(def)
	if b, err := os.ReadFile(to + ".src"); err == nil && string(b) == stamp {
		if _, err := os.Stat(to); err == nil {
			return nil
		}
	}
	ownBytes, err := os.ReadFile(own)
	if err != nil {
		return err
	}
	have := map[string]bool{}
	if err := walkProto(ownBytes, func(num int, entry []byte) error {
		if num == 1 {
			have[geoEntryCode(entry)] = true
		}
		return nil
	}); err != nil {
		return err
	}
	out := append([]byte(nil), ownBytes...)
	if defBytes, err := os.ReadFile(def); err == nil {
		// An unreadable built-in database adds nothing; the profile's stands alone.
		_ = walkProto(defBytes, func(num int, entry []byte) error {
			if num == 1 && !have[geoEntryCode(entry)] {
				out = appendProtoField(out, 1, entry)
			}
			return nil
		})
	}
	tmp := to + ".new"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, to); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return os.WriteFile(to+".src", []byte(stamp), 0o600)
}

// fileStamp names a file's identity for mergeGeo's rebuild check.
func fileStamp(path string) string {
	fi, err := os.Stat(path)
	if err != nil {
		return path + ":none"
	}
	return fmt.Sprintf("%s:%d:%d", path, fi.Size(), fi.ModTime().UnixNano())
}

// geoEntryCode is the lowercase category code of one database entry.
func geoEntryCode(entry []byte) string {
	code := ""
	_ = walkProto(entry, func(n int, v []byte) error {
		if n == 1 {
			code = strings.ToLower(string(v))
			return errStopWalk
		}
		return nil
	})
	return code
}

// appendProtoField appends one length-delimited protobuf field.
func appendProtoField(b []byte, num int, payload []byte) []byte {
	b = binary.AppendUvarint(b, uint64(num)<<3|2)
	b = binary.AppendUvarint(b, uint64(len(payload)))
	return append(b, payload...)
}

// syncFile copies from to to unless to already has from's size and is not
// older. A missing from removes to, so a stale database never outlives the
// one it was copied from.
func syncFile(from, to string) error {
	fi, err := os.Stat(from)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			if rerr := os.Remove(to); rerr != nil && !errors.Is(rerr, os.ErrNotExist) {
				return rerr
			}
			return nil
		}
		return err
	}
	if ti, err := os.Stat(to); err == nil && ti.Size() == fi.Size() && !ti.ModTime().Before(fi.ModTime()) {
		return nil
	}
	return copyFile(from, to)
}

func (s *supervisor) setGeoURLs(u geoURLs) {
	s.mu.Lock()
	s.geo = u
	s.mu.Unlock()
}

func (s *supervisor) geoURLs() geoURLs {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.geo
}
