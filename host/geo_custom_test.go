package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// geoServer serves body at every path and counts the requests it answers.
func geoServer(t *testing.T, status int, body []byte, delay time.Duration) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		time.Sleep(delay)
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv, &hits
}

// isolateGeo points the download cache and the per-core directories at temp
// dirs, so a test never sees another's files.
func isolateGeo(t *testing.T) {
	t.Helper()
	root := t.TempDir()
	prev := geoCacheRoot
	geoCacheRoot = func() string { return root }
	t.Cleanup(func() { geoCacheRoot = prev })
	t.Setenv("TMPDIR", t.TempDir())
}

func TestDownloadGeo(t *testing.T) {
	isolateGeo(t)
	ok, _ := geoServer(t, 200, geoDat("WHITELIST"), 0)
	path := filepath.Join(t.TempDir(), "x.dat")
	if err := downloadGeo(ok.URL+"/geosite.dat", path); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(path); !bytes.Equal(b, geoDat("WHITELIST")) {
		t.Fatalf("file=%q", b)
	}

	bad := []struct {
		name string
		url  string
		want string
	}{
		{"scheme", "ftp://example.com/geosite.dat", "not an http(s) URL"},
	}
	missing, _ := geoServer(t, 404, nil, 0)
	bad = append(bad, struct{ name, url, want string }{"status", missing.URL, "HTTP 404"})
	html, _ := geoServer(t, 200, []byte("<html>portal</html>"), 0)
	bad = append(bad, struct{ name, url, want string }{"html", html.URL, "not a geo database"})
	empty, _ := geoServer(t, 200, nil, 0)
	bad = append(bad, struct{ name, url, want string }{"empty", empty.URL, "no categories"})
	for _, c := range bad {
		out := filepath.Join(t.TempDir(), "y.dat")
		err := downloadGeo(c.url, out)
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%s: err=%v", c.name, err)
		}
		if _, err := os.Stat(out); err == nil {
			t.Fatalf("%s: file written", c.name)
		}
		if _, err := os.Stat(out + ".part"); err == nil {
			t.Fatalf("%s: partial file left", c.name)
		}
	}

	prev := maxGeoBytes
	maxGeoBytes = 4
	defer func() { maxGeoBytes = prev }()
	if err := downloadGeo(ok.URL, filepath.Join(t.TempDir(), "z.dat")); err == nil || !strings.Contains(err.Error(), "larger than") {
		t.Fatalf("oversize err=%v", err)
	}
}

func TestCachedGeo(t *testing.T) {
	isolateGeo(t)
	sup := newSupervisor(nil)
	srv, hits := geoServer(t, 200, geoDat("TORRENT"), 0)
	url := srv.URL + "/geosite.dat"

	// First connect fetches and waits for it.
	path := sup.cachedGeo(url)
	if path == "" || hits.Load() != 1 {
		t.Fatalf("path=%q hits=%d", path, hits.Load())
	}
	// A fresh copy is used without asking again.
	if got := sup.cachedGeo(url); got != path || hits.Load() != 1 {
		t.Fatalf("fresh: path=%q hits=%d", got, hits.Load())
	}
	// A stale copy is used now and replaced in the background.
	old := time.Now().Add(-2 * geoFreshFor)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	if got := sup.cachedGeo(url); got != path {
		t.Fatalf("stale: path=%q", got)
	}
	<-sup.fetchGeo(url, path)
	deadline := time.Now().Add(2 * time.Second)
	for hits.Load() < 2 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if hits.Load() < 2 {
		t.Fatalf("stale copy not refreshed, hits=%d", hits.Load())
	}
}

func TestCachedGeoGivesUpOnASlowFirstFetch(t *testing.T) {
	isolateGeo(t)
	prev := geoFirstWait
	geoFirstWait = 20 * time.Millisecond
	defer func() { geoFirstWait = prev }()
	notify, events := collectNotify()
	sup := newSupervisor(notify)
	slow, _ := geoServer(t, 200, geoDat("TORRENT"), 300*time.Millisecond)
	if got := sup.cachedGeo(slow.URL); got != "" {
		t.Fatalf("slow first fetch path=%q", got)
	}
	// The download carries on and serves the next connect.
	<-sup.fetchGeo(slow.URL, geoCachePath(slow.URL))
	if _, err := os.Stat(geoCachePath(slow.URL)); err != nil {
		t.Fatalf("background fetch did not land: %v", err)
	}

	// A first fetch that fails leaves nothing, and says why.
	missing, _ := geoServer(t, 404, nil, 0)
	if got := sup.cachedGeo(missing.URL); got != "" {
		t.Fatalf("failed fetch path=%q", got)
	}
	ev := waitEvent(t, events, "log", time.Second)
	if line := ev.payload.(map[string]any)["line"].(string); !strings.Contains(line, "HTTP 404") {
		t.Fatalf("log line=%q", line)
	}
}

