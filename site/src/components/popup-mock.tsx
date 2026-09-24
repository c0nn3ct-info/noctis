import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  Globe,
  Plus,
  Power,
  ShieldOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Fab } from '@/components/ui/fab';
import { LatencyPip } from '@/components/m3/latency-pip';
import { ServerMonogram } from '@/components/m3/server-monogram';
import { AmbientWave } from '@/components/ambient-wave';
import { motionAllowed, mulberry32 } from '@/lib/mock-motion';
import { cn } from '@/lib/utils';

// Both exported for Storybook: `AmbientWave`'s own stories draw the popup's
// sample buffers, and they have to share the buffer length and the ceiling or
// the shapes stop comparing.
export const WAVE_N = 44;
export const WAVE_MAX = 3_000_000; // fixed scale (bytes/s) so the wave doesn't rescale each tick

// One step of the traffic random-walk: AR(1) low-pass (gentle peaks) + an
// occasional small burst. Shared by the seed and the live tick so the opening
// frame already matches the settled wave instead of being taller/spikier.
function stepDown(prev: number, rnd: () => number): number {
  const burst = rnd() < 0.08 ? rnd() * 650_000 : 0;
  return Math.min(2_600_000, Math.max(40_000, prev * 0.82 + rnd() * 320_000 + burst));
}

// Seed by running the walk forward deterministically, so the buffer starts in a
// settled state (same distribution as the live walk).
function seedTraffic(): { down: number; up: number }[] {
  const rnd = mulberry32(0x9e3779b9);
  const buf: { down: number; up: number }[] = [];
  let down = 850_000;
  for (let i = 0; i < WAVE_N; i++) {
    down = stepDown(down, rnd);
    buf.push({ down, up: down * 0.12 });
  }
  return buf;
}

function fmtSpeed(bps: number): { value: string; unit: string } {
  if (bps >= 1024 * 1024) return { value: (bps / 1048576).toFixed(1), unit: 'MB/s' };
  if (bps >= 1024) return { value: Math.round(bps / 1024).toString(), unit: 'KB/s' };
  return { value: Math.round(bps).toString(), unit: 'B/s' };
}

// Live mock traffic: a rolling buffer that scrolls a new sample in each second,
// driving the ambient wave + the ↓/↑ readout (same walk as the seed).
//
// `connected` is what the power button changes, and switching off stops the walk
// rather than winding it down. That is `PopupAmbientTraffic`'s own behaviour:
// its buffer holds only seconds that moved, so a tunnel going down leaves the
// last active minute frozen on screen and the next byte picks up where it left
// off. The wave stops; it does not reset.
function useMockTraffic(paused: boolean, connected: boolean, root: RefObject<Element | null>) {
  const [buf, setBuf] = useState<{ down: number; up: number }[]>(seedTraffic);
  useEffect(() => {
    // Paused keeps the mulberry32 seed frame on screen forever: no interval, so
    // nothing switches to Math.random and the popup stays byte-for-byte the
    // same render every time. That is what a docs page, a story snapshot or a
    // store capture needs — a live walk makes each of them a different image.
    if (paused || !connected) return;
    const rnd = () => Math.random();
    // Off screen counts as a background tab: the popup three bands up was
    // redrawing its wave every second for nobody.
    let onScreen = true;
    // The ref is attached by the time an effect runs.
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(([e]) => void (onScreen = e.isIntersecting))
        : undefined;
    io?.observe(root.current!);
    const id = setInterval(() => {
      // A background tab still runs timers on some engines; advancing the walk
      // there only burns battery redrawing something nobody is looking at. The
      // buffer holds only seconds that moved, so the wave picks up where it
      // left off rather than replaying the time the tab sat out — the same
      // guard the aria2t site puts on its shared landing clock.
      if (document.hidden || !onScreen) return;
      setBuf((b) => {
        const down = stepDown(b[b.length - 1].down, rnd);
        return [...b.slice(1), { down, up: down * (0.1 + Math.random() * 0.06) }];
      });
    }, 1000);
    return () => {
      clearInterval(id);
      io?.disconnect();
    };
  }, [paused, connected, root]);
  return buf;
}


interface MockServer {
  name: string;
  host: string;
  ms: number;
  active?: boolean;
  /** The handshake the hero names while this server is the active one. */
  security: string;
  /** The transport it names alongside, once the tunnel is down. */
  transport: string;
  /** The address the world sees while it is. */
  ip: string;
}

// Documentation addresses throughout (RFC 5737, RFC 2606): a mock that printed
// a routable IP would be pointing at somebody.
const SERVERS: ReadonlyArray<MockServer> = [
  {
    name: '🇳🇱 Amsterdam',
    host: 'ams.example.net:443',
    ms: 23,
    security: 'reality',
    transport: 'tcp',
    ip: '203.0.113.47',
  },
  {
    name: '🇩🇪 Frankfurt',
    host: 'fra.example.net:443',
    ms: 38,
    security: 'tls',
    transport: 'ws',
    ip: '198.51.100.12',
  },
  {
    name: '🇸🇬 Singapore',
    host: 'sg.example.net:8443',
    ms: 188,
    security: 'reality',
    transport: 'grpc',
    ip: '192.0.2.203',
  },
];

