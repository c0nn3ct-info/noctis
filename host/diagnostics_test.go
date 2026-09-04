package main

import (
	"encoding/json"
	"io"
	"log"
	"strings"
	"testing"
	"time"
)

func TestLineRingKeepsTheLastLines(t *testing.T) {
	r := newLineRing(3)
	for _, s := range []string{"one\n", "two\n", "three\n", "four\n"} {
		if _, err := r.Write([]byte(s)); err != nil {
			t.Fatal(err)
		}
	}
	got := r.snapshot()
	if strings.Join(got, ",") != "two,three,four" {
		t.Fatalf("ring = %v", got)
	}

	// A line split across writes is one entry, and a CR is not part of it.
	r = newLineRing(3)
	r.Write([]byte("par"))
	if len(r.snapshot()) != 0 {
		t.Fatal("a partial line must wait for its terminator")
	}
	r.Write([]byte("tial\r\n"))
	if got := r.snapshot(); len(got) != 1 || got[0] != "partial" {
		t.Fatalf("ring = %#v", got)
	}
}

func TestLineRingBoundsAnUnterminatedWriter(t *testing.T) {
	r := newLineRing(4)
	r.Write([]byte(strings.Repeat("x", maxLogLine*2+5)))
	got := r.snapshot()
	if len(got) != 2 {
		t.Fatalf("cut into %d lines, want 2", len(got))
	}
	for _, line := range got {
		if len(line) != maxLogLine {
			t.Fatalf("line of %d bytes, want the %d cap", len(line), maxLogLine)
		}
	}
	if r.buf.Len() != 5 {
		t.Fatalf("pending %d bytes, want the 5-byte remainder", r.buf.Len())
	}
}

func TestDiagnosticsDescribesTheInstall(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.13.13")
	bin := fakeCoreBin(t, "1.13.13")
	t.Setenv("SINGBOX_BIN", bin)
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())

	sup := newSupervisor(nil)
	sup.setBindPref("none")
	d := sup.diagnostics()

	if d["version"] != hostVersion {
		t.Fatalf("version = %v", d["version"])
	}
	cores, ok := d["cores"].([]coreDiagnostic)
	if !ok || len(cores) == 0 {
		t.Fatalf("cores = %#v", d["cores"])
	}
	var sb *coreDiagnostic
	for i := range cores {
		if cores[i].ID == "sing-box" {
			sb = &cores[i]
		}
	}
	if sb == nil || !sb.Available || sb.Path != bin || sb.Version != "1.13.13" {
		t.Fatalf("sing-box diagnostic = %#v", sb)
	}
	// A core that is not installed says why rather than going missing.
	for _, c := range cores {
		if c.ID == "xray" && (c.Available || c.Error == "") {
			t.Fatalf("xray diagnostic = %#v", c)
		}
	}
	// "none" is an explicit choice, and the report must show it resolved to no
	// binding rather than to whatever auto would have picked.
	bind := d["bindInterface"].(map[string]any)
	if bind["preference"] != "none" || bind["resolved"] != "" {
		t.Fatalf("bindInterface = %#v", bind)
	}
	core := d["core"].(map[string]any)
	if core["running"] != false || core["socksPort"] != 0 || core["id"] != "" {
		t.Fatalf("core = %#v", core)
	}
	// The whole thing has to survive the trip to the extension.
	if _, err := json.Marshal(d); err != nil {
		t.Fatalf("diagnostics not serializable: %v", err)
	}
}

// The core the helper is running is not the core the user picked: the extension
// routes a server to whichever engine can carry its protocol. A report that
// names only the preference reads as sing-box above an xray log.
func TestDiagnosticsNamesTheRunningCore(t *testing.T) {
	stashVersionCache(t)
	seedVersion(t, "sing-box", "1.13.13")
	t.Setenv("SINGBOX_BIN", fakeCoreBin(t, "1.13.13"))
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	notify, events := collectNotify()
	sup := newSupervisor(notify)

	port, err := sup.start(singBoxCore{}, socksConfig(nil))
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	core := sup.diagnostics()["core"].(map[string]any)
	if core["running"] != true || core["id"] != "sing-box" || core["socksPort"] != port {
		t.Fatalf("core while running = %#v", core)
	}

	sup.stop()
	waitEvent(t, events, "child_exit", 5*time.Second)
	core = sup.diagnostics()["core"].(map[string]any)
	if core["running"] != false || core["id"] != "" {
		t.Fatalf("core after stop = %#v", core)
	}
}

// The point of the ring: lines the helper logs about itself are readable from
// the extension, not just from a browser log file nobody opens.
func TestDiagnosticsCarriesRecentHelperLog(t *testing.T) {
	stashVersionCache(t)
	t.Setenv("SINGBOX_BIN", "")
	t.Setenv("XRAY_BIN", "")
	t.Setenv("MIHOMO_BIN", "")
	t.Setenv("PATH", t.TempDir())

	lg := log.New(helperStderr, "", 0)
	lg.Print("bind_interface=en0 not applied: boom")

	sup := newSupervisor(nil)
	lines, ok := sup.diagnostics()["stderr"].([]string)
	if !ok {
		t.Fatalf("stderr = %T", sup.diagnostics()["stderr"])
	}
	found := false
	for _, l := range lines {
		if strings.Contains(l, "bind_interface=en0 not applied") {
			found = true
		}
	}
	if !found {
		t.Fatalf("helper log line missing from diagnostics: %v", lines)
	}
}

func TestDispatchDiagnostics(t *testing.T) {
	stashVersionCache(t)
	a := dispatch(msgFor(t, `{"id":"d1","type":"diagnostics"}`), newSupervisor(nil), log.New(io.Discard, "", 0))
	if !a.OK {
		t.Fatalf("diagnostics ack not ok: %+v", a)
	}
	if _, ok := a.Data.(map[string]any)["cores"]; !ok {
		t.Fatalf("data = %#v", a.Data)
	}
}
