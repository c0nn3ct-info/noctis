import { useState } from 'react';
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
 * accent, the room for a sentence and the figure at full size; the other two
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
      {/* Stacked below `lg`, where a row of three would leave each tile too
          narrow for its own figure; a row from `lg` up, where the chosen one
          can take the room the other two give it. At 768 the row gave the
          chosen tile 324px, and the tile's fixed height clipped the figure
          and the sentence beside it. A floor, not a height, even here: the
          Russian sentence runs 7px past 210 at 1024. */}
      <div className="flex flex-col gap-3 lg:min-h-[210px] lg:flex-row">
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
                // boxes rather than a list.
                'transition-[flex-grow,background-color,color] duration-long ease-emph motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                // `basis-0` with the grow factor, so the three widths are the
                // ratio and nothing else: left on `auto`, the chosen tile is
                // measured by the sentence inside it first and then given its
                // share of what is left, which took it to five times its
                // neighbours instead of a little over twice.
                'lg:basis-0',
                chosen
                  ? 'bg-primary text-primary-foreground lg:grow-[2.2]'
                  : 'bg-surface-container-low text-on-surface hover:bg-surface-container lg:grow',
              )}
            >
              <span className="flex flex-wrap items-center gap-2.5">
                <span dir="ltr" className="whitespace-nowrap font-mono text-[19px] font-medium">
                  {e.name}
                </span>
                {e.isDefault && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-pill px-2.5 py-0.5 text-overline font-bold uppercase',
                      chosen
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {t('home.engines.default')}
                  </span>
                )}
              </span>

              {/* The figure and its sentence sit on one line, the figure at its
                  own width and the sentence in what is left. Wrapping instead
                  put the sentence under the number and cost the tile the
                  proportion it was given the room for. It only wraps stacked,
                  where there is no room beside anything. */}
              <span className="flex flex-wrap items-end gap-x-7 gap-y-3 sm:flex-nowrap">
                <span dir="ltr" className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-[72px] font-light leading-[0.85] tracking-[-0.03em] tabular-nums">
                    {coverageFor(e.key)}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[15px]',
                      chosen ? 'text-primary-foreground' : 'text-on-surface-variant',
                    )}
                  >
                    {`/${CAPABILITIES.length}`}
                  </span>
                </span>
                {/* Only the chosen tile carries its sentence: on the other two
                    there is no room for it, and a line that appears at three
                    widths is three different paragraphs. */}
                {chosen && (
                  <span className="min-w-0 flex-1 text-[20px] leading-[1.35] text-primary-foreground [text-wrap:pretty]">
                    {t(`home.engines.about.${e.key}`)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col">
        {groups.map((group, i) => {
          const runs = group.engines.includes(engine);
          return (
            <div
              key={group.engines.join('+')}
              data-reach={group.engines.join('+')}
              className={cn(
                'grid items-start gap-3 py-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6',
                // No rule over the first group: it would draw a line under the
                // tiles that belongs to neither.
                i > 0 && 'border-t border-outline-variant',
              )}
            >
              <span className="flex items-baseline gap-2.5 lg:pt-[9px]">
                <span
                  dir="ltr"
                  className={cn(
                    'font-mono text-[15px] font-medium transition-colors duration-med ease-emph',
                    runs ? 'text-on-surface' : 'text-on-surface-variant',
                  )}
                >
                  {reachTitle(group.engines)}
                </span>
                <span dir="ltr" className="font-mono text-[13px] text-on-surface-variant">
                  {group.rows.length}
                </span>
              </span>

              <ul className="flex flex-wrap gap-2">
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
        'inline-flex items-baseline gap-2 rounded-pill border px-4 py-2 text-[16px]',
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
            'font-mono text-[13px]',
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
