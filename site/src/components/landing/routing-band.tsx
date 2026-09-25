import { useLayoutEffect, useRef, useState } from 'react';
import { motionAllowed } from '@/lib/mock-motion';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { REQUESTS, routeFor, type Direction, type Mode } from './routing-scene';

/** The three modes, in the order the mode list offers them. */
const MODES: readonly Mode[] = ['global', 'direct', 'rules'];

/** The lanes, in the order a request is asked about them. */
const LANES: readonly Direction[] = ['proxy', 'direct', 'block'];

/**
 * The classes that set `--dir`, which every tint below is an alpha of. They are
 * the extension's own: a lane on this page and a badge in the popup resolve to
 * the same colour.
 */
const DIRECTION_CLASS: Record<Direction, string> = {
  proxy: 'dir-proxy',
  direct: 'dir-direct',
  block: 'dir-block',
};

/**
 * What a routing mode does to a browser's requests.
 *
 * Seven requests down the side, three lanes across: proxy, direct, blocked. A
 * request sits in the lane it was sent down, and the lane it sits in is the
 * whole answer — no badge to read, no colour to decode twice. The lanes are
 * outlined rather than filled so the table reads as three columns of one table
 * instead of three tables side by side.
 *
 * The modes are tiles, and each carries the distribution it would produce: the
 * little bar on a tile is these same seven requests, sorted into lanes, in the
 * lane colours. Global is one colour; Direct is one colour; by rules is three.
 * That is the difference between the modes, drawn rather than described, and it
 * is legible before a tile is chosen.
 *
 * "Matched by" belongs to the profile, so it collapses — column and all — when
 * the mode stops reading it. Global and Direct do not consult a rule, and a
 * column of dashes would be the page insisting otherwise.
 *
 * The verdicts are computed in `routing-scene.ts`, which takes its two laws
 * from the extension: an entry covers its domain and everything under it, and
 * the first rule to match decides.
 */
