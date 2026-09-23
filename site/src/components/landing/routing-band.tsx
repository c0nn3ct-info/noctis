import { useState } from 'react';
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
      <div className="flex flex-col gap-2">
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
                'flex flex-col gap-3 rounded-md px-6 py-5 text-start transition-colors duration-med ease-emph',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                on ? 'bg-surface-container-high' : 'bg-surface-container-low hover:bg-surface-container',
              )}
            >
              <span className="flex w-full items-center justify-between gap-4">
                <span className="text-[18px] font-semibold text-on-surface">
                  {t(`home.routing.mode_${m}`)}
                </span>
                {/* The seven requests this mode would produce, sorted into
                    lanes. One colour means one answer for everything. */}
                <span aria-hidden className="flex h-2 w-[84px] shrink-0 gap-[2px]">
                  {LANES.flatMap((lane) =>
                    Array.from({ length: countFor(lane, m) }, (_, i) => (
                      <span
                        key={`${lane}-${i}`}
                        data-lane={lane}
                        className={cn(DIRECTION_CLASS[lane], 'flex-1 rounded-[2px] bg-dir')}
                      />
                    )),
                  )}
                </span>
              </span>
              {on ? (
                <span className="text-[15px] leading-[1.5] text-on-surface-variant [text-wrap:pretty]">
                  {t(`home.routing.about_${m}`)}
                </span>
              ) : (
                <span className="text-body-medium text-on-surface-variant">{t(`home.routing.short_${m}`)}</span>
              )}
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

      {/* Below `lg` the table keeps its width and scrolls: four columns and a
          230px request need about 700px, and reflowed into a phone the lanes
          stop being lanes. */}
      <div className="scrollbar-quiet -mx-5 overflow-x-auto px-5 lg:mx-0 lg:overflow-visible lg:px-0">
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
                rule={route.rule}
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
        className="flex h-[50px] items-center whitespace-nowrap border-t border-surface-container font-mono text-[15px] text-on-surface"
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
          'flex h-[50px] items-center gap-1.5 overflow-hidden whitespace-nowrap border-t border-surface-container font-mono text-[13px]',
          'transition-opacity duration-med ease-emph',
          byRule ? 'opacity-100' : 'opacity-0',
          'text-on-surface-variant',
        )}
      >
        <span dir="ltr">
          {!byRule ? '—' : rule ? rule.value : t('home.routing.no_rule')}
        </span>
        {byRule && rule && rule.kind !== 'domain' && (
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
