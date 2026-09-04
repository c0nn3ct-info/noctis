package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type notifyFn func(event string, payload any)

// Core abstracts a proxy engine launched as a subprocess that exposes a local
// SOCKS proxy. sing-box, xray-core and mihomo are concrete implementations.
// The supervisor stays format-agnostic and delegates the engine-specific bits
// (binary discovery, port/interface injection, launch args, config extension)
// to the active Core.
type Core interface {
	ID() string
	// Locate returns the path to the core binary, or an error if not found.
	Locate() (string, error)
	// ConfigExt is the on-disk config file extension ("json" | "yaml").
	ConfigExt() string
	// InjectPort sets the local SOCKS listen port in the (already serialized)
	// config and returns the patched bytes.
	InjectPort(raw []byte, port int) ([]byte, error)
	// InjectBindInterface binds proxy outbounds to a physical interface to
	// bypass TUN-mode VPNs. An empty iface is a no-op that returns raw as-is.
	InjectBindInterface(raw []byte, iface string) ([]byte, error)
	// RunArgs returns the exec arguments (excluding the binary itself) used to
	// launch the core with the given config path and per-core data dir.
	RunArgs(cfgPath, dataDir string) []string
	// SupportsClashAPI reports whether the core can expose a Clash API for live
	// traffic stats (sing-box >=1.12, mihomo). xray and legacy sing-box cannot.
	SupportsClashAPI() bool
	// InjectClashAPI binds a Clash API controller (127.0.0.1:port + bearer
	// secret) in the serialized config so the helper can read /traffic and
	// /connections. A no-op returning raw when the core has no Clash API.
	InjectClashAPI(raw []byte, addr, secret string) ([]byte, error)
}

// cores is the registry of available proxy engines, keyed by Core.ID().
var cores = map[string]Core{}

func registerCore(c Core) { cores[c.ID()] = c }

// coreByID resolves a core by id; an empty id selects the default (sing-box).
func coreByID(id string) (Core, error) {
	if id == "" {
		id = "sing-box"
	}
	c, ok := cores[id]
	if !ok {
		return nil, fmt.Errorf("unknown core %q", id)
	}
	return c, nil
}

// coreOrder is the order cores are reported in, and the priority `auto` follows.
var coreOrder = []string{"sing-box", "xray", "mihomo"}

// versionBudget caps how long an ack waits for version probes it does not
// already have cached. The probes keep running past it and land in the cache,
// so a later ack reports what this one had to leave out. It sits well under the
// extension's hello timeout on purpose: a cold first exec of a core binary
// (Gatekeeper on macOS, a virus scanner on Windows) took the serial probes past
// that timeout, and an installed helper then looked absent.
// A var so tests can shorten it.
var versionBudget = 1200 * time.Millisecond

// installedCores reports every registered core's availability and version in a
// stable order. Availability is a stat of the binary; the version needs a
// subprocess, so the probes run concurrently and only for as long as
// versionBudget allows. The extension gates which cores it offers, and uses the
// sing-box version to pick the config schema (>=1.12 modern, else the legacy
// schema) — a version that misses the budget reads as modern, which the
// extension's schema retry corrects if that sing-box is in fact old.
func installedCores() []map[string]any {
	type slot struct {
		entry *versionEntry
		out   map[string]any
	}
	out := []map[string]any{}
	var pending []slot
	for _, id := range coreOrder {
		c, ok := cores[id]
		if !ok {
			continue
		}
		_, err := c.Locate()
		entry := map[string]any{"id": id, "available": err == nil}
		out = append(out, entry)
		if err == nil {
			pending = append(pending, slot{entry: versionAsync(c), out: entry})
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), versionBudget)
	defer cancel()
	for _, p := range pending {
		select {
		case <-p.entry.done:
		case <-ctx.Done():
		}
		if v := p.entry.value(); v != "" {
			p.out["version"] = v
		}
	}
	return out
}

// warmVersions starts a version probe for every core and waits for none of
// them. Called at startup so the first hello finds a warm cache instead of
// paying for a cold exec of each core binary on the request path.
func warmVersions() {
	for _, id := range coreOrder {
		if c, ok := cores[id]; ok {
			versionAsync(c)
		}
	}
}

var semverRe = regexp.MustCompile(`\d+\.\d+\.\d+`)

