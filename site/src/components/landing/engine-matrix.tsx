import { useLayoutEffect, useRef, useState } from 'react';
import {
  ENGINES,
  GROUPS,
  OPEN_AT_REST,
  countFor,
  type EngineKey,
  type GroupKey,
} from '@/components/landing/engines';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Which engine runs what, as one table with three collapsible sections.
 *
 * The band used to be five stacked blocks: thirteen tiles in three groups
 * labelled by engine coverage, a rule, a paragraph about transports, a second
 * label, and three engine rows in a different visual language. The coverage
 * lived in the group headings, so a reader had to carry "sing-box or mihomo"
 * down the page to use it, and the transports were prose because there was
 * nowhere structural to put them.
 *
 * Here both axes are rows under the same three columns, which is the only place
 * the engines can be compared rather than described. Three things carry it:
 *
 *   - One column is lit, from the header's radius to the footer's. Before a
 *     name is read, one column is solid and two are perforated. It starts on
 *     the engine that is already running and follows whichever head you click,
 *     because "how does this compare against mihomo" is the second question
 *     anybody asks and a fixed stripe cannot answer it.
 *   - A closed section is not empty. Its header states each engine's count in
 *     that engine's column, so shut, the table is still an answer — 13/7/12 and
 *     5/6/5 — and the one row where xray-core leads is visible before anything
 *     is expanded.
 *   - The head pins under the site header and each section's own header pins
 *     under that, so a row nine deep still has both the column it is measured
 *     against and the axis it belongs to on screen.
 *
 * Support is a shape, never a colour: a filled dot or a rule, each with its own
 * text for a screen reader, so the table survives a monochrome print and a
 * reader who cannot tell the two apart by tone. The rule sits at `--outline`
 * rather than `--outline-variant` — at 28% on the 7% ground the latter measured
 * 2.1:1, under the 3:1 a meaningful non-text mark owes (WCAG 1.4.11).
 */

/* How far down each sticky layer sits. The site header is 64px; measured on the
 * built page the table head is 72 below `sm` and 76 from `sm` up, so a section
 * header lands at 136 and 140, less one pixel so the two layers overlap rather
 * than leaving a sliver for the rows to slide through. The head is the higher
 * of the two, so the overlap costs nothing. Guessing these numbers is what
 * opens the seam. */
const HEAD_TOP = 'top-16';
const SECTION_TOP = 'top-[135px] sm:top-[139px]';

