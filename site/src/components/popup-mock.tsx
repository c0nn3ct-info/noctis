import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Fab } from '@/components/ui/fab';
import {
  SplitButton,
  SplitButtonAction,
  SplitButtonCaret,
} from '@/components/ui/split-button';
import { LatencyPip } from '@/components/m3/latency-pip';
import { ServerMonogram } from '@/components/m3/server-monogram';
import { AmbientWave } from '@/components/ambient-wave';
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

// Deterministic PRNG so the prerendered seed matches client hydration (no flash
// / mismatch) — the live walk switches to Math.random after mount.
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
function useMockTraffic(paused: boolean) {
  const [buf, setBuf] = useState<{ down: number; up: number }[]>(seedTraffic);
  useEffect(() => {
    // Paused keeps the mulberry32 seed frame on screen forever: no interval, so
    // nothing switches to Math.random and the popup stays byte-for-byte the
    // same render every time. That is what a docs page, a story snapshot or a
    // store capture needs — a live walk makes each of them a different image.
    if (paused) return;
    const rnd = () => Math.random();
    const id = setInterval(() => {
      setBuf((b) => {
        const down = stepDown(b[b.length - 1].down, rnd);
        return [...b.slice(1), { down, up: down * (0.1 + Math.random() * 0.06) }];
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);
  return buf;
}

interface MockServer {
  name: string;
  host: string;
  ms: number;
  active?: boolean;
  enabled?: boolean;
}

const SERVERS: ReadonlyArray<MockServer> = [
  {
    name: '🇳🇱 Amsterdam',
    host: 'ams.example.net:443',
    ms: 23,
    active: true,
    enabled: true,
  },
  {
    name: '🇩🇪 Frankfurt',
    host: 'fra.example.net:443',
    ms: 38,
  },
  {
    name: '🇸🇬 Singapore',
    host: 'sg.example.net:8443',
    ms: 188,
  },
];

interface PopupMockProps {
  className?: string;
  /**
   * Freeze the mock on its deterministic opening frame instead of walking the
   * traffic forward once a second.
   */
  paused?: boolean;
}

export function PopupMock({ className, paused = false }: PopupMockProps) {
  const buf = useMockTraffic(paused);
  const latest = buf[buf.length - 1];
  const dn = fmtSpeed(latest.down);
  const up = fmtSpeed(latest.up);
  const wavePoints = buf.map((s) => s.down + s.up);

  return (
    <div
      dir="ltr"
      className={cn(
        'pointer-events-auto flex min-h-[560px] w-[380px] flex-col rounded-lg border border-outline-variant bg-background text-on-surface shadow-e3',
        className,
      )}
    >
      <section className="shrink-0 px-4 pb-4 pt-4">
        <Card variant="elevated" padding="md" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 text-primary opacity-[0.15]">
            <AmbientWave points={wavePoints} max={WAVE_MAX} className="h-full w-full" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-label-small uppercase tracking-[0.16em] text-on-surface-variant">
                Tunnel status
              </div>
              <h2 className="text-headline-small font-medium leading-tight tracking-tight">
                You are protected
              </h2>
              <div className="space-y-0.5 text-sm text-on-surface-variant">
                <div className="block truncate">
                  Amsterdam · via <b className="text-on-surface">reality</b>
                </div>
                <div className="block truncate font-mono text-on-surface">203.0.113.47</div>
              </div>
              <div className="flex items-center gap-3 pt-0.5 text-label-medium tabular-nums">
                <span className="inline-flex items-baseline gap-1 text-primary">
                  <ArrowDown className="h-3 w-3 self-center" aria-hidden />
                  {dn.value}
                  <span className="text-[10px] text-on-surface-variant">{dn.unit}</span>
                </span>
                <span className="inline-flex items-baseline gap-1 text-on-surface-variant">
                  <ArrowUp className="h-3 w-3 self-center" aria-hidden />
                  {up.value}
                  <span className="text-[10px]">{up.unit}</span>
                </span>
              </div>
            </div>
            <Fab color="success" size="regular" aria-label="Disconnect" type="button">
              <Power aria-hidden />
            </Fab>
          </div>
        </Card>
      </section>

      <section className="flex shrink-0 flex-col px-4">
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-label-small uppercase text-on-surface-variant">Routing</span>
          <Button type="button" variant="text" size="xs" aria-label="View all routing profiles">
            View all
            <ArrowRight />
          </Button>
        </div>
        <div
          role="group"
          aria-label="Routing"
          className="inline-flex h-9 w-full rounded-pill bg-surface-container-high p-0.5 text-sm"
        >
          <button
            type="button"
            aria-pressed="true"
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill bg-surface-container-lowest px-2 text-label-medium font-medium text-on-surface shadow-e1"
          >
            <Globe className="h-4 w-4" aria-hidden />
            Global
          </button>
          <button
            type="button"
            aria-pressed="false"
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill px-2 text-label-medium font-medium text-on-surface-variant"
          >
            <ShieldOff className="h-4 w-4" aria-hidden />
            Direct
          </button>
          <button
            type="button"
            aria-pressed="false"
            aria-label="✨ Sirius"
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill px-2 text-label-medium font-medium text-on-surface-variant"
          >
            <span aria-hidden>✨</span>
            Sirius
          </button>
        </div>
      </section>

      <section className="flex flex-col px-2 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <span className="text-label-small uppercase text-on-surface-variant">Recent servers</span>
          <Button type="button" variant="text" size="xs" aria-label="View all servers">
            View all
            <ArrowRight />
          </Button>
        </div>
        <ul className="space-y-1">
          {SERVERS.map((s) => (
            <PopupServerRow key={s.name} server={s} />
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex shrink-0 items-center gap-2 px-4 py-3">
        <SplitButton variant="filled" size="s">
          <SplitButtonAction type="button">
            <Plus />
            Add
          </SplitButtonAction>
          <SplitButtonCaret type="button" aria-label="More add options" />
        </SplitButton>
        <Button variant="filled-tonal" size="s" type="button" className="flex-1">
          Panel
          <ExternalLink />
        </Button>
      </footer>
    </div>
  );
}

function PopupServerRow({ server }: { server: MockServer }) {
  const isLive = !!server.active && !!server.enabled;
  return (
    <li
      className={cn(
        'group relative flex items-center gap-3 px-3 py-3 transition-colors',
        isLive
          ? 'rounded-xl bg-success-container text-success-on-container shadow-e1'
          : 'rounded-lg',
      )}
    >
      <ServerMonogram
        name={server.name}
        size={isLive ? 'md' : 'sm'}
        shape={isLive ? 'squircle' : 'rounded'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="w-full truncate text-title-medium leading-tight">{server.name}</span>
        <span className="truncate font-mono text-label-small opacity-75">{server.host}</span>
      </div>
      <LatencyPip ms={server.ms} />
    </li>
  );
}