// versionEntry is one core's memoized version probe. done closes when the probe
// finishes, and val is only meaningful after that: a caller that gives up on
// versionBudget reads "" and asks again on a later ack.
type versionEntry struct {
	done chan struct{}
	val  string
}

func (e *versionEntry) value() string {
	versionCacheMu.Lock()
	defer versionCacheMu.Unlock()
	return e.val
}

// versionCache memoizes a core's version for the helper's lifetime — the
// binaries don't change while we run, and re-probing on every hello/connect
// would add needless subprocess latency.
var (
	versionCacheMu sync.Mutex
	versionCache   = map[string]*versionEntry{}
)

// versionAsync returns the entry holding a core's version, starting the probe in
// the background on the first ask. One probe per core however many callers ask,
// so a startup warm-up and a hello arriving at the same moment share it.
func versionAsync(c Core) *versionEntry {
	id := c.ID()
	versionCacheMu.Lock()
	defer versionCacheMu.Unlock()
	if e, ok := versionCache[id]; ok {
		return e
	}
	e := &versionEntry{done: make(chan struct{})}
	versionCache[id] = e
	go func() {
		v := probeVersion(c)
		versionCacheMu.Lock()
		e.val = v
		versionCacheMu.Unlock()
		close(e.done)
	}()
	return e
}

// coreVersion waits for a core's version probe to finish and extracts a semver
// (e.g. "1.13.13"). Best-effort: returns "" when it can't be determined. Used
// off the request path, where waiting for a cold probe is free.
func coreVersion(c Core) string {
	e := versionAsync(c)
	<-e.done
	return e.value()
}