export function EngineMatrix({ className }: { className?: string }) {
  // One at a time. Clicking the open section shuts it, which leaves the table
  // as three counted rows — the state a reader gets to deliberately, never the
  // one the band loads in.
  const [open, setOpen] = useState<GroupKey | null>(OPEN_AT_REST);

  /* The lit column. It opens on the engine that is already running, and a
   * second click on the same head puts it out: the light is a reading aid, so
   * a reader who wants the three columns weighed evenly can have that. */
  const [lit, setLit] = useState<EngineKey | null>(ENGINES[0].key);

  /* Shutting the protocols takes nine hundred pixels out of the middle of the
   * page, and the browser's own scroll anchoring does not catch it: the band is
   * a grid whose other column is sticky, so the anchor it picks is not the row
   * the reader is looking at. The header that was clicked is, so it is measured
   * before the state changes and the page is nudged by whatever it moved. */
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);

  useLayoutEffect(() => {
    const held = anchor.current;
    if (!held) return;
    anchor.current = null;
    const moved = held.el.getBoundingClientRect().top - held.top;
    if (moved !== 0) window.scrollBy(0, moved);
  }, [open]);

  function toggle(key: GroupKey, el: HTMLElement) {
    anchor.current = { el, top: el.getBoundingClientRect().top };
    setOpen((current) => (current === key ? null : key));
  }

  /* Each surface a cell can sit on, by whether its column is lit. The divider
   * inside a lit column is painted in that column's own colour rather than
   * skipped: a `border-t` that is transparent still occupies its pixel, so the
   * stripe would gain a hairline gap at every row.
   *
   * The lit fill is one token from the head to the foot and never steps. It
   * stepped up at the section headers before, which put a lighter rectangle
   * inside the column at three places and read as a rendering fault. The
   * headers are legible without it: they sit a step above the panel while the
   * stripe sits a step above them, so the stripe reads as passing over. */
  const cell = (engine: EngineKey, on: string, off: string) => (engine === lit ? on : off);

  return (
    <table
      className={cn(
        // Separate, not collapsed. A collapsed border belongs to the table
        // rather than to the cell, so a sticky cell carries its background away
        // and leaves its borders behind — which is the torn seam that showed
        // under the pinned head at fractional scroll offsets.
        'w-full border-separate border-spacing-0 text-body-medium',
        className,
      )}
    >
      <caption className="sr-only">{t('home.matrix.caption')}</caption>
      <thead>
        <tr>
          {/* A blank corner is a cell, not a header: as a `th` it answered the
              columnheader role with nothing in it. It pins with the rest of the
              head, or the row names would run up behind it. */}
          <td className={cn(// No width below `sm`: the column took 46% of a 350px screen and left
        // 146px of nothing between a name and its first mark. Unset, it
        // shrinks to the longest name and the marks come to meet it.
        'sticky z-20 bg-background sm:w-[46%]', HEAD_TOP)} />
          {ENGINES.map((engine) => (
            <th
              key={engine.key}
              scope="col"
              className={cn(
                'sticky z-20 p-0 align-bottom font-normal',
                HEAD_TOP,
                cell(engine.key, 'rounded-t-lg bg-surface-container-low', 'bg-background'),
              )}
            >
              <button
                type="button"
                aria-pressed={engine.key === lit}
                onClick={() => setLit((current) => (current === engine.key ? null : engine.key))}
                className={cn(
                  'flex w-full flex-col items-center gap-[7px] px-0.5 pb-4 pt-3 sm:px-2.5',
                  'transition-colors duration-med ease-emph',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  // The same corners the lit column takes, so a hover previews
                  // the fill instead of dropping a square block behind it.
                  'rounded-t-lg',
                  cell(engine.key, '', 'hover:bg-surface-container-low'),
                )}
              >
                {/* One chip each, and they are not the same kind of fact: two
                    say where the engine stands, one names the thing it alone
                    can build. Only the default's is filled. */}
                <span
                  className={cn(
                    'inline-flex h-[18px] items-center rounded-pill px-1.5 text-[8px] font-bold uppercase tracking-[0.08em] sm:h-[22px] sm:px-2.5 sm:text-label-unit sm:tracking-[0.16em]',
                    engine.isDefault
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-container-highest text-on-surface',
                  )}
                >
                  {t(`home.matrix.chip.${engine.key}`)}
                </span>
                <span className="whitespace-nowrap font-mono text-[9px] font-medium sm:text-[15px]">
                  {engine.name}
                </span>
              </button>
            </th>
          ))}
        </tr>
      </thead>

      {GROUPS.map((group) => {
        const id = `matrix-${group.key}`;
        const isOpen = open === group.key;
        return (
          <tbody key={group.key} id={id} data-group={group.key}>
            {/* The header and its rows share one body on purpose: a sticky cell
                travels only as far as its row group, so a header alone in its
                own `tbody` has nowhere to go. */}
            <tr data-section>
              <th
                scope="row"
                className={cn(
                  'sticky z-10 border-t border-outline-variant bg-background p-0 text-start',
                  SECTION_TOP,
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={(event) => toggle(group.key, event.currentTarget)}
                  className="flex w-full items-center gap-2 px-2 py-4 text-on-surface transition-colors duration-med ease-emph hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-[11px] sm:px-4"
                >
                  {/* A chevron drawn from two borders rather than shipped as
                      an icon: it is the only rotating thing on the page, and
                      a quarter turn of a square is exact at any size. */}
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block h-[7px] w-[7px] shrink-0 border-b-[1.6px] border-e-[1.6px] border-current',
                      'transition-transform duration-med ease-emph motion-reduce:transition-none',
                      isOpen ? '-rotate-[135deg]' : 'rotate-45',
                    )}
                  />
                  {/* A chip, on the engine chips' own scale: the two rows of
                      labels in this table now read as one kind of thing. */}
                  <span className="inline-flex h-[18px] items-center whitespace-nowrap rounded-pill bg-surface-container-high px-1.5 text-[8px] font-bold uppercase tracking-[0.08em] sm:h-[22px] sm:px-2.5 sm:text-label-unit sm:tracking-[0.16em]">
                    {t(`home.matrix.group.${group.key}`)}
                  </span>
                </button>
              </th>
              {ENGINES.map((engine) => (
                <td
                  key={engine.key}
                  className={cn(
                    'sticky z-10 px-0.5 py-4 text-center font-mono text-[13px] font-semibold tabular-nums sm:px-2.5 sm:text-[15px]',
                    SECTION_TOP,
                    // Opaque, because it pins and rows pass beneath it — but
                    // in the page's own ground rather than a band. A filled
                    // row here was a second highlight competing with the lit
                    // column for the same glance; the label, the rule above it
                    // and the pinning already say "header".
                    cell(engine.key, 'bg-surface-container-low', 'bg-background'),
                    cn('border-t', cell(engine.key, 'border-t-surface-container-low', 'border-t-outline-variant')),
                    // Open, the count is the column's total and the dots below
                    // are the detail; shut, it is all the row says.
                    isOpen || engine.key !== lit ? 'text-on-surface-variant' : 'text-on-surface',
                  )}
                >
                  {countFor(group, engine.key)}
                </td>
              ))}
            </tr>

            {group.rows.map((row) => (
              <tr key={row.name} data-row hidden={!isOpen}>
                <th
                  scope="row"
                  className="border-t border-outline-variant px-2 py-3 text-start font-normal sm:px-4 sm:py-3.5"
                >
                  {/* Stacked on a phone rather than dropped: the scheme is the
                      half of a share link a visitor matches on, so it is the
                      last thing that should go when the column narrows. */}
                  <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2.5">
                    <span className="text-[14px] font-semibold text-on-surface sm:text-[15px]">{row.name}</span>
                    {row.sub && (
                      <span className="font-mono text-label-small text-on-surface-variant">
                        {row.sub}
                      </span>
                    )}
                  </span>
                </th>
                {ENGINES.map((engine) => (
                  <td
                    key={engine.key}
                    className={cn(
                      'border-t px-0.5 py-3 text-center sm:px-2.5 sm:py-3.5',
                      cell(
                        engine.key,
                        'border-t-surface-container-low bg-surface-container-low',
                        'border-t-outline-variant',
                      ),
                    )}
                  >
                    <Mark runs={row.runs.includes(engine.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        );
      })}

      <tfoot>
        <tr>
          <td />
          {ENGINES.map((engine) => (
            <td
              key={engine.key}
              className={cn('h-4 p-0', cell(engine.key, 'rounded-b-lg bg-surface-container-low', ''))}
            />
          ))}
        </tr>
      </tfoot>
    </table>
  );
}

function Mark({ runs }: { runs: boolean }) {
  return (
    <>
      <span className="sr-only">{t(runs ? 'home.matrix.runs' : 'home.matrix.no')}</span>
      {runs ? (
        <span aria-hidden className="inline-block h-[9px] w-[9px] rounded-full bg-on-surface" />
      ) : (
        <span aria-hidden className="inline-block h-px w-3.5 bg-outline align-middle" />
      )}
    </>
  );
}