func TestCustomGeoDir(t *testing.T) {
	isolateGeo(t)
	notify, events := collectNotify()
	sup := newSupervisor(notify)
	def := t.TempDir()
	writeGeo(t, def, []string{"YOUTUBE"}, []string{"RU"})

	if got := sup.customGeoDir("xray", def, geoURLs{}); got != "" {
		t.Fatalf("no urls dir=%q", got)
	}

	srv, _ := geoServer(t, 200, geoDat("WHITELIST", "TORRENT"), 0)
	dir := sup.customGeoDir("xray", def, geoURLs{Geosite: srv.URL + "/geosite.dat"})
	if dir == "" {
		t.Fatal("custom dir not built")
	}
	f := loadGeoFilter(dir)
	if !f.known("geosite", "whitelist") || !f.known("geosite", "youtube") {
		t.Fatalf("geosite is not the profile's over the built-in one: %v", f.site)
	}
	if !f.known("geoip", "ru") {
		t.Fatalf("geoip is not the built-in one: %v", f.ip)
	}

	// A database the profile names but cannot be had falls back, and says so.
	missing, _ := geoServer(t, 404, nil, 0)
	if got := sup.customGeoDir("mihomo", def, geoURLs{Geoip: missing.URL}); got != "" {
		t.Fatalf("failed fetch dir=%q", got)
	}
	var lines []string
	for len(lines) < 2 {
		ev := waitEvent(t, events, "log", time.Second)
		lines = append(lines, ev.payload.(map[string]any)["line"].(string))
	}
	if !strings.Contains(strings.Join(lines, "\n"), "built-in geoip.dat serves this connect") {
		t.Fatalf("log lines=%q", lines)
	}
}

func TestSyncFile(t *testing.T) {
	dir := t.TempDir()
	from, to := filepath.Join(dir, "a"), filepath.Join(dir, "b")
	if err := os.WriteFile(from, []byte("one"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := syncFile(from, to); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(to); string(b) != "one" {
		t.Fatalf("copy=%q", b)
	}
	// The source going away takes the copy with it.
	if err := os.Remove(from); err != nil {
		t.Fatal(err)
	}
	if err := syncFile(from, to); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(to); err == nil {
		t.Fatal("stale copy kept")
	}
	if err := syncFile(from, to); err != nil {
		t.Fatalf("both missing: %v", err)
	}
}

func TestUseGeoDir(t *testing.T) {
	data, env := (xrayCore{}).UseGeoDir("/geo", "/data")
	if data != "/data" || len(env) != 1 || env[0] != "XRAY_LOCATION_ASSET=/geo" {
		t.Fatalf("xray data=%s env=%v", data, env)
	}
	data, env = (mihomoCore{}).UseGeoDir("/geo", "/data")
	if data != "/geo" || env != nil {
		t.Fatalf("mihomo data=%s env=%v", data, env)
	}
}

func TestSetGeoURLs(t *testing.T) {
	sup := newSupervisor(nil)
	sup.setGeoURLs(geoURLs{Geosite: "https://a/geosite.dat"})
	if got := sup.geoURLs(); got.Geosite != "https://a/geosite.dat" || got.Geoip != "" {
		t.Fatalf("geo=%+v", got)
	}
}

// geoEntry builds one database entry whose body tells the copies apart.
func geoEntry(code, body string) []byte {
	return protoField(1, append(protoField(1, []byte(code)), protoField(2, []byte(body))...))
}

func TestMergeGeo(t *testing.T) {
	dir := t.TempDir()
	own, def, to := filepath.Join(dir, "own"), filepath.Join(dir, "def"), filepath.Join(dir, "out")
	write := func(p string, b []byte) {
		t.Helper()
		if err := os.WriteFile(p, b, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	write(own, append(geoEntry("TORRENT", "own"), geoEntry("YOUTUBE", "own")...))
	write(def, append(geoEntry("youtube", "def"), geoEntry("CN", "def")...))
	if err := mergeGeo(own, def, to); err != nil {
		t.Fatal(err)
	}
	want := append(append(geoEntry("TORRENT", "own"), geoEntry("YOUTUBE", "own")...), geoEntry("CN", "def")...)
	got, _ := os.ReadFile(to)
	if !bytes.Equal(got, want) {
		t.Fatalf("merged=%q\nwant=%q", got, want)
	}

	// Unchanged inputs leave the result alone; a changed one rebuilds it.
	write(to, []byte("kept"))
	if err := mergeGeo(own, def, to); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(to); string(got) != "kept" {
		t.Fatalf("rebuilt without a change: %q", got)
	}
	write(own, geoEntry("WHITELIST", "own-and-longer"))
	if err := mergeGeo(own, def, to); err != nil {
		t.Fatal(err)
	}
	want = append(append(geoEntry("WHITELIST", "own-and-longer"), geoEntry("youtube", "def")...), geoEntry("CN", "def")...)
	if got, _ := os.ReadFile(to); !bytes.Equal(got, want) {
		t.Fatalf("after change=%q", got)
	}

	// No built-in database: the profile's stands alone.
	if err := mergeGeo(own, filepath.Join(dir, "missing"), to); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(to); !bytes.Equal(got, geoEntry("WHITELIST", "own-and-longer")) {
		t.Fatalf("without built-in=%q", got)
	}

	// A broken profile database is an error, not a merge.
	write(own, []byte{0x0a, 0x7f})
	if err := mergeGeo(own, def, to); err == nil {
		t.Fatal("expected an error for a truncated database")
	}
	if err := mergeGeo(filepath.Join(dir, "gone"), def, to); err == nil {
		t.Fatal("expected an error for a missing database")
	}
}
