import { useEffect, useRef, useState } from 'react';
import { ArrowDownNarrowWide, RefreshCw } from 'lucide-react';
import { t } from '@/i18n';
import { motionAllowed, mulberry32 } from '@/lib/mock-motion';
import { cn } from '@/lib/utils';

/** The plan the provider sold, in gigabytes. */
const CAP = 500;

/** A row's height, which is also the step the sort animates rows by. */
const ROW = 92;

/** How long a refresh takes to read the new figures in. */
const REFRESH_MS = 900;

interface Server {
  /** The flag, which the row shows instead of a monogram. */
  cc: string;
  city: string;
  host: string;
  /** Protocol, transport, security, flow — joined with a middot in the row. */
  tags: readonly string[];
}

const SERVERS: readonly Server[] = [
  {
    cc: '🇩🇪',
    city: 'Frankfurt',
    host: 'fra.sirius.vpn:443',
    tags: ['vless', 'tcp', 'reality', 'xtls-rprx-vision'],
  },
  { cc: '🇳🇱', city: 'Amsterdam', host: 'ams.sirius.vpn:443', tags: ['vless', 'ws', 'tls'] },
  { cc: '🇬🇧', city: 'London', host: 'lon.sirius.vpn:443', tags: ['trojan', 'tcp', 'tls'] },
];

interface Reading {
  /** Gigabytes down and up, the two halves `subscription-userinfo` reports. */
  down: number;
  up: number;
  /** One latency per server, in the order they are listed. */
  pings: readonly number[];
}

/**
 * The opening figures, fixed rather than drawn.
 *
 * The page is prerendered, so the first client render has to equal the captured
 * markup — a random reading here would be a hydration mismatch, and the whole
 * card would be thrown away and drawn again.
 */
const OPENING: Reading = { down: 143, up: 12, pings: [128, 164, 372] };

/** Cubic ease-out, which is the curve the rest of the page decelerates on. */
const ease = (k: number) => 1 - (1 - k) ** 3;

/**
 * The next reading a refresh brings back: a little more traffic, and a fresh
 * probe of every server with one of them off in the distance — which is what a
 * list of servers actually looks like once it has been measured.
 */
function nextReading(previous: Reading, seed: number): Reading {
  const rnd = mulberry32(seed);
  const far = Math.floor(rnd() * SERVERS.length);
  return {
    down: Number((previous.down + 0.4 + rnd() * 2.2).toFixed(1)),
    up: Number((previous.up + 0.1 + rnd() * 0.5).toFixed(1)),
    pings: SERVERS.map((_, i) =>
      i === far ? Math.round(300 + rnd() * 200) : Math.round(100 + rnd() * 100),
    ),
  };
}

/** What a latency is worth: good, unremarkable, or far away. */
function latencyTone(ms: number): string {
  if (ms <= 200) return 'text-success';
  if (ms < 300) return 'text-on-surface-variant';
  return 'text-warning';
}

/**
 * A subscription that keeps its own server list current.
 *
 * The provider's figures are a gauge rather than a bar across the card: the
 * plan is a column, what has been spent fills it from the bottom, and the
 * legend beside it names the three parts — down, up, and what is left. A bar
 * with a percentage under it says how full the plan is; this says what the plan
 * is made of, which is the thing a visitor holding a provider's link wants.
 *
 * Both controls do what the real ones do. Refresh re-reads the traffic and
 * probes every server again, and the figures travel to the new reading over the
 * time the request would plausibly take rather than jumping. Sort orders the
 * servers by the latency that just came back, and the rows slide to their new
 * places — the same three rows, in a different order, which is what sorting is.
 *
 * The opening reading is fixed. The page is prerendered, and a random figure in
 * the first render is a hydration mismatch that throws the card away and draws
 * it again.
 */
