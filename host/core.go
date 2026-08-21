package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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

// installedCores probes every registered core and reports availability +
// version in a stable order. The extension gates which cores it offers, and
// uses the sing-box version to pick the config schema (>=1.12 modern, else the
// legacy schema) — so a helper paired with an old sing-box still works.
func installedCores() []map[string]any {
	out := []map[string]any{}
	for _, id := range []string{"sing-box", "xray", "mihomo"} {
		c, ok := cores[id]
		if !ok {
			continue
		}
		_, err := c.Locate()
		entry := map[string]any{"id": id, "available": err == nil}
		if err == nil {
			if v := coreVersion(c); v != "" {
				entry["version"] = v
			}
		}
		out = append(out, entry)
	}
	return out
}

var semverRe = regexp.MustCompile(`\d+\.\d+\.\d+`)

// versionCache memoizes a core's version for the helper's lifetime — the
// binaries don't change while we run, and re-probing on every hello/connect
// would add needless subprocess latency.
var (
	versionCacheMu sync.Mutex
	versionCache   = map[string]string{}
)

// coreVersion runs the core binary's version command and extracts a semver
// (e.g. "1.13.13"). Best-effort: returns "" when it can't be determined.
func coreVersion(c Core) string {
	id := c.ID()
	versionCacheMu.Lock()
	if v, ok := versionCache[id]; ok {
		versionCacheMu.Unlock()
		return v
	}
	versionCacheMu.Unlock()

	v := probeVersion(c)
	versionCacheMu.Lock()
	versionCache[id] = v
	versionCacheMu.Unlock()
	return v
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
	if exePath, err := os.Executable(); err == nil {
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
	return dir, nil
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
	lastStats    atomic.Value // TrafficSample
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

// defaultPhysicalInterface returns the name of an up, non-loopback, non-tunnel
// interface that has at least one IPv4 address. Used to bypass TUN-mode VPNs
// that would otherwise mangle the proxy's outbound TLS/REALITY handshake.
func defaultPhysicalInterface() string {
	ifs, err := netInterfaces()
	if err != nil {
		return ""
	}
	skipPrefix := []string{"utun", "tun", "tap", "ppp", "awdl", "llw", "bridge", "ap", "anpi", "gif", "stf"}
	var fallback string
	for _, iface := range ifs {
		if iface.Flags&net.FlagUp == 0 {
			continue
		}
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		skip := false
		for _, p := range skipPrefix {
			if strings.HasPrefix(iface.Name, p) {
				skip = true
				break
			}
		}
		if skip {
			continue
		}
		addrs, err := interfaceAddrs(iface)
		if err != nil {
			continue
		}
		hasV4 := false
		for _, a := range addrs {
			ipNet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP
			if ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			if ip.To4() != nil {
				hasV4 = true
				break
			}
		}
		if !hasV4 {
			continue
		}
		if iface.Name == "en0" {
			return "en0"
		}
		if fallback == "" {
			fallback = iface.Name
		}
	}
	return fallback
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
	if iface := defaultPhysicalInterface(); iface != "" {
		if p2, err := core.InjectBindInterface(patched, iface); err == nil {
			patched = p2
			fmt.Fprintf(os.Stderr, "noctis-host: bind_interface=%s\n", iface)
			// Also surface it in the extension's log view: binding outbounds to
			// the wrong adapter is invisible from the browser side (the core
			// starts, the SOCKS port binds, and every dial then goes nowhere),
			// so the picked name has to be readable without a terminal.
			if s.notify != nil {
				s.notify("log", map[string]any{
					"stream": "helper",
					"line":   "bind_interface=" + iface,
				})
			}
		}
	}
	// Enable the Clash API for live traffic stats on cores that support it. The
	// controller binds to a random loopback port with a random bearer secret —
	// both stay internal to the helper and are never sent to the extension.
	var statsAddr, statsSecret string
	if core.SupportsClashAPI() {
		if p, err := freePort(); err == nil {
			if secret, err := randomSecret(); err == nil {
				addr := fmt.Sprintf("127.0.0.1:%d", p)
				if p2, err := core.InjectClashAPI(patched, addr, secret); err == nil {
					patched = p2
					statsAddr = addr
					statsSecret = secret
				}
			}
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
	s.mu.Lock()
	s.cmd = cmd
	s.cancel = cancel
	s.port = port
	s.cfgPath = cfgPath
	s.sessionStart = now
	s.statsCancel = statsCancel
	s.mu.Unlock()

	go s.supervise(cmd, port)

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

func (s *supervisor) supervise(cmd *exec.Cmd, port int) {
	err := cmd.Wait()
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

func (s *supervisor) stop() {
	s.mu.Lock()
	cmd := s.cmd
	cancel := s.cancel
	statsCancel := s.statsCancel
	cfgPath := s.cfgPath
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
	go func() {
		time.Sleep(2 * time.Second)
		if cmd.ProcessState == nil {
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

func (p *logPipe) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.buf.Write(b)
	for {
		idx := bytes.IndexByte(p.buf.Bytes(), '\n')
		if idx < 0 {
			break
		}
		line := string(p.buf.Bytes()[:idx])
		p.buf.Next(idx + 1)
		if p.route != nil {
			p.route.consume(p.coreID, line, nowMillis())
			if routeLineHidden(p.coreID, line) {
				continue
			}
		}
		if p.notify != nil {
			p.notify("log", map[string]any{
				"stream": p.stream,
				"line":   line,
			})
		}
	}
	return len(b), nil
}
