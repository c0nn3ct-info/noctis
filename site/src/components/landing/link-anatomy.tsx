import { useState } from 'react';
import { Lock } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { SAMPLE_LINK, parseShareLink } from './share-link';

/**
 * A share link, taken apart into the fields the extension reads. The link sits
 * along the top in a field you can edit; the grid below is what the parser made
 * of whatever is in it, on every keystroke.
 *
 * It is a real field rather than a picture of one because that is the band's
 * claim. "Every field is read locally" is a statement about where the work
 * happens, and a static grid of nine cells cannot make it — paste your own
 * link and the cells change, with nothing leaving the page. Same reasoning the
 * aria2t landing applies to its file picker and its rate limits.
 *
 * The first render parses `SAMPLE_LINK`, which is also the initial state, so
 * the prerendered frame and the first client frame are identical.
 *
 * The fields read as a ledger: name, a leader, the value. The slice each was
 * read out of is not repeated here — the field above is the link, and the old
 * third column ran empty for five of nine rows because its value was that
 * slice minus a delimiter.
 *
 * No pipeline along the foot either. It narrated what the reader was looking
 * at, and its third step — an engine picked — is something nothing on this
 * page does.
 *
 * The panel arrives on the page's own band entrance and nothing in it animates
 * on its own. It used to: a scroll timeline named on a wrapper outside the
 * clip, a window per row spanning `entry` into `contain`, chips travelling
 * from a second copy of the link. Every version of that needed its own
 * geometry, its own easing and its own set of fallbacks, to say something the
 * page's standard arrival already says.
 */
export function LinkAnatomy({ className }: { className?: string }) {
  const [link, setLink] = useState(SAMPLE_LINK);
  const fields = parseShareLink(link);
  const parsed = fields.length > 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest',
        // The caret and the highlight in the field below ship as Chrome's
        // unless a palette claims them, which is the cheapest tell that a
        // surface was assembled rather than built.
        'caret-tertiary selection:bg-tertiary-container selection:text-tertiary-on-container',
        className,
      )}
    >
      {/* The row carries the field's focus, because the input fills it and a
          ring on the input alone would draw a rectangle inside a rectangle.
          The tint alone was the whole indicator before, and one step of the
          container ladder is about 6% of lightness — visible, but nowhere near
          the 3:1 an indicator owes its surroundings (WCAG 2.4.11). */}
      <div className="flex items-center gap-3.5 border-b border-surface-container-high px-[clamp(16px,2.4vw,24px)] py-1.5 focus-within:bg-surface-container-low focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
        <Lock className="h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
        {/* One line, scrolling rather than wrapping: the link is long by nature,
            and a field that grew to three lines would push the grid it
            introduces off the screen. */}
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          aria-label={t('home.anatomy.input_aria')}
          spellCheck={false}
          autoComplete="off"
          // `py-3` rather than a taller row: 20px of input inside a 56px row
          // meant a tap in the row but outside that band did not focus it.
          className="min-w-0 flex-1 bg-transparent py-3 font-mono text-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
        />
        {link !== SAMPLE_LINK && (
          <button
            type="button"
            onClick={() => setLink(SAMPLE_LINK)}
            className="m3-state-layer shrink-0 rounded-pill px-3 py-1.5 text-label-medium text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('home.anatomy.reset')}
          </button>
        )}
        {/* Derived, not asserted: the panel says how many fields it got out of
            what is in the box, which is a fact about this render. */}
        <span className="inline-flex h-7 shrink-0 items-center rounded-pill bg-surface-container-high px-3 text-label-unit font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
          {t('home.anatomy.fields').replace('{n}', String(fields.length))}
        </span>
      </div>

      {parsed ? (
        /* A leadered ledger: the field's name, a run of dots, the value it
         * resolved to. One column, so every name starts at one x and every
         * value ends at another — two rails, and a leader long enough to be
         * the device a spec sheet uses rather than three dots of texture.
         *
         * The raw slice each field was read out of is gone from here. It said
         * the same thing as the link in the field above, and saying it twice is
         * what left the old third column running empty for five of nine rows. */
        <dl className="m-0 px-[clamp(16px,2.4vw,24px)] py-[14px]">
          {fields.map((f, i) => (
            <div key={`${i}-${f.label}`} data-field className="flex items-baseline gap-2.5 py-[7px]">
              <dt className="text-label-unit font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
                {f.label}
              </dt>
              <span
                aria-hidden
                data-leader
                className="h-px min-w-[14px] flex-1 self-center bg-[radial-gradient(circle,hsl(var(--outline-variant))_1px,transparent_1px)] bg-[length:5px_1px] bg-repeat-x"
              />
              <dd
                className={cn(
                  'm-0 truncate text-end font-mono text-body-medium tabular-nums',
                  f.decides ? 'text-tertiary-on-container' : 'text-on-surface',
                )}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-[clamp(16px,2.4vw,24px)] py-[22px] text-body-medium text-on-surface-variant">
          {t('home.anatomy.empty')}
        </p>
      )}
    </div>
  );
}