export function SubscriptionBand({ className }: { className?: string }) {
  const [reading, setReading] = useState<Reading>(OPENING);
  const [target, setTarget] = useState<Reading>(OPENING);
  const [busy, setBusy] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(6);
  const [sorted, setSorted] = useState(false);
  const [selected, setSelected] = useState(0);
  const [spin, setSpin] = useState(0);
  const frame = useRef<number>();

  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  const refresh = () => {
    if (busy) return;
    const next = nextReading(target, Math.round(performance.now()));
    setSpin((s) => s + 360);

    // A reader who asked for less motion gets the answer without the journey.
    if (!motionAllowed()) {
      setReading(next);
      setTarget(next);
      setMinutes(0);
      return;
    }

    setBusy(true);
    const from = reading;
    const start = performance.now();
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - start) / REFRESH_MS));
      setReading({
        down: from.down + (next.down - from.down) * k,
        up: from.up + (next.up - from.up) * k,
        pings: from.pings.map((p, i) => p + (next.pings[i] - p) * k),
      });
      if (k < 1) frame.current = requestAnimationFrame(step);
      else {
        setBusy(false);
        setMinutes(0);
        setTarget(next);
        setReading(next);
      }
    };
    frame.current = requestAnimationFrame(step);
  };

  const used = reading.down + reading.up;
  /* Sorted by the reading that has arrived rather than the one in flight, so
   * the rows are not reordered on every frame of a refresh. */
  const order = SERVERS.map((_, i) => i);
  if (sorted) order.sort((a, b) => target.pings[a] - target.pings[b]);

  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-lg border border-surface-container-high lg:grid-cols-[320px_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-6 bg-surface-container-low p-7">
        {/* The plan as a column: what has been spent fills it from the bottom,
            down first because down is what a plan is spent on. 
          *
            No transition on the heights: the refresh already steps them every
            frame, and a transition on top only made the column trail its own
            readout. */}
        <div
          aria-hidden
          className="flex flex-col-reverse overflow-hidden rounded-pill bg-surface-container-high"
        >
          <span
            data-gauge="down"
            className="bg-primary"
            style={{ height: `${(reading.down / CAP) * 100}%` }}
          />
          <span
            data-gauge="up"
            className="bg-primary/60"
            style={{ height: `${(reading.up / CAP) * 100}%` }}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em] text-on-surface">
                <span aria-hidden className="text-[22px] leading-none">
                  ✨
                </span>
                Sirius
              </span>
              <span data-meta className="text-[13px] text-on-surface-variant">
                {busy
                  ? t('home.subs.fetching')
                  : minutes === 0
                    ? t('home.subs.updated_now')
                    : t('home.subs.updated').replace('{n}', String(minutes))}
              </span>
            </div>

            <div className="-me-2 -mt-1.5 flex gap-0.5">
              <button
                type="button"
                data-sort
                aria-pressed={sorted}
                aria-label={t('home.subs.sort')}
                title={t('home.subs.sort')}
                onClick={() => setSorted((s) => !s)}
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-med ease-emph',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sorted
                    ? 'bg-primary-container text-primary-on-container'
                    : 'text-on-surface-variant hover:bg-surface-container-high',
                )}
              >
                <ArrowDownNarrowWide className="h-5 w-5" />
              </button>
              <button
                type="button"
                data-refresh
                aria-label={t('home.subs.refresh')}
                title={t('home.subs.refresh')}
                onClick={refresh}
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface-variant',
                  'transition-colors duration-med ease-emph hover:bg-surface-container-high',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                {/* One turn per refresh, on the page's own long step: a spinner
                    that never stops says the request never finished. */}
                <RefreshCw
                  className="h-5 w-5 transition-transform duration-xx-long ease-emph motion-reduce:transition-none"
                  style={{ transform: `rotate(${spin}deg)` }}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span
              dir="ltr"
              data-used
              className="text-[44px] font-light leading-[0.9] tracking-[-0.03em] tabular-nums text-on-surface"
            >
              {`${used.toFixed(1)} `}
              <span className="text-[16px] tracking-normal text-on-surface-variant">
                {t('home.subs.used_unit')}
              </span>
            </span>
            <span
              dir="ltr"
              className="flex flex-col gap-1 text-[13px] tabular-nums text-on-surface-variant"
            >
              <Legend swatch="bg-primary" label={t('home.subs.down')} value={reading.down} />
              <Legend swatch="bg-primary/60" label={t('home.subs.up')} value={reading.up} />
              <Legend
                swatch="bg-surface-container-high"
                label={t('home.subs.left')}
                value={CAP - used}
              />
            </span>
          </div>

          <div className="flex gap-5">
            <Stat value={t('home.subs.days').replace('{n}', '20')} label={t('home.subs.to_expiry')} />
            <Stat value={t('home.subs.hours').replace('{n}', '6')} label={t('home.subs.every')} />
          </div>
        </div>
      </div>

      <div className="flex flex-col bg-surface-container-lowest">
        {/* The rows are placed rather than stacked, so sorting moves them to
            their new positions instead of redrawing the list in a new order. */}
        <div className="relative" style={{ height: `${SERVERS.length * ROW}px` }}>
          {SERVERS.map((server, i) => {
            const position = order.indexOf(i);
            const ms = Math.round(reading.pings[i]);
            const on = i === selected;
            return (
              <button
                key={server.host}
                type="button"
                data-server={server.city}
                data-selected={on ? '' : undefined}
                aria-pressed={on}
                onClick={() => setSelected(i)}
                // Moved by a transform, not by `top`: a reorder is a composited
                // slide rather than four boxes laid out again on every frame.
                style={{ transform: `translateY(${position * ROW}px)` }}
                className={cn(
                  // The latency bar takes 200px beside a desktop row, but on a phone
                  // that left the host line three letters and an ellipsis.
                  'absolute inset-x-0 top-0 grid h-[92px] grid-cols-[minmax(0,1fr)_104px] items-center gap-4 px-5 text-start sm:grid-cols-[minmax(0,1fr)_200px] sm:gap-6 sm:px-7',
                  'transition-[transform,background-color,box-shadow] duration-long ease-emph motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  position > 0 && 'border-t border-surface-container',
                  on
                    ? 'bg-surface-container-low shadow-[inset_3px_0_0_hsl(var(--primary))] rtl:shadow-[inset_-3px_0_0_hsl(var(--primary))]'
                    : 'hover:bg-surface-container-low/60',
                )}
              >
                <span className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="text-[20px] leading-none">
                      {server.cc}
                    </span>
                    <span className="text-[19px] font-semibold text-on-surface">{server.city}</span>
                  </span>
                  <span dir="ltr" className="truncate font-mono text-[13px] text-on-surface-variant">
                    {`${server.host} `}
                    <span className="text-on-surface-variant">{`· ${server.tags.join(' · ')}`}</span>
                  </span>
                </span>

                <span className="flex flex-col items-end gap-2">
                  <span
                    dir="ltr"
                    data-latency
                    className={cn('font-mono text-[14px] font-medium tabular-nums', latencyTone(ms))}
                  >
                    {`${ms} ms`}
                  </span>
                  {/* The bar fills from the right, so a shorter one is a shorter
                      wait: the eye reads it as distance from the reading. */}
                  <span className="flex h-1 w-full justify-end overflow-hidden rounded-pill bg-surface-container-high">
                    <span
                      className={cn('block', latencyTone(ms).replace('text-', 'bg-'))}
                      style={{ width: `${Math.min(100, ms / 5)}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-auto border-t border-surface-container px-7 py-5 text-body-medium text-on-surface-variant [text-wrap:pretty]">
          {t('home.subs.reported')}
        </p>
      </div>
    </div>
  );
}

/** One line of the gauge's legend: the swatch, the figure, what it is. */
function Legend({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-[2px]', swatch)} />
      {label.replace('{n}', value.toFixed(1))}
    </span>
  );
}

/** A figure and its name, for the two the provider states in time rather than bytes. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[20px] font-semibold text-on-surface">{value}</span>
      <span className="text-body-small text-on-surface-variant">{label}</span>
    </span>
  );
}
