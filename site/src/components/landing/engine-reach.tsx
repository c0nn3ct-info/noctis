import { useRef, useState } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { engineName } from './engine-pick';
import { CAPABILITIES, ENGINES, coverageFor, type Capability, type EngineKey } from './engines';

/** The capabilities one set of engines runs, and nothing else does. */
interface Reach {
  /** The engines that run every capability in this group. */
  engines: readonly EngineKey[];
  rows: readonly Capability[];
}

/**
 * Every capability grouped by who runs it.
 *
 * Derived rather than written down, so a protocol that only mihomo gains opens
 * its own group with the right heading instead of landing in the wrong one. The
 * order is by how many engines share the group, widest first, and then by the
 * engines' own order — which puts what they all do at the top and the two
 * single-engine groups at the bottom, where the differences are.
 */
export function reachGroups(): Reach[] {
  const bySet = new Map<string, Capability[]>();
  for (const capability of CAPABILITIES) {
    const key = ENGINES.filter((e) => capability.runs.includes(e.key))
      .map((e) => e.key)
      .join('+');
    const rows = bySet.get(key);
    if (rows) rows.push(capability);
    else bySet.set(key, [capability]);
  }

  return [...bySet.entries()]
    .map(([key, rows]) => ({ engines: key.split('+') as EngineKey[], rows }))
    .sort(
      (a, b) =>
        b.engines.length - a.engines.length ||
        ENGINES.findIndex((e) => e.key === a.engines[0]) -
          ENGINES.findIndex((e) => e.key === b.engines[0]),
    );
}

/** What to call a group: all of them, a pair by name, or one by name. */
function reachTitle(engines: readonly EngineKey[]): string {
  if (engines.length === ENGINES.length) return t('home.engines.reach_all');
  if (engines.length === 1) {
    return t('home.engines.reach_only').replace('{engine}', engineName(engines[0]));
  }
  return engines.map(engineName).join(' + ');
}

/**
 * The three engines, and what each one reaches.
 *
 * It replaced a table of twenty-two rows by three columns of dots: sixty-six
 * marks, of which the nine in the security section said the three engines agree
 * and twenty-seven more said the same about most transports and half the
 * protocols. The same twenty-two rows are here, grouped by the only thing that
 * varies — who runs them — so the agreement takes one line and the differences
 * take the rest.
 *
 * One tile is chosen and it grows. Three tiles of equal size ask the visitor to
 * choose an engine, which is the wrong question: one is already running and the
 * others are there for the servers it cannot drive. The chosen tile carries the
 * accent as a tonal container (the filled primary is the install button's
 * alone), the room for a sentence and the figure at full size; the other two
 * keep their figure and wait. sing-box opens chosen because sing-box is what
 * starts.
 *
 * Picking a tile does not change the page's claim, only its point of view: the
 * groups below stay where they are and their chips answer for the engine now in
 * the tile — solid where it runs them, struck where it does not, filled where
 * it is the only engine that does.
 */
