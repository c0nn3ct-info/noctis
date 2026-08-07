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
	return &supervisor{notify: notify}
}

func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
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

// defaultPhysicalInterface returns the name of an up, non-loopback, non-tunnel
// interface that has at least one IPv4 address. Used to bypass TUN-mode VPNs
// that would otherwise mangle the proxy's outbound TLS/REALITY handshake.
func defaultPhysicalInterface() string {
	ifs, err := net.Interfaces()
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
		addrs, err := iface.Addrs()
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
	cmd.Stdout = newLogPipe(s.notify, "stdout")
	cmd.Stderr = newLogPipe(s.notify, "stderr")

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
	s.statsCancel = nil
	s.mu.Unlock()
	if statsCancel != nil {
		statsCancel()
	}
	s.lastStats.Store(emptySample())
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
		if p.notify != nil {
			p.notify("log", map[string]any{
				"stream": p.stream,
				"line":   line,
			})
		}
	}
	return len(b), nil
}
