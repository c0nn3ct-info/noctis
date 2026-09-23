import { useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { ENGINES } from './engines';
import { engineName, engineRest, pickEngine, type EnginePick } from './engine-pick';
import { noteFor } from './field-notes';
import { SAMPLE_LINK, parseShareLink, type Field } from './share-link';

/** What is lit: a field of the link, the engine rail, or nothing. */
type Active = number | 'engine' | null;

/**
 * Which field a character of the link belongs to.
 *
 * The parse is exhaustive and in order, so the fields are consecutive runs over
 * the string and finding one is a walk rather than a search. Returns `null`
 * past the end, which is where the pointer is when it is in the field but after
 * the link.
 */
export function fieldAt(fields: readonly Field[], index: number): number | null {
  if (index < 0) return null;
  let at = 0;
  for (let i = 0; i < fields.length; i++) {
    at += fields[i].raw.length;
    if (index < at) return i;
  }
  return null;
}

/**
 * A share link, taken apart into the fields the extension reads, and the engine
 * those fields ask for.
 *
 * It is a real field rather than a picture of one because that is the band's
 * claim. "Every field is read locally" is a statement about where the work
 * happens, and a static grid cannot make it — paste your own link and the panel
 * changes, with nothing leaving the page.
 *
 * Each field is an entry of three lines: its name, its value, and what that
 * field is for. Every draft before this one was an inventory — tiles, a ledger,
 * a numbered listing — and all of them told a visitor what the link contains
 * while none said what any of it means. `cdn.example.com` is a string until
 * something says it is the site the handshake claims to visit.
 *
 * Nothing is marked until the visitor points at something, and then one thing
 * is: an entry lights its own slice of the link, a slice of the link lights its
 * entry — arithmetic, since the copy under the caret cannot take events — and
 * the engine rail lights all four deciding fields at once, which is the
 * sentence its own foot writes out.
 *
 * The band walked the fields on a timer for a while. It made the point that the
 * two halves are one object without anyone pointing at anything, and it cost
 * the page a mark moving in the corner of the eye for as long as the band was
 * on screen. The mark is worth more when it answers a question that was asked.
 *
 * The first render parses `SAMPLE_LINK` and marks nothing, so the prerendered
 * frame and the opening client frame are identical.
 */
export function LinkAnatomy({ className }: { className?: string }) {
  const [link, setLink] = useState(SAMPLE_LINK);
  /** What the pointer is on, which is nothing until it is on something. */
  const [active, setActive] = useState<Active>(null);

  const fields = parseShareLink(link);
  const pick = pickEngine(fields);

  /** Whether a field is lit: pointed at, or one of the four the rail claims. */
  const lit = (field: Field, i: number) =>
    active === i || (active === 'engine' && field.decides);

  return (
    <div
      className={cn(
        // `rounded-md` is 16px, the radius this site gives a container of data —
        // the FAQ's frame, the diagram's scroller, the language menu.
        'overflow-hidden rounded-md border border-surface-container-high bg-surface-container-lowest',
        // The caret and the highlight in the field ship as Chrome's unless a
        // palette claims them, which is the cheapest tell that a surface was
        // assembled rather than built.
        'caret-primary selection:bg-primary-container selection:text-primary-on-container',
        // The focus indicator belongs to the card, not to the row inside it: an
        // inset ring on the row draws square corners the radius then clips.
        'focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring',
        className,
      )}
    >
      <LinkField
        link={link}
        onChange={setLink}
        fields={fields}
        lit={lit}
        onHover={setActive}
      />

      {fields.length === 0 ? (
        <p className="px-[clamp(16px,2.4vw,24px)] py-6 text-body-medium text-on-surface-variant">
          {t('home.anatomy.empty')}
        </p>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
          <Entries fields={fields} hover={active} lit={lit} onHover={setActive} />
          {pick && (
            <Rail
              pick={pick}
              decides={fields.filter((f) => f.decides)}
              hover={active}
              onHover={setActive}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The link, editable, with the fields the pointer is on lit inside it.
 *
 * An `<input>` paints one colour, so the colours are a copy of the string lying
 * exactly under the caret: same font, same size, same padding, same box. The
 * input's own text is transparent and it scrolls the copy with it, which is
 * what keeps the two in register once the link is longer than the field.
 *
 * The copy is decoration and the input is the control, so the copy is hidden
 * from a reader who is told the same thing by the entries.
 */
function LinkField({
  link,
  onChange,
  fields,
  lit,
  onHover,
}: {
  link: string;
  onChange: (next: string) => void;
  fields: readonly Field[];
  lit: (field: Field, i: number) => boolean;
  onHover: (next: Active) => void;
}) {
  const mirror = useRef<HTMLDivElement>(null);

  /**
   * Which field the pointer is over, from where it is along the line.
   *
   * The copy under the caret is the only thing that knows where each slice
   * sits, and it cannot be asked: it is under a transparent input that has to
   * keep every click, or the field stops being a field. So the position is
   * arithmetic instead — the face is monospaced, so one character's advance is
   * the whole line over its character count, and the column under the pointer
   * is the distance from the line's start over that.
   */
  const fieldUnder = (e: React.MouseEvent<HTMLInputElement>): number | null => {
    const width = mirror.current ? mirror.current.scrollWidth / Math.max(link.length, 1) : 0;
    // No layout to measure: the server pass and jsdom both report zero, and a
    // division by it would put the pointer on the first field always.
    if (!width) return null;
    const input = e.currentTarget;
    const x = e.clientX - input.getBoundingClientRect().left + input.scrollLeft;
    return fieldAt(fields, Math.floor(x / width));
  };

  return (
    // No fill of its own when the field takes focus: a second ground on the
    // first row of a card reads as a selected row rather than as a focused
    // field, and the card's ring already says where the focus is.
    <div className="flex items-center gap-3.5 border-b border-surface-container-high px-[clamp(16px,2.4vw,24px)] py-1.5">
      <Lock className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
      <div className="relative min-w-0 flex-1">
        <div
          ref={mirror}
          aria-hidden
          data-mirror
          dir="ltr"
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre py-3 font-mono text-[15px] leading-[1.6] text-on-surface-variant"
        >
          {fields.length === 0 ? (
            <span className="text-on-surface">{link}</span>
          ) : (
            fields.map((f, i) => (
              <span
                key={`${i}-${f.label}`}
                data-slice
                data-state={lit(f, i) ? 'active' : 'plain'}
                className={cn(
                  // 3px. The shape scale starts at 8, which is a card's corner
                  // and half the height of this text.
                  'rounded-[3px] transition-colors duration-short ease-emph',
                  // Grown by a 2px ring rather than by padding: padding here
                  // would move every glyph after it, and the copy has to keep
                  // the input's metrics to the pixel or it slides out from
                  // under the caret. A shadow takes no space.
                  lit(f, i) &&
                    'bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--primary))]',
                )}
              >
                {f.raw}
              </span>
            ))
          )}
        </div>
        {/* One line, scrolling rather than wrapping: the link is long by nature,
            and a field that grew to three lines would push the entries it
            introduces off the screen.
          *
            `py-3` rather than a taller row: 20px of input inside a 56px row
            meant a tap in the row but outside that band did not focus it. */}
        <input
          type="text"
          value={link}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
          // Pointing at a slice of the link lights it, its entry below, and
          // nothing else — the same mark the entries give, from the other end.
          onMouseMove={(e) => onHover(fieldUnder(e))}
          onMouseLeave={() => onHover(null)}
          aria-label={t('home.anatomy.input_aria')}
          spellCheck={false}
          autoComplete="off"
          dir="ltr"
          className="relative block w-full min-w-0 bg-transparent py-3 font-mono text-[15px] leading-[1.6] text-transparent outline-none"
        />
      </div>
      {link !== SAMPLE_LINK && (
        <button
          type="button"
          onClick={() => onChange(SAMPLE_LINK)}
          className="m3-state-layer inline-flex min-h-11 shrink-0 items-center rounded-pill px-3 text-label-medium text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('home.anatomy.reset')}
        </button>
      )}
    </div>
  );
}

/**
 * One entry per field: the name it is called, the value it carries, and what it
 * is for. Three lines, so a field is one unit rather than a row to read across.
 *
 * The hairlines are borders on the cells rather than a gap over a coloured
 * ground: a grid whose cells do not fill the last row leaves that ground
 * showing as a block of nothing, and how many fields a link carries is the
 * visitor's business, not the layout's. Which edges each cell draws depends on
 * the column count, so the three rules are written for three ranges that cannot
 * overlap — no cascade to unpick.
 */
function Entries({
  fields,
  hover,
  lit,
  onHover,
}: {
  fields: readonly Field[];
  hover: Active;
  lit: (field: Field, i: number) => boolean;
  onHover: (next: Active) => void;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        '[&>*]:border-surface-container',
        'max-sm:[&>*+*]:border-t',
        'sm:max-lg:[&>*:nth-child(n+3)]:border-t sm:max-lg:[&>*:nth-child(2n)]:border-s',
        'lg:[&>*:nth-child(n+4)]:border-t lg:[&>*:nth-child(3n+2)]:border-s lg:[&>*:nth-child(3n)]:border-s',
      )}
    >
      {fields.map((field, i) => (
        <div
          key={`${i}-${field.label}`}
          data-field
          data-state={lit(field, i) ? 'active' : 'plain'}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            'flex min-w-0 flex-col gap-2 px-6 py-5 transition-colors duration-short ease-emph',
            // The ground follows the pointer alone: the rail lights four values
            // at once and the walk lights one every second and a half, and
            // either would read as a selection sliding around the card.
            hover === i && 'bg-surface-container-low',
          )}
        >
          <span
            className={cn(
              'text-overline uppercase',
              field.decides ? 'text-on-surface' : 'text-on-surface-variant',
            )}
          >
            {field.label}
          </span>
          {/* The value alone: the punctuation that introduces it is in the link
              above, and repeating `?security=` here would make the entry a
              second copy of the string rather than a reading of it. */}
          <span dir="ltr" title={field.value} className="min-w-0 truncate font-mono text-[16px] leading-[1.4]">
            <span
              data-value
              className={cn(
                // Padded and pulled back out, so a value that lights up does not
                // move the line it sits on.
                '-mx-[3px] rounded-[3px] px-[3px] transition-colors duration-short ease-emph',
                lit(field, i) ? 'bg-primary text-primary-foreground' : 'text-on-surface',
              )}
            >
              {field.value}
            </span>
          </span>
          <span className="text-[14px] leading-[1.45] text-on-surface-variant [text-wrap:pretty]">
            {noteFor(field)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The engine rail: which of the three runs this link, in what state the link
 * leaves the other two, and the fields that decided it.
 *
 * Pointing at the rail lights those fields in the link and in their entries,
 * which is the rail's own foot said in colour instead of in names.
 *
 * Every row states its state in words, so this is read rather than hidden: a
 * struck-through name needs sight to mean anything, and "cannot run it" does
 * not.
 */
function Rail({
  pick,
  decides,
  hover,
  onHover,
}: {
  pick: EnginePick;
  decides: readonly Field[];
  hover: Active;
  onHover: (next: Active) => void;
}) {
  return (
    <div
      data-rail
      data-state={hover === 'engine' ? 'active' : 'plain'}
      onMouseEnter={() => onHover('engine')}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'flex flex-col gap-3.5 border-t border-surface-container-high p-6 transition-colors duration-short ease-emph',
        'lg:border-s lg:border-t-0',
        hover === 'engine' && 'bg-surface-container-low',
      )}
    >
      <span className="text-overline uppercase text-on-surface-variant">
        {t('home.anatomy.engine')}
      </span>

      <ul dir="ltr" className="flex flex-col gap-1.5">
        {ENGINES.map((engine) => {
          const runs = pick.engines.includes(engine.key);
          const chosen = pick.chosen === engine.key;
          return (
            <li
              key={engine.key}
              data-engine={engine.key}
              data-state={chosen ? 'chosen' : runs ? 'able' : 'out'}
              className={cn(
                'flex items-center justify-between gap-3 rounded-sm border px-3.5 py-2.5 font-mono text-[14px] font-medium transition-colors duration-med ease-emph',
                chosen && 'border-transparent bg-primary-container text-primary-on-container',
                !chosen && runs && 'border-outline-variant text-on-surface',
                !runs && 'border-outline-variant text-on-surface-variant',
              )}
            >
              <span className="min-w-0 truncate">{engine.name}</span>
              <span
                className={cn(
                  'shrink-0 font-sans text-label-medium',
                  chosen ? 'text-primary-on-container' : 'text-on-surface-variant',
                )}
              >
                {t(
                  chosen
                    ? 'home.anatomy.chip_starts'
                    : runs
                      ? 'home.anatomy.chip_able'
                      : 'home.anatomy.chip_out',
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <span className="text-[14px] leading-[1.5] text-on-surface-variant [text-wrap:pretty]">
        {reason(pick)}
      </span>

      {decides.length > 0 && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-surface-container-high pt-3.5">
          <span className="text-overline uppercase text-on-surface-variant">
            {t('home.anatomy.decided_by')}
          </span>
          {/* Read off the link in the field rather than written out: a link with
              no security parameter has three of these, and naming a fourth
              would be the page describing a link nobody pasted. */}
          <span dir="ltr" className="font-mono text-[13px] leading-[1.6] text-on-surface-variant">
            {decides.map((f) => f.label).join(' · ')}
          </span>
        </div>
      )}
    </div>
  );
}

/** The sentence the entries add up to. */
function reason(pick: EnginePick): string {
  if (pick.unknown) return t('home.anatomy.engine_unknown');
  if (pick.engines.length === 0) {
    return t('home.anatomy.engine_none')
      .replace('{what}', pick.because?.name ?? '')
      .replace('{other}', pick.against?.name ?? '');
  }
  if (!pick.because) return t('home.anatomy.engine_any');
  if (pick.engines.length === 1) {
    return t('home.anatomy.engine_only')
      .replace('{engine}', engineName(pick.engines[0]))
      .replace('{what}', pick.because.name);
  }
  return t('home.anatomy.engine_without')
    .replace('{what}', pick.because.name)
    .replace('{engine}', engineRest(pick.engines).map(engineName).join(', '));
}