export function EngineReach({ className }: { className?: string }) {
  const [engine, setEngine] = useState<EngineKey>(ENGINES[0].key);
  const groups = reachGroups();

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      {/* A row from `lg` up, where the chosen one can take the room the other
          two give it. Below `lg` a row of three leaves each tile too narrow
          for its own figure, and stacked they were a screen tall, so the
          segmented control below stands in for them there. At 768 the row gave the
          chosen tile 324px, and the tile's fixed height clipped the figure
          and the sentence beside it. A floor, not a height, even here: the
          Russian sentence runs 7px past 210 at 1024.
        *
          The row is a size container so the sentences below can be set at
          the width the chosen tile will have, in `cqw`, before it has it. */}
      <div
        data-enter-stagger="soft"
        className="hidden flex-col gap-3 lg:flex lg:min-h-[210px] lg:flex-row lg:[container-type:inline-size]"
      >
        {ENGINES.map((e) => {
          const chosen = e.key === engine;
          return (
            <button
              key={e.key}
              type="button"
              data-engine={e.key}
              data-chosen={chosen || undefined}
              aria-pressed={chosen}
              onClick={() => setEngine(e.key)}
              className={cn(
                'flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-lg p-6 text-start sm:p-7',
                // The growth is the one authored movement here: 450ms on the
                // emphasized curve, the page's long step, and the tiles are
                // three so the layout cost of animating a flex ratio is three
                // boxes rather than a list. The colour is feedback, not
                // movement, so it answers the hover and the press on the short
                // step instead of trailing the growth for 450ms.
                '[transition:flex-grow_var(--dur-long)_var(--ease-emph),background-color_var(--dur-short)_var(--ease-emph),color_var(--dur-short)_var(--ease-emph)] motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                // `basis-0` with the grow factor, so the three widths are the
                // ratio and nothing else: left on `auto`, the chosen tile is
                // measured by the sentence inside it first and then given its
                // share of what is left, which took it to five times its
                // neighbours instead of a little over twice.
                'lg:basis-0',
                chosen
                  ? 'bg-primary-container text-primary-on-container lg:grow-[2.2]'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container lg:grow',
              )}
            >
              {/* The name and its badge, and under them a copy nobody sees,
                  laid out at the width an unchosen tile has. In Russian,
                  Spanish and Persian the badge does not fit beside the name
                  once sing-box narrows, and the header wrapping mid-growth
                  took the whole row 38px taller while the tiles moved. The
                  copy makes the cell as tall as the header will ever be, and
                  only where it does wrap, so the English row pays nothing. */}
              <span className="grid">
                <TileHead engine={e} className="col-start-1 row-start-1" />
                <TileHead
                  engine={e}
                  aria-hidden
                  className="invisible col-start-1 row-start-1 hidden w-[calc((100cqw-192px)/4.2)] lg:flex"
                />
              </span>

              {/* The figure and its sentence sit on one line, the figure at its
                  own width and the sentence in what is left. Below `sm` the
                  sentence wraps under the figure. */}
              <span className="flex flex-wrap items-end gap-x-7 sm:flex-nowrap">
                {/* A fixed width in the row, so the sentence beside it can be
                    measured from the row alone. The widest figure is 114px in
                    the system face. */}
                <span dir="ltr" className="flex shrink-0 items-baseline gap-1.5 lg:w-[120px]">
                  <span className="text-figure-large font-light leading-[0.85] tracking-[-0.03em] tabular-nums">
                    {coverageFor(e.key)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-title-dense transition-colors duration-short ease-emph',
                      chosen ? 'text-primary-on-container' : 'text-on-surface-variant',
                    )}
                  >
                    {`/${CAPABILITIES.length}`}
                  </span>
                </span>
                {/* Every tile carries its sentence, and only the chosen one
                    shows it. Mounted on the click instead, the sentence
                    arrived in a tile a quarter of the row wide, stood 378px
                    tall, threw the band down the page and then re-wrapped on
                    every frame of the growth as it came back.
                  *
                    In the row it is set once, at the chosen tile's final
                    width: (row − 2 gaps − 3 × 56px padding) × 2.2 / 4.2, less
                    the figure and the gap beside it. So it never re-wraps,
                    the three tiles are as tall whichever is chosen, and the
                    growing tile uncovers lines that are already in place
                    while the other two clip theirs. Stacked there is no
                    growth to wait for, so the sentence opens its own height. */}
                <span
                  aria-hidden={!chosen}
                  className={cn(
                    'grid min-w-0 basis-full sm:flex-1 sm:basis-auto',
                    'lg:w-[calc((100cqw-192px)*2.2/4.2-148px)] lg:flex-none',
                    // The height on one clock for both, so that stacked, one
                    // sentence closing while another opens keeps the column's
                    // length instead of dipping 86px between them. The fade
                    // is split: in after the tile has room for the words, out
                    // at once, before the tile narrows over them.
                    chosen
                      ? 'grid-rows-[1fr] opacity-100 [transition:grid-template-rows_var(--dur-long)_var(--ease-emph),opacity_var(--dur-med)_var(--ease-emph)_100ms]'
                      : 'grid-rows-[0fr] opacity-0 [transition:grid-template-rows_var(--dur-long)_var(--ease-emph),opacity_var(--dur-short)_var(--ease-emph)] lg:grid-rows-[1fr]',
                    'motion-reduce:transition-none',
                  )}
                >
                  <span className="min-h-0 overflow-hidden">
                    <span className="block pt-3 text-lead leading-[1.35] [text-wrap:pretty] sm:pt-0">
                      {t(`home.engines.about.${e.key}`)}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Switcher engine={engine} onPick={setEngine} />

      <div data-enter-stagger="soft" className="flex flex-col">
        {groups.map((group, i) => {
          const runs = group.engines.includes(engine);
          const shared = group.engines.length === ENGINES.length;
          return (
            <div
              key={group.engines.join('+')}
              data-reach={group.engines.join('+')}
              className={cn(
                'grid items-start gap-3 py-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6',
                // Below `lg` what all three share goes last: it is the same
                // whichever engine is picked, and above the groups that do
                // change it put a picked engine's answer a screen away from
                // the control that asked for it.
                shared && 'order-last lg:order-none',
                // No rule over the first group in either order: it would draw
                // a line under the control that belongs to neither.
                i === 0 && 'border-t border-outline-variant lg:border-t-0',
                i === 1 && 'lg:border-t lg:border-outline-variant',
                i > 1 && 'border-t border-outline-variant',
              )}
            >
              <span className="flex items-baseline gap-2.5 lg:pt-[9px]">
                <span
                  dir="ltr"
                  className={cn(
                    'font-mono text-title-dense font-medium transition-colors duration-med ease-emph',
                    runs ? 'text-on-surface' : 'text-on-surface-variant',
                  )}
                >
                  {reachTitle(group.engines)}
                </span>
                <span dir="ltr" className="font-mono text-meta text-on-surface-variant">
                  {group.rows.length}
                </span>
              </span>

              {/* Every engine runs these, so their chips never change state;
                  on a phone fifteen of them were a wall in front of the four
                  that do. One line there, the chips in the row. */}
              {shared && (
                <p data-shared-line dir="ltr" className="text-body-medium leading-[1.7] text-on-surface-variant lg:hidden">
                  {group.rows.map((row) => row.name).join(' · ')}
                </p>
              )}
              <ul className={cn('flex-wrap gap-2', shared ? 'hidden lg:flex' : 'flex')}>
                {group.rows.map((row) => (
                  <Chip key={row.name} row={row} engine={engine} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The tiles, for a phone: one segmented control and the chosen engine's
 * sentence under it.
 *
 * Stacked, the three tiles were most of a screen before the first chip, and a
 * tap changed chips a screen below it — the answer to the question arrived out
 * of sight. Three options and a thumb are what a segmented control is for, and
 * with the tiles gone the groups that change start right under it.
 *
 * The thumb slides between segments rather than jumping, on the page's long
 * step. The sentences are all laid in one cell, so the panel is as tall as the
 * longest and nothing under it moves: the outgoing one fades at once, and the
 * incoming one waits for it and a beat more before it fades in.
 */
function Switcher({ engine, onPick }: { engine: EngineKey; onPick: (next: EngineKey) => void }) {
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const at = ENGINES.findIndex((e) => e.key === engine);

  const move = (to: number) => {
    const next = (to + ENGINES.length) % ENGINES.length;
    onPick(ENGINES[next].key);
    segments.current[next]?.focus();
  };

  return (
    <div data-enter="soft" className="flex flex-col gap-5 lg:hidden">
      <div
        role="radiogroup"
        aria-label={t('home.protocols.h2')}
        onKeyDown={(e) => {
          // Arrows walk the segments in reading order, which in a right-to-left
          // page is the other way round on screen.
          const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
          const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[e.key];
          if (step) move(at + step);
          else if (e.key === 'Home') move(0);
          else if (e.key === 'End') move(ENGINES.length - 1);
          else return;
          e.preventDefault();
        }}
        className="relative grid grid-cols-3 rounded-lg bg-surface-container-low p-1"
      >
        <span
          aria-hidden
          style={{ '--at': at } as React.CSSProperties}
          className={cn(
            'absolute inset-y-1 start-1 w-[calc((100%-8px)/3)] rounded-md bg-primary-container',
            '[transform:translateX(calc(var(--at)*100%))] rtl:[transform:translateX(calc(var(--at)*-100%))]',
            'transition-transform duration-long ease-emph motion-reduce:transition-none',
          )}
        />
        {ENGINES.map((e, i) => {
          const on = i === at;
          return (
            <button
              key={e.key}
              ref={(el) => {
                segments.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-segment={e.key}
              onClick={() => onPick(e.key)}
              className={cn(
                'relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5',
                'transition-colors duration-short ease-emph',
                // Inset and offset from the thumb's edge, so the ring reads as
                // where the keyboard is and the fill as what is picked.
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                on ? 'text-primary-on-container' : 'text-on-surface hover:bg-surface-container',
              )}
            >
              <span dir="ltr" className="max-w-full truncate font-mono text-meta font-medium">
                {e.name}
              </span>
              <span dir="ltr" className="flex items-baseline gap-1">
                <span className="text-title-plan font-light leading-none tabular-nums">{coverageFor(e.key)}</span>
                <span
                  className={cn(
                    'font-mono text-body-small transition-colors duration-short ease-emph',
                    on ? 'text-primary-on-container' : 'text-on-surface-variant',
                  )}
                >
                  {`/${CAPABILITIES.length}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid">
        {ENGINES.map((e) => {
          const on = e.key === engine;
          return (
            <div
              key={e.key}
              data-says={e.key}
              aria-hidden={!on}
              className={cn(
                'col-start-1 row-start-1 flex flex-col items-start gap-2.5',
                on
                  ? 'opacity-100 [transition:opacity_var(--dur-med)_var(--ease-emph)_calc(var(--dur-short)_+_80ms)]'
                  : 'pointer-events-none opacity-0 [transition:opacity_var(--dur-short)_var(--ease-emph)]',
                'motion-reduce:transition-none',
              )}
            >
              {/* The badge rides with the sentence, in every cell that has one,
                  so the panel keeps the height it needs for it. */}
              {e.isDefault && (
                <span className="inline-flex items-center rounded-pill bg-primary px-2.5 py-0.5 text-overline font-bold uppercase text-primary-foreground">
                  {t('home.engines.default')}
                </span>
              )}
              <p className="text-lead leading-[1.4] text-on-surface [text-wrap:pretty]">
                {t(`home.engines.about.${e.key}`)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A tile's name, and the default badge on the engine that starts. */
function TileHead({
  engine,
  className,
  'aria-hidden': hidden,
}: {
  engine: (typeof ENGINES)[number];
  className?: string;
  'aria-hidden'?: boolean;
}) {
  return (
    <span aria-hidden={hidden} className={cn('flex flex-wrap items-center gap-2.5', className)}>
      <span dir="ltr" className="whitespace-nowrap font-mono text-title-card font-medium">
        {engine.name}
      </span>
      {engine.isDefault && (
        <span
          className={cn(
            'inline-flex items-center rounded-pill px-2.5 py-0.5 text-overline font-bold uppercase',
            'bg-primary text-primary-foreground',
          )}
        >
          {t('home.engines.default')}
        </span>
      )}
    </span>
  );
}

/**
 * One capability, in the state the chosen engine leaves it in.
 *
 * Three states, and none of them is colour alone: filled where this engine is
 * the only one that runs it, quiet and solid-edged where it runs it alongside
 * others, struck through behind a dashed edge where it does not. The strike is
 * what a reader who cannot separate the hues has, and the words behind it are
 * what a reader who has no colours at all gets.
 */
function Chip({ row, engine }: { row: Capability; engine: EngineKey }) {
  const runs = row.runs.includes(engine);
  const only = runs && row.runs.length === 1;

  return (
    <li
      data-capability={row.name}
      data-state={only ? 'only' : runs ? 'runs' : 'out'}
      className={cn(
        'inline-flex items-baseline gap-2 rounded-pill border px-4 py-2 text-value',
        'transition-colors duration-med ease-emph',
        only && 'border-transparent bg-primary-container text-primary-on-container',
        runs && !only && 'border-surface-container-high bg-surface-container-low text-on-surface',
        !runs && 'border-dashed border-outline-variant text-on-surface-variant',
      )}
    >
      <span className={cn(!runs && 'line-through')}>{row.name}</span>
      {row.sub && (
        <span
          dir="ltr"
          className={cn(
            'font-mono text-meta',
            only ? 'text-primary-on-container' : 'text-on-surface-variant',
          )}
        >
          {row.sub}
        </span>
      )}
      {!runs && <span className="sr-only">{t('home.engines.unsupported')}</span>}
    </li>
  );
}