func probeVersion(c Core) string {
	bin, err := c.Locate()
	if err != nil {
		return ""
	}
	// sing-box/xray: "version"; mihomo: "-v".
	args := []string{"version"}
	if c.ID() == "mihomo" {
		args = []string{"-v"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	out, _ := exec.CommandContext(ctx, bin, args...).Output()
	return semverRe.FindString(string(out))
}

// decodeConfig prepares raw config bytes for a core. JSON cores (sing-box,
// xray) receive the payload object as-is; YAML cores (mihomo) receive a JSON
// string that must be unwrapped to its YAML text first.
func decodeConfig(core Core, raw json.RawMessage) (json.RawMessage, error) {
	if core.ConfigExt() != "yaml" {
		return raw, nil
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return nil, fmt.Errorf("yaml config must be sent as a JSON string: %w", err)
	}
	return json.RawMessage(text), nil
}

// binaryNameVariants returns the filenames to probe for a core binary beside the
// helper. On Windows the installed file carries a .exe suffix and the helper's
// own dir is not on PATH, so the bare name resolves only via LookPath/PATHEXT,
// never beside the helper -- probe both names there. Elsewhere the binary is
// extensionless.
func binaryNameVariants(name, goos string) []string {
	if goos == "windows" {
		return []string{name, name + ".exe"}
	}
	return []string{name}
}

// osExecutable is a seam for tests: the helper's own path is what "beside the
// helper" means, and a test binary lives somewhere else entirely.
var osExecutable = os.Executable

// locateBinary finds a core binary: an explicit env override, then beside the
// helper executable (name and embed/name), then on $PATH.
func locateBinary(envVar string, names []string) (string, error) {
	if envVar != "" {
		if env := os.Getenv(envVar); env != "" {
			if info, err := os.Stat(env); err == nil && !info.IsDir() {
				return env, nil
			}
		}
	}
	if exePath, err := osExecutable(); err == nil {
		dir := filepath.Dir(exePath)
		for _, name := range names {
			for _, n := range binaryNameVariants(name, runtime.GOOS) {
				for _, candidate := range []string{
					filepath.Join(dir, n),
					filepath.Join(dir, "embed", n),
				} {
					if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
						return candidate, nil
					}
				}
			}
		}
	}
	for _, name := range names {
		if path, err := exec.LookPath(name); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("%s binary not found (set %s or place beside helper)", names[0], envVar)
}

// coreDataDir is a per-core working directory (geo assets, caches). Cores that
// don't need one simply ignore the path passed to RunArgs.
func coreDataDir(id string) (string, error) {
	dir := filepath.Join(os.TempDir(), "noctis", id)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	// Only mihomo reads its geo databases out of the data dir; sing-box does not
	// use them and xray finds them beside its own binary. Copying tens of
	// megabytes for those two would buy nothing.
	if id == "mihomo" {
		if err := provisionGeoAssets(dir); err != nil {
			fmt.Fprintf(helperStderr, "noctis-host: geo assets for %s: %v\n", id, err)
		}
	}
	return dir, nil
}

// geoAssetNames are the routing databases a core reads off disk for GEOSITE /
// GEOIP rules.
var geoAssetNames = []string{"geoip.dat", "geosite.dat"}

// provisionGeoAssets copies the geo databases the installers put beside the
// helper into a core's data dir. xray reads them next to its own binary, but
// mihomo only looks in the directory passed to `-d`, and a mihomo that cannot
// find them downloads them at startup — over the very connection the user is
// running Noctis to get. Best effort: a core with no geo rules never touches
// them, so a failure here is worth a log line and nothing more.
func provisionGeoAssets(dir string) error {
	exePath, err := osExecutable()
	if err != nil {
		return err
	}
	src := filepath.Dir(exePath)
	var firstErr error
	for _, name := range geoAssetNames {
		from := filepath.Join(src, name)
		fi, err := os.Stat(from)
		if err != nil || fi.IsDir() {
			continue // not shipped with this install
		}
		to := filepath.Join(dir, name)
		if di, err := os.Stat(to); err == nil && di.Size() == fi.Size() && !di.ModTime().Before(fi.ModTime()) {
			continue // already the same copy
		}
		if err := copyFile(from, to); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// copyFile writes through a temp file in the destination directory and renames
// it into place, so a core reading the directory never sees a half-written
// database.
func copyFile(from, to string) error {
	src, err := os.Open(from)
	if err != nil {
		return err
	}
	defer src.Close()
	tmp := to + ".new"
	// Streamed rather than read whole: a geo database runs to tens of megabytes.
	dst, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := dst.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, to); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

type supervisor struct {
	// route survives core restarts: the verdicts it holds are about hosts, not
	// about the process that reported them.
	route        *routeJournal
	mu           sync.Mutex
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	port         int
	cfgPath      string
	notify       notifyFn
	sessionStart time.Time
	statsCancel  context.CancelFunc
	// childDone is closed by supervise once the running child has been reaped.
	// It is how stop() learns the process is gone: cmd.ProcessState is only
	// valid after Wait() returns and must not be read beside it, so polling it
	// from the escalation goroutine was a data race.
	childDone chan struct{}
	lastStats atomic.Value // TrafficSample
	// bindPref is the extension's interface preference ("auto", "none" or an
	// adapter name), carried on start/reload and remembered so a later restart
	// binds the same way.
	bindPref string
	// coreID names the engine the running child is, which is not the engine the
	// user picked in settings: the extension routes a server to whichever core
	// can carry its protocol. A problem report that names only the preference
	// puts a sing-box label above an xray log.
	coreID string
}

func (s *supervisor) setBindPref(pref string) {
	s.mu.Lock()
	s.bindPref = pref
	s.mu.Unlock()
}

func (s *supervisor) boundInterface() string {
	s.mu.Lock()
	pref := s.bindPref
	s.mu.Unlock()
	return resolveBindInterface(pref)
}

func newSupervisor(notify notifyFn) *supervisor {
	return &supervisor{notify: notify, route: newRouteJournal()}
}

// netListen is a seam for tests; production always gets net.Listen, whose
// "tcp" listeners always carry a *net.TCPAddr.
var netListen = net.Listen

func freePort() (int, error) {
	l, err := netListen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	addr, ok := l.Addr().(*net.TCPAddr)
	if !ok {
		return 0, errors.New("unexpected listener address")
	}
	return addr.Port, nil
}

func waitPort(port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	for time.Now().Before(deadline) {
		c, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			_ = c.Close()
			return nil
		}
		time.Sleep(80 * time.Millisecond)
	}
	return fmt.Errorf("port %d not ready", port)
}

// netInterfaces and interfaceAddrs are seams for tests to substitute the
// interface list and each interface's addresses; neither is reassigned in
// production code. Addrs can genuinely fail (the interface may vanish between
// the two calls), but not on demand, hence the indirection.
var (
	netInterfaces  = net.Interfaces
	interfaceAddrs = func(iface net.Interface) ([]net.Addr, error) { return iface.Addrs() }
)

// Device-name prefixes of tunnel interfaces on unix-likes. Matched
// case-sensitively: these are kernel device names, not free text.
var tunnelPrefixes = []string{"utun", "tun", "tap", "ppp", "awdl", "llw", "bridge", "ap", "anpi", "gif", "stf"}

// Markers of an adapter belonging to a VPN, a virtualizer or a LAN emulator
// rather than to real hardware. Binding outbounds to one of those is how a
// tunnel ends up connected while carrying nothing: Hamachi, for one, holds a
// 25.x.x.x address that routes nowhere near the internet, and a machine running
// it reported "auto · hamachi" while every page hung. Matched case-insensitively
// as substrings, because Windows adapter names are prose ("vEthernet (WSL)",
// "LogMeIn Hamachi Virtual Ethernet Adapter").
var virtualAdapterMarkers = []string{
	"hamachi", "radmin", "zerotier", "tailscale", "wireguard", "wintun",
	"openvpn", "nordlynx", "proton", "softether", "vmware", "virtualbox",
	"vbox", "hyper-v", "vethernet", "docker", "teredo", "npcap", "loopback",
	"bluetooth", "tunnel", "vpn",
}

// IPv4 blocks no physical uplink hands out: Hamachi's 25/8, Radmin VPN's 26/8
// and the 100.64/10 CGNAT space overlay networks assign. An interface whose
// only address sits in one of these is not a way out to the internet.
var overlayBlocks = func() []*net.IPNet {
	var out []*net.IPNet
	for _, cidr := range []string{"25.0.0.0/8", "26.0.0.0/8", "100.64.0.0/10"} {
		if _, n, err := net.ParseCIDR(cidr); err == nil {
			out = append(out, n)
		}
	}
	return out
}()

// routeLocalIP reports the local address the OS would use to reach the public
// internet, which names the adapter owning the default route. A UDP dial picks
// the route without sending a packet. A seam for tests; nil when there is no
// route at all.
var routeLocalIP = func() net.IP {
	c, err := net.Dial("udp4", "8.8.8.8:53")
	if err != nil {
		return nil
	}
	defer c.Close()
	if a, ok := c.LocalAddr().(*net.UDPAddr); ok {
		return a.IP
	}
	return nil
}

func isVirtualAdapter(name string) bool {
	lower := strings.ToLower(name)
	for _, m := range virtualAdapterMarkers {
		if strings.Contains(lower, m) {
			return true
		}
	}
	return false
}

func isTunnelDevice(name string) bool {
	for _, p := range tunnelPrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

func isOverlayAddr(ip net.IP) bool {
	for _, n := range overlayBlocks {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func isPrivateLAN(ip net.IP) bool {
	return ip.IsPrivate() && !isOverlayAddr(ip)
}

// ifaceIPv4s returns an interface's routable IPv4 addresses, dropping loopback
// and link-local ones.
func ifaceIPv4s(iface net.Interface) []net.IP {
	addrs, err := interfaceAddrs(iface)
	if err != nil {
		return nil
	}
	var out []net.IP
	for _, a := range addrs {
		ipNet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		ip := ipNet.IP
		if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.To4() == nil {
			continue
		}
		out = append(out, ip)
	}
	return out
}

// ifaceInfo describes one adapter for the extension's interface picker.
// Recommended is false for a tunnel, a virtual adapter or an overlay-only
// address: those are offered but not chosen on their own.
type ifaceInfo struct {
	Name        string `json:"name"`
	Addr        string `json:"addr"`
	Recommended bool   `json:"recommended"`
}

// listInterfaces reports every up, non-loopback adapter holding a routable IPv4
// address, so the user can override a bad automatic pick by hand.
func listInterfaces() []ifaceInfo {
	ifs, err := netInterfaces()
	if err != nil {
		return []ifaceInfo{}
	}
	out := []ifaceInfo{}
	for _, iface := range ifs {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		ips := ifaceIPv4s(iface)
		if len(ips) == 0 {
			continue
		}
		usable := false
		for _, ip := range ips {
			if !isOverlayAddr(ip) {
				usable = true
				break
			}
		}
		out = append(out, ifaceInfo{
			Name:        iface.Name,
			Addr:        ips[0].String(),
			Recommended: usable && !isTunnelDevice(iface.Name) && !isVirtualAdapter(iface.Name),
		})
	}
	return out
}

// resolveBindInterface maps the extension's stored preference to the adapter
// outbounds get bound to. "none" leaves the OS to route, which is what a user
// wants when the automatic pick and every manual one are wrong.
func resolveBindInterface(pref string) string {
	switch pref {
	case "", "auto":
		return defaultPhysicalInterface()
	case "none":
		return ""
	default:
		return pref
	}
}

// defaultPhysicalInterface returns the name of the interface outbound
// connections should bind to: up, non-loopback, and neither a tunnel nor a
// virtual adapter. Used to bypass TUN-mode VPNs that would otherwise mangle the
// proxy's outbound TLS/REALITY handshake.
//
// Candidates are scored rather than taken in enumeration order, which used to
// hand the pick to whichever adapter the OS listed first. Owning the default
// route wins; a private LAN address comes next; en0 breaks a tie on macOS. An
// interface holding only an overlay address is dropped, because binding to it
// is worse than not binding at all: an empty name leaves the OS to route.
func defaultPhysicalInterface() string {
	ifs, err := netInterfaces()
	if err != nil {
		return ""
	}
	routeIP := routeLocalIP()

	best, bestScore := "", 0
	for _, iface := range ifs {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if isTunnelDevice(iface.Name) || isVirtualAdapter(iface.Name) {
			continue
		}
		score := 0
		for _, ip := range ifaceIPv4s(iface) {
			if isOverlayAddr(ip) {
				continue
			}
			switch {
			case routeIP != nil && ip.Equal(routeIP):
				score = max(score, 6)
			case isPrivateLAN(ip):
				score = max(score, 4)
			default:
				score = max(score, 2)
			}
		}
		if score == 0 {
			continue
		}
		if iface.Name == "en0" {
			score++
		}
		if score > bestScore {
			best, bestScore = iface.Name, score
		}
	}
	return best
}

func writeTempConfig(payload []byte, ext string) (string, error) {
	dir := filepath.Join(os.TempDir(), "noctis")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, fmt.Sprintf("config-%d.%s", os.Getpid(), ext))
	if err := os.WriteFile(path, payload, 0o600); err != nil {
		return "", err
	}
	return path, nil
}

// Config files are named config-<helper pid>.<ext> and outlive their session:
// the helper rewrites its own on every start and never deletes the ones a
// crashed session left behind. Sweep the files whose session is gone, so the
// directory stops growing across restarts. Files of live sessions are left
// alone — a second browser profile runs its own helper with its own core, and
// its config is none of our business.
func reapStaleConfigs() {
	dir := filepath.Join(os.TempDir(), "noctis")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	me := os.Getpid()
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		pid, ok := configPid(e.Name())
		if !ok || pid == me || processAlive(pid) {
			continue
		}
		_ = os.Remove(filepath.Join(dir, e.Name()))
	}
}

// configPid reads the writing helper's pid out of a config file name, and
// reports false for anything that is not one of ours.
func configPid(name string) (int, bool) {
	rest, ok := strings.CutPrefix(name, "config-")
	if !ok {
		return 0, false
	}
	dot := strings.LastIndexByte(rest, '.')
	if dot <= 0 {
		return 0, false
	}
	pid, err := strconv.Atoi(rest[:dot])
	if err != nil || pid <= 0 {
		return 0, false
	}
	return pid, true
}

// findProcess is a seam for tests: os.FindProcess cannot fail on unix, so the
// error path is unreachable there without substituting it.
var findProcess = os.FindProcess

func processAlive(pid int) bool {
	p, err := findProcess(pid)
	if err != nil {
		return false
	}
	// Signal 0 asks the kernel whether the pid exists without touching it.
	// EPERM means it exists and belongs to another user; Windows has no such
	// probe, and there FindProcess itself fails for a pid that is gone.
	if err := p.Signal(syscall.Signal(0)); err != nil {
		return runtime.GOOS == "windows" || errors.Is(err, syscall.EPERM)
	}
	return true
}

// helperLog puts one line in both places it can be read: the browser's capture
// of our stderr, and the extension's own log view.
func (s *supervisor) helperLog(format string, args ...any) {
	line := fmt.Sprintf(format, args...)
	fmt.Fprintf(helperStderr, "noctis-host: %s\n", line)
	if s.notify != nil {
		s.notify("log", map[string]any{"stream": "helper", "line": line})
	}
}

// clashAPIParams picks the loopback address and bearer secret the Clash API
// controller binds to. Both stay internal to the helper and are never sent to
// the extension.
func clashAPIParams() (addr, secret string, err error) {
	p, err := freePort()
	if err != nil {
		return "", "", fmt.Errorf("pick controller port: %w", err)
	}
	secret, err = randomSecret()
	if err != nil {
		return "", "", fmt.Errorf("controller secret: %w", err)
	}
	return fmt.Sprintf("127.0.0.1:%d", p), secret, nil
}

func (s *supervisor) start(core Core, raw json.RawMessage) (int, error) {
	bin, err := core.Locate()
	if err != nil {
		return 0, err
	}

	s.mu.Lock()
	if s.cmd != nil {
		s.mu.Unlock()
		return 0, errors.New("already running")
	}
	s.mu.Unlock()

	port, err := freePort()
	if err != nil {
		return 0, fmt.Errorf("pick port: %w", err)
	}
	patched, err := core.InjectPort(raw, port)
	if err != nil {
		return 0, err
	}
	if iface := s.boundInterface(); iface != "" {
		// Surfaced in the extension's log view either way: binding outbounds to
		// the wrong adapter is invisible from the browser side (the core starts,
		// the SOCKS port binds, and every dial then goes nowhere), and so is not
		// binding at all when the user asked for it.
		if p2, err := core.InjectBindInterface(patched, iface); err == nil {
			patched = p2
			s.helperLog("bind_interface=%s", iface)
		} else {
			s.helperLog("bind_interface=%s not applied: %v", iface, err)
		}
	}
	// Enable the Clash API for live traffic stats on cores that support it. The
	// controller binds to a random loopback port with a random bearer secret —
	// both stay internal to the helper and are never sent to the extension.
	var statsAddr, statsSecret string
	if core.SupportsClashAPI() {
		// Stats are a nicety — a core that runs without them is still a working
		// tunnel — but the failure has to be readable, or the traffic view is
		// simply empty with nothing anywhere saying why.
		addr, secret, err := clashAPIParams()
		if err == nil {
			var p2 []byte
			if p2, err = core.InjectClashAPI(patched, addr, secret); err == nil {
				patched = p2
				statsAddr = addr
				statsSecret = secret
			}
		}
		if err != nil {
			s.helperLog("clash api not enabled, live stats unavailable: %v", err)
		}
	}
	dataDir, err := coreDataDir(core.ID())
	if err != nil {
		return 0, err
	}
	cfgPath, err := writeTempConfig(patched, core.ConfigExt())
	if err != nil {
		return 0, err
	}

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, bin, core.RunArgs(cfgPath, dataDir)...)
	stdout := newLogPipe(s.notify, "stdout")
	stderr := newLogPipe(s.notify, "stderr")
	for _, p := range []*logPipe{stdout, stderr} {
		p.route = s.route
		p.coreID = core.ID()
	}
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		cancel()
		return 0, fmt.Errorf("spawn %s: %w", core.ID(), err)
	}

	statsCtx, statsCancel := context.WithCancel(ctx)
	now := time.Now()
	done := make(chan struct{})
	s.mu.Lock()
	s.cmd = cmd
	s.cancel = cancel
	s.port = port
	s.coreID = core.ID()
	s.cfgPath = cfgPath
	s.sessionStart = now
	s.statsCancel = statsCancel
	s.childDone = done
	s.mu.Unlock()

	go s.supervise(cmd, port, done)

	if err := waitPort(port, 5*time.Second); err != nil {
		s.stop()
		return 0, fmt.Errorf("%s did not bind socks: %w", core.ID(), err)
	}

	// Seed a snapshot so a `stats` request before the first push still reports
	// the right capabilities (e.g. xray → all-false → UI shows "unavailable").
	s.lastStats.Store(initialSample(core.ID(), statsAddr != "", now))
	if statsAddr != "" {
		go s.runStats(statsCtx, statsAddr, statsSecret, core.ID())
	}
	return port, nil
}

// statsSnapshot returns the last composed sample, or an empty (all-false caps)
// sample when nothing is running. Used by the one-shot `stats` request.
func (s *supervisor) statsSnapshot() TrafficSample {
	if v := s.lastStats.Load(); v != nil {
		return v.(TrafficSample)
	}
	return emptySample()
}

// currentPort is the SOCKS port of the running core, or 0 when nothing runs.
// Used by the `fetch` command to borrow the live tunnel.
func (s *supervisor) currentPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cmd == nil {
		return 0
	}
	return s.port
}

func (s *supervisor) supervise(cmd *exec.Cmd, port int, done chan struct{}) {
	err := cmd.Wait()
	// Announced before anything else: stop()'s escalation is waiting on this to
	// decide whether a SIGKILL is still needed, and every read of ProcessState
	// below is safe only now that Wait has returned.
	close(done)
	s.mu.Lock()
	owned := s.cmd == cmd
	if owned {
		s.cmd = nil
		if s.cancel != nil {
			s.cancel = nil
		}
		if s.statsCancel != nil {
			s.statsCancel()
			s.statsCancel = nil
		}
		s.port = 0
		s.coreID = ""
	}
	s.mu.Unlock()
	if owned && s.notify != nil {
		s.notify("child_exit", map[string]any{
			"port":   port,
			"error":  errString(err),
			"exited": cmd.ProcessState != nil && cmd.ProcessState.Exited(),
		})
	}
}

// How long a child gets to honour SIGTERM before it is killed outright.
// A var so tests can shorten it.
var stopGrace = 2 * time.Second

func (s *supervisor) stop() {
	s.mu.Lock()
	cmd := s.cmd
	cancel := s.cancel
	statsCancel := s.statsCancel
	cfgPath := s.cfgPath
	done := s.childDone
	s.statsCancel = nil
	s.cfgPath = ""
	s.mu.Unlock()
	if statsCancel != nil {
		statsCancel()
	}
	s.lastStats.Store(emptySample())
	if cfgPath != "" {
		// The core read it at launch; keeping it around only litters temp.
		_ = os.Remove(cfgPath)
	}
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = cmd.Process.Signal(syscall.SIGTERM)
	// Read on the caller's goroutine, not inside the escalation: the value is
	// only ever changed by a test, and reading it here keeps that change ordered
	// behind the stop() that observes it.
	grace := stopGrace
	go func() {
		timer := time.NewTimer(grace)
		defer timer.Stop()
		select {
		case <-done:
			// SIGTERM was enough and supervise has reaped it. Releasing the
			// context now rather than sleeping out the grace period is the
			// point of waiting on a signal instead of a clock.
		case <-timer.C:
			_ = cmd.Process.Kill()
		}
		if cancel != nil {
			cancel()
		}
	}()
}

func (s *supervisor) reload(core Core, raw json.RawMessage) (int, error) {
	s.stop()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		running := s.cmd != nil
		s.mu.Unlock()
		if !running {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	return s.start(core, raw)
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

type logPipe struct {
	notify notifyFn
	stream string
	// route and coreID are set when the pipe carries a core's output: every line
	// is offered to the journal, and the debug chatter the journal needs is kept
	// out of the user-visible log.
	route  *routeJournal
	coreID string
	mu     sync.Mutex
	buf    bytes.Buffer
}

func newLogPipe(notify notifyFn, stream string) *logPipe {
	return &logPipe{notify: notify, stream: stream}
}

// maxLogLine caps one log line. A core that writes without newlines would
// otherwise grow the buffer without bound, and a single line past 1 MiB is a
// frame Chrome cannot carry at all.
const maxLogLine = 16 << 10

func (p *logPipe) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.buf.Write(b)
	for {
		idx := bytes.IndexByte(p.buf.Bytes(), '\n')
		// No newline in sight, or one too far away: ship what fits and carry on
		// with the rest as if it were the next line.
		if (idx < 0 && p.buf.Len() > maxLogLine) || idx > maxLogLine {
			line := string(p.buf.Bytes()[:maxLogLine])
			p.buf.Next(maxLogLine)
			p.emit(line)
			continue
		}
		if idx < 0 {
			break
		}
		line := string(p.buf.Bytes()[:idx])
		p.buf.Next(idx + 1)
		p.emit(line)
	}
	return len(b), nil
}

func (p *logPipe) emit(line string) {
	if p.route != nil {
		p.route.consume(p.coreID, line, nowMillis())
		if routeLineHidden(p.coreID, line) {
			return
		}
	}
	if p.notify != nil {
		p.notify("log", map[string]any{
			"stream": p.stream,
			"line":   line,
		})
	}
}