export function RoutingBand({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>('rules');
  const byRule = mode === 'rules';

  const routes = REQUESTS.map((host) => ({ host, ...routeFor(host, mode) }));
  const countFor = (lane: Direction, m: Mode) =>
    REQUESTS.filter((host) => routeFor(host, m).direction === lane).length;

  return (
    <div className={cn('grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-9', className)}>
      <div data-enter-stagger="soft" className="flex flex-col gap-2">
        {MODES.map((m) => {
          const on = m === mode;
          return (
            <button
              key={m}
              type="button"
              data-mode={m}
              aria-pressed={on}
              onClick={() => setMode(m)}
              className={cn(
                'flex flex-col gap-3 rounded-md px-6 py-5 text-start transition-colors duration-short ease-emph',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                on ? 'bg-surface-container-high' : 'bg-surface-container-low hover:bg-surface-container',
              )}
            >
              <span className="flex w-full items-center justify-between gap-4">
                <span className="text-title-card font-semibold text-on-surface">
                  {t(`home.routing.mode_${m}`)}
                </span>
                {/* The seven requests this mode would produce, sorted into
                    lanes. One colour means one answer for everything. */}
                {/* One square per request, in its lane's colour. */}
                <span aria-hidden className="flex shrink-0 gap-[2px]">
                  {LANES.flatMap((lane) =>
                    Array.from({ length: countFor(lane, m) }, (_, i) => (
                      <span
                        key={`${lane}-${i}`}
                        data-lane={lane}
                        className={cn(DIRECTION_CLASS[lane], 'size-2.5 rounded-[2px] bg-dir')}
                      />
                    )),
                  )}
                </span>
              </span>
              <ModeLine
                on={on}
                about={t(`home.routing.about_${m}`)}
                short={t(`home.routing.short_${m}`)}
              />
            </button>
          );
        })}
      </div>

      {/* What a mode change did, said once: the tiles are pressed buttons and
          the table redraws silently, so without this a screen reader hears the
          press and nothing of its consequence. */}
      <p className="sr-only" aria-live="polite">
        {LANES.map((lane) => `${t(`home.routing.route_${lane}`)}: ${countFor(lane, mode)}`).join(', ')}
      </p>

      <Cards routes={routes} byRule={byRule} countFor={(lane) => countFor(lane, mode)} />

      {/* The table needs about 700px: four columns and a 230px request. Below
          `md` it would scroll, and the lanes — the answer — would be the part
          scrolled off, so a phone gets the list above instead.
       *
          One piece: the rule column's cells carry an opacity of their own for
          the modes that read no rule, and a row-by-row fade over them would
          show the column for as long as it ran. */}
      <div data-table data-enter="soft" className="hidden md:block">
        <div
          className="grid min-w-[680px] transition-[grid-template-columns] duration-long ease-emph lg:min-w-0"
          style={{ gridTemplateColumns: `230px ${byRule ? '170px' : '0px'} repeat(3, minmax(0, 1fr))` }}
        >
          <span className="flex h-[52px] items-center text-overline uppercase text-on-surface-variant">
            {t('home.routing.col_request')}
          </span>
          <span
            aria-hidden={!byRule}
            className={cn(
              'flex h-[52px] items-center overflow-hidden whitespace-nowrap text-overline uppercase text-on-surface-variant',
              'transition-opacity duration-med ease-emph',
              byRule ? 'opacity-100' : 'opacity-0',
            )}
          >
            {t('home.routing.col_rule')}
          </span>
          {LANES.map((lane) => {
            const empty = countFor(lane, mode) === 0;
            return (
              <span
                key={lane}
                aria-hidden
                data-head={lane}
                className={cn(
                  DIRECTION_CLASS[lane],
                  'mx-[3px] flex h-[52px] items-center justify-center text-overline font-bold transition-colors duration-med ease-emph',
                  // A lane nothing went down states its name in the page's own
                  // grey: the colour is for lanes that carried something.
                  empty ? 'text-on-surface-variant' : 'text-dir',
                )}
              >
                {t(`home.routing.route_${lane}`)}
              </span>
            );
          })}

          {routes.map((route, row) => {
            const last = row === routes.length - 1;
            return (
              <Row
                key={route.host}
                host={route.host}
                // The column only shows under by rules, and it keeps showing
                // what matched there while it fades and closes under the
                // other two, rather than turning to "no rule" on the click.
                rule={routeFor(route.host, 'rules').rule}
                direction={route.direction}
                byRule={byRule}
                first={row === 0}
                last={last}
                emptyLane={(lane) => countFor(lane, mode) === 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A mode tile's line: what the mode does while it is pressed, a few words
 * while it is not.
 *
 * Swapped on the click, three tiles changed height in one frame and on a phone
 * threw the table under them 45px. Both lines are kept instead. The one in
 * force is in the flow and fades in once the tile has begun to make room; the
 * other lies over it and fades out at once. The cell's height is tweened from
 * the one it had to the one it has now, so it passes straight from one to the
 * other. Two lines each opening and closing to their own heights passed the
 * target instead and came back, because the taller of a shrinking line and a
 * growing one dips before it rises.
 */
function ModeLine({ on, about, short }: { on: boolean; about: string; short: string }) {
  const cell = useRef<HTMLSpanElement>(null);
  const height = useRef<number | null>(null);

  useLayoutEffect(() => {
    // Attached by the time a layout effect runs.
    const el = cell.current!;
    const to = el.getBoundingClientRect().height;
    const from = height.current;
    height.current = to;
    if (from === null || Math.abs(from - to) < 1 || !motionAllowed() || typeof el.animate !== 'function') return;
    el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 450,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  }, [on]);

  const line = (shown: boolean, className: string, text: string) => (
    <span
      aria-hidden={!shown}
      className={cn(
        className,
        'block text-on-surface-variant',
        shown
          ? 'opacity-100 [transition:opacity_var(--dur-med)_var(--ease-emph)_100ms]'
          : 'pointer-events-none absolute inset-x-0 top-0 opacity-0 [transition:opacity_var(--dur-short)_var(--ease-emph)]',
      )}
    >
      {text}
    </span>
  );

  return (
    <span ref={cell} className="relative block overflow-hidden">
      {line(on, 'text-title-dense leading-[1.5] [text-wrap:pretty]', about)}
      {line(!on, 'text-body-medium', short)}
    </span>
  );
}

/**
 * The table, for a phone: one row per request, the host with the rule that
 * decided under it, and the answer at the end in words.
 *
 * Three lanes do not fit a phone without taking the answer off the screen, and
 * a table that has to be scrolled to be read has stopped being a table. So the
 * lanes fold into a label in their own tint, and what the lanes did as columns
 * — show at a glance how many went each way — moves to a tally over the list.
 */
function Cards({
  routes,
  byRule,
  countFor,
}: {
  routes: readonly { host: string; direction: Direction }[];
  byRule: boolean;
  countFor: (lane: Direction) => number;
}) {
  return (
    <div data-cards data-enter="soft" className="md:hidden">
      <div aria-hidden className="flex flex-wrap gap-2 pb-4">
        {LANES.map((lane) => {
          const n = countFor(lane);
          return (
            <span
              key={lane}
              data-tally={lane}
              data-empty={n === 0 ? '' : undefined}
              className={cn(
                DIRECTION_CLASS[lane],
                'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-overline font-bold transition-colors duration-med ease-emph',
                // A lane nothing went down drops to the page's grey, as its
                // head does in the table.
                n === 0
                  ? 'bg-surface-container-low text-on-surface-variant'
                  : 'bg-[hsl(var(--dir)/0.16)] text-dir',
              )}
            >
              {t(`home.routing.route_${lane}`)}
              <span className="font-mono tabular-nums tracking-normal">{n}</span>
            </span>
          );
        })}
      </div>

      <ul className="flex flex-col">
        {routes.map((route) => {
          const rule = routeFor(route.host, 'rules').rule;
          return (
            <li
              key={route.host}
              data-card={route.host}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-surface-container py-3"
            >
              <span className="flex min-w-0 flex-col">
                <span dir="ltr" className="truncate font-mono text-title-dense leading-[1.6] text-on-surface">
                  {route.host}
                </span>
                {/* Folded rather than removed under the modes that read no
                    rule, so the rows close up together instead of jumping. */}
                <span
                  aria-hidden={!byRule}
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-long ease-emph',
                    byRule ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <span className="overflow-hidden">
                    <span data-card-rule dir="ltr" className="flex gap-1.5 font-mono text-meta text-on-surface-variant">
                      <span className="truncate">{rule ? rule.value : t('home.routing.no_rule')}</span>
                      {rule && rule.kind !== 'domain' && <span className="shrink-0">{rule.kind}</span>}
                    </span>
                  </span>
                </span>
              </span>
              <span
                data-verdict={route.direction}
                className={cn(
                  DIRECTION_CLASS[route.direction],
                  // One width for all three words, so the column of labels
                  // reads as a column and a mode change does not shift it.
                  'min-w-[6.5rem] rounded-pill bg-[hsl(var(--dir)/0.16)] px-3 py-1.5 text-center text-overline font-bold text-dir transition-colors duration-med ease-emph',
                )}
              >
                {t(`home.routing.route_${route.direction}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({
  host,
  rule,
  direction,
  byRule,
  first,
  last,
  emptyLane,
}: {
  host: string;
  rule: { value: string; kind: string } | null;
  direction: Direction;
  byRule: boolean;
  first: boolean;
  last: boolean;
  emptyLane: (lane: Direction) => boolean;
}) {
  return (
    <>
      <span
        data-request={host}
        data-direction={direction}
        className="flex h-[50px] items-center whitespace-nowrap border-t border-surface-container font-mono text-title-dense text-on-surface"
      >
        <span dir="ltr">{host}</span>
        {/* The lane a request sits in is drawn, not written, so a screen
            reader would hear the host and the rule and never the answer. The
            answer rides on the row's own first cell instead. */}
        <span className="sr-only">
          {`: ${t(`home.routing.route_${direction}`)}`}
        </span>
      </span>

      {/* A mode that never read a rule has nothing to put here, so the cell
          says so with a rule rather than with words — and goes out of the
          accessibility tree with its column, because a row announcing "no rule
          matched" under Global would be describing a lookup that never ran. */}
      <span
        data-rule
        aria-hidden={!byRule}
        className={cn(
          'flex h-[50px] items-center gap-1.5 overflow-hidden whitespace-nowrap border-t border-surface-container font-mono text-meta',
          'transition-opacity duration-med ease-emph',
          byRule ? 'opacity-100' : 'opacity-0',
          'text-on-surface-variant',
        )}
      >
        {/* The cell keeps its words while the column fades and closes: a rule
            turned to a dash on the click, before the fade had begun. */}
        <span dir="ltr">{rule ? rule.value : t('home.routing.no_rule')}</span>
        {rule && rule.kind !== 'domain' && (
          <span className="text-body-small text-on-surface-variant">{rule.kind}</span>
        )}
      </span>

      {LANES.map((lane) => {
        const hit = lane === direction;
        const faint = emptyLane(lane);
        return (
          <span
            key={lane}
            aria-hidden
            data-cell={lane}
            data-hit={hit ? '' : undefined}
            className={cn(
              DIRECTION_CLASS[lane],
              'mx-[3px] flex h-[50px] items-center justify-center transition-[box-shadow,border-color] duration-med ease-emph',
              // The rows are divided inside the lane too, at half the strength
              // of the table's own rule: without it a lane is one tall box and
              // the rows stop lining up across the gap.
              !first && 'border-t border-surface-container/50',
              // The lane is drawn as an outline down the table: its sides on
              // every row, its cap on the first and its foot on the last.
              first && 'rounded-t-sm',
              last && 'rounded-b-sm',
              'lane-edge',
              faint && 'lane-edge-faint',
              first && 'lane-cap',
              last && 'lane-foot',
            )}
          >
            {/* The dot is the answer: a full one in the lane the request went
                down, with a halo of the same colour, and a quiet pip in the two
                it did not. */}
            <span
              className={cn(
                // One box at the full size, scaled down for the pip: growing
                // width and height laid the row out again on every frame.
                'h-3.5 w-3.5 rounded-full transition-[transform,background-color,box-shadow] duration-long ease-emph',
                hit
                  ? 'bg-dir shadow-[0_0_0_5px_hsl(var(--dir)/0.18)]'
                  : 'scale-[0.2857] bg-outline-variant',
              )}
            />
          </span>
        );
      })}
    </>
  );
}