/**
 * The three routing modes the real popup switches between. The saved profile
 * wears its own emoji rather than a lucide glyph, the way a user-named profile
 * does in the extension.
 */
const MODES: ReadonlyArray<{
  key: 'global' | 'direct' | 'profile';
  label: string;
  icon?: LucideIcon;
  emoji?: string;
}> = [
  { key: 'global', label: 'Global', icon: Globe },
  { key: 'direct', label: 'Direct', icon: ShieldOff },
  { key: 'profile', label: 'Sirius', emoji: '✨' },
];

type Mode = (typeof MODES)[number]['key'];

interface PopupMockProps {
  className?: string;
  /**
   * Freeze the mock on its deterministic opening frame instead of walking the
   * traffic forward once a second.
   *
   * Left alone it answers `motionAllowed()`: the prerender pass drives a real
   * browser, and a mock that walked while it was being captured would serialize
   * a frame the visitor's first render cannot reproduce. A reader who asked for
   * less motion gets the same still frame, for the reason WCAG 2.2.2 gives.
   */
  paused?: boolean;
}

export function PopupMock({ className, paused }: PopupMockProps) {
  // Three pieces of state, and everything else on the surface is derived from
  // them — which is the only way a mock stays honest once it can be operated:
  // there is nowhere for a second, disagreeing copy of the truth to live.
  const [connected, setConnected] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('global');

  const still = paused ?? !motionAllowed();
  const root = useRef<HTMLDivElement>(null);
  const buf = useMockTraffic(still, connected, root);
  const latest = buf[buf.length - 1];
  const dn = fmtSpeed(latest.down);
  const up = fmtSpeed(latest.up);
  const wavePoints = buf.map((s) => s.down + s.up);
  const active = SERVERS[activeIndex];

  return (
    // The mock is a copy of the English popup on every locale's page, so it
    // says which language it is in: a Russian page's screen reader would
    // otherwise read "Connect" and "Recent servers" with Russian phonetics.
    <div
      ref={root}
      dir="ltr"
      lang="en"
      className={cn(
        // h-[600px] w-[380px] is POPUP_FRAME in popup-app.tsx, verbatim. The rounding,
        // the hairline and the shadow are not the popup's: they are how this page
        // stands a window on itself, which the real one gets from the browser.
        'pointer-events-auto flex h-[600px] w-[380px] flex-col overflow-hidden rounded-lg border border-outline-variant bg-background text-on-surface shadow-e3',
        className,
      )}
    >
      <section className="shrink-0 px-4 pb-4 pt-4">
        <Card variant="elevated" padding="sm" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 text-primary opacity-[0.15]">
            <AmbientWave points={wavePoints} max={WAVE_MAX} className="h-full w-full" />
          </div>
          <div className="relative flex min-w-0 items-center gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-label-small uppercase tracking-[0.16em] text-on-surface-variant">
                Tunnel status
              </div>
              {/* `hero.title.protected` and `hero.title.ready`: with a server
                  chosen and the engine stopped the real popup says it is ready,
                  not that something is wrong. An h2 rather than the popup's h1 —
                  the page around this mock already has one, and a second would
                  be a heading, not a picture of one. */}
              <h2 className="text-headline-small font-medium leading-tight tracking-tight">
                {connected ? 'You are protected' : 'Ready to connect'}
              </h2>
              {/* Two lines connected — the server and the address it exits from,
                  one each, both truncating — and one clamped line idle, which is
                  `hero.sub.activeDetail`: name, transport, handshake. The name
                  keeps its flag in both, the way the real hero prints it. */}
              <div className="text-sm text-on-surface-variant">
                {connected ? (
                  <>
                    <span className="block truncate">
                      {`${active.name} · via `}
                      <b className="text-on-surface">{active.security}</b>
                    </span>
                    <span className="block truncate font-mono text-on-surface">{active.ip}</span>
                  </>
                ) : (
                  <span className="block line-clamp-2">
                    {active.name} · {active.transport} · {active.security}
                  </span>
                )}
              </div>
              {/* A live meter under an identity is a different kind of fact
                  from the two lines above it, so it gets more air. Rendered only
                  while the tunnel is up: an empty slot would hold that air open
                  for nothing, and the real hero drops it the same way. */}
              {connected && (
                <div className="mt-1.5 text-label-medium">
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="inline-flex items-baseline gap-1 text-primary">
                      <ArrowDown className="h-3 w-3 self-center" aria-hidden />
                      {dn.value}
                      <span className="text-label-unit text-on-surface-variant">{dn.unit}</span>
                    </span>
                    <span className="inline-flex items-baseline gap-1 text-on-surface-variant">
                      <ArrowUp className="h-3 w-3 self-center" aria-hidden />
                      {up.value}
                      <span className="text-label-unit text-on-surface-variant">{up.unit}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Green is the colour of the thing that is running, so it belongs
                to the button while there is something to stop. Off, the button
                is the ordinary primary one that starts it again. */}
            <Fab
              color={connected ? 'success' : 'primary'}
              size="regular"
              type="button"
              aria-label={connected ? 'Disconnect' : 'Connect'}
              aria-pressed={connected}
              onClick={() => setConnected((v) => !v)}
            >
              <Power aria-hidden />
            </Fab>
          </div>
        </Card>
      </section>

      <section className="flex shrink-0 flex-col px-4">
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-label-small uppercase text-on-surface-variant">Routing</span>
          <Button type="button" variant="text" size="xs" tabIndex={-1} aria-hidden>
            View all
            <ArrowRight />
          </Button>
        </div>
        <div
          role="group"
          aria-label="Routing"
          className="inline-flex h-9 w-full rounded-pill bg-surface-container-high p-0.5 text-sm"
        >
          {MODES.map((m) => {
            const on = m.key === mode;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                aria-label={m.emoji ? `${m.emoji} ${m.label}` : undefined}
                onClick={() => setMode(m.key)}
                // `Segmented` (extension/src/components/m3/segmented.tsx) at
                // size sm, with the width overrides the popup passes it.
                className={cn(
                  'inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill px-2 text-label-medium font-medium',
                  'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-med ease-spring',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  on
                    ? 'bg-surface-container-lowest text-on-surface shadow-e1'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden /> : <span aria-hidden>{m.emoji}</span>}
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="text-label-small uppercase text-on-surface-variant">Recent servers</span>
          <Button type="button" variant="text" size="xs" tabIndex={-1} aria-hidden>
            View all
            <ArrowRight />
          </Button>
        </div>
        <ul className="space-y-1">
          {SERVERS.map((s, i) => (
            <PopupServerRow
              key={s.name}
              server={s}
              live={i === activeIndex && connected}
              selected={i === activeIndex}
              onSelect={() => setActiveIndex(i)}
            />
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex shrink-0 items-center gap-2 px-4 py-3">
        {/* `AddMenu` renders one filled button that opens a menu — not a split
            button with a caret of its own. The menu it opens is a surface this
            mock does not have, so the click has nowhere to go. */}
        {/* These four open surfaces the mock does not have, so they are drawn
            but not offered: out of the tab order and the accessibility tree,
            where a control that does nothing is a trap rather than a copy. */}
        <Button variant="filled" size="s" type="button" className="min-w-0" tabIndex={-1} aria-hidden>
          <Plus aria-hidden />
          <span className="truncate">Add</span>
        </Button>
        <Button variant="filled-tonal" size="s" type="button" className="flex-1" tabIndex={-1} aria-hidden>
          Panel
          <ExternalLink />
        </Button>
      </footer>
    </div>
  );
}

interface RowProps {
  server: MockServer;
  /** Chosen and carrying traffic: the row the tunnel is actually running on. */
  live: boolean;
  /** Chosen. Still true with the tunnel down, because the choice survives it. */
  selected: boolean;
  onSelect: () => void;
}

function PopupServerRow({ server, live, selected, onSelect }: RowProps) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        // The pip that draws the latency is decorative, so the number has to be
        // in this name or a screen reader never gets it.
        aria-label={`${server.name}, ${server.ms} ms`}
        onClick={onSelect}
        // `ServerRow` (extension/src/components/server-row.tsx) in its compact
        // form. The real row is three controls in one strip — the monogram
        // re-pings, the middle selects, the pip re-pings — and this is one
        // button: the mock has no panel to open and no probe to run, so a strip
        // of three targets that all did the same thing would be a lie about the
        // surface rather than a copy of it. Everything the row *looks* like is
        // the row's own.
        className={cn(
          'group relative flex w-full items-center gap-3 px-4 py-3 text-start',
          'transition-[background-color,border-radius,box-shadow,color] duration-med ease-spring',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          live && 'rounded-xl bg-success-container text-success-on-container shadow-e1',
          // Chosen with the tunnel down: still the server that will be used, so
          // it keeps the secondary container the real row gives it, plus the
          // bar on its leading edge.
          !live && selected && 'rounded-lg bg-secondary-container text-secondary-on-container',
          !live && !selected && 'm3-state-layer rounded-lg',
        )}
      >
        {!live && selected && (
          <span
            aria-hidden
            className="absolute start-1 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-pill bg-secondary"
          />
        )}
        <ServerMonogram
          name={server.name}
          size={live ? 'md' : 'sm'}
          shape={live ? 'squircle' : 'rounded'}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="w-full truncate text-title-medium leading-tight">{server.name}</span>
          <span className="truncate font-mono text-label-small opacity-75">{server.host}</span>
        </div>
        <LatencyPip ms={server.ms} />
      </button>
    </li>
  );
}
