package main

import (
	"errors"
	"strings"
	"testing"
)

func TestFailureLine(t *testing.T) {
	cases := []struct {
		name  string
		lines []string
		want  string
	}{
		{"empty", nil, ""},
		{"blank lines only", []string{"", "  "}, ""},
		{
			"sing-box fatal beats a later info line",
			[]string{
				"\x1b[36mINFO\x1b[0m[0000] network: updated default interface Ethernet, index 12",
				"\x1b[31mFATAL\x1b[0m[0000] start service: initialize rule-set[2]: read tcp: connection reset",
				"\x1b[36mINFO\x1b[0m[0000] router: closing",
			},
			"start service: initialize rule-set[2]: read tcp: connection reset",
		},
		{
			"xray",
			[]string{"2026/10/08 07:57:44.949577 [Error] Failed to start: main: failed to load config files"},
			"Failed to start: main: failed to load config files",
		},
		{
			"mihomo",
			[]string{`time="2026-10-08T07:58:27+03:30" level=error msg="Parse config error: proxy \"x\" not found"`},
			`Parse config error: proxy "x" not found`,
		},
		{"no failure word falls back to the last line", []string{"first", "last words", ""}, "last words"},
	}
	for _, c := range cases {
		if got := failureLine(c.lines); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}

	long := "FATAL[0000] " + strings.Repeat("x", maxFailureLine+50)
	if got := failureLine([]string{long}); len(got) != maxFailureLine+len("…") || !strings.HasSuffix(got, "…") {
		t.Errorf("long line not capped: %d bytes", len(got))
	}
}

func TestStartFailure(t *testing.T) {
	timeout := errors.New("port 1 not ready after 5s")
	cases := []struct {
		err   error
		lines []string
		want  string
	}{
		{errCoreExited, nil, "xray did not bind socks: exited: no output"},
		{errCoreExited, []string{"FATAL[0000] boom"}, "xray did not bind socks: exited: boom"},
		{timeout, nil, "xray did not bind socks: port 1 not ready after 5s"},
		{timeout, []string{"INFO[0000] dialing"}, "xray did not bind socks: port 1 not ready after 5s; last log line: dialing"},
	}
	for _, c := range cases {
		if got := startFailure("xray", c.err, c.lines).Error(); got != c.want {
			t.Errorf("got %q, want %q", got, c.want)
		}
	}
}

func TestLineTailKeepsTheLast(t *testing.T) {
	tail := newLineTail(2)
	for _, l := range []string{"a", "b", "c"} {
		tail.add(l)
	}
	got := tail.lines()
	if strings.Join(got, ",") != "b,c" {
		t.Fatalf("got %v", got)
	}
	got[0] = "mutated"
	if tail.lines()[0] != "b" {
		t.Fatal("lines() must return a copy")
	}
}
