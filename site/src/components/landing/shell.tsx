// The furniture every band on the reworked landing page is built from, ported
// from the aria2t site's `src/components/landing/shell.tsx`. Nothing here
// carries a colour of its own: every value is an M3 token from globals.css, so
// the page follows the site theme like the rest of the site does.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LandingSectionProps {
  id?: string;
  className?: string;
  /** Wraps the children in the page width. Off for a band that lays itself out. */
  contained?: boolean;
  children: ReactNode;
}

/**
 * The side gutter, and it sits *inside* the `max-w-[1160px]` box rather than on
 * the section around it. Both spellings centre a 1160 column on a wide window
 * and put the content in different places: padding the section insets the band
 * and then centres 1160 inside what is left, so a band's text starts 40px
 * outside the rule that closes the page. Exported because the Layout's main
 * and footer take the same one - one gutter for the whole site.
 */
export const GUTTER = 'px-5 sm:px-8 lg:px-10';

/**
 * One band.
 *
 * The page's own `clamp(16px,4vw,44px)` was 4px wider than the footer's at
 * desktop, which is why the gutter is a shared constant rather than a value
 * each surface spells for itself.
 */
export function LandingSection({ id, className, contained = true, children }: LandingSectionProps) {
  return (
    // `data-enter-section` is what `useSectionEntrance` observes, and every
    // band wants it: the hero is the one section on the page that does not,
    // because it is already on screen when the page opens — which is why the
    // hero is not a LandingSection.
    <section
      id={id}
      data-enter-section
      className={cn('py-12 sm:py-16 lg:py-24', id && 'scroll-mt-20', className)}
    >
      {contained ? (
        <div className={cn('mx-auto w-full max-w-[1160px]', GUTTER)}>{children}</div>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * A band heading's type, shared by `SectionHeading` and the FAQ band, which
 * lays its heading out by hand. Line height 1.1 rather than 1.05: at weight 800
 * a heading that wraps to three lines in Spanish or Persian had its ascenders
 * touching the line above.
 */
export const SECTION_TITLE =
  'text-balance text-[clamp(28px,3.6vw,40px)] font-extrabold leading-[1.1] tracking-[-0.03em]';

interface SectionHeadingProps {
  title: string;
  body?: string;
  /** Heading level; a band under the page h1 is an h2, which is the default. */
  level?: 2 | 3;
  className?: string;
}

/**
 * A band's heading and the sentence under it, in one column.
 *
 * There is no kicker prop, on purpose. Every band here used to open with a
 * small uppercase label over its heading, which is the pattern aria2t's own
 * shell took out: a heading carries its own weight, and a kicker above one
 * repeats the section name in the document outline for nothing. An eyebrow
 * belongs over a list or a figure, never over a heading.
 *
 * The size is this page's own — heavier and tighter than aria2t's, which is
 * the one thing not taken across, because the weight pair is what the hero's
 * type is built on.
 */
export function SectionHeading({ title, body, level = 2, className }: SectionHeadingProps) {
  const Heading = `h${level}` as const;
  return (
    <div className={cn('max-w-[600px]', className)}>
      {/* Sized off the viewport rather than at breakpoints, and balanced: these
          headings are a few words in English and can be half again as long in
          Spanish or Persian, so the wrap has to be the browser's call. */}
      <Heading className={SECTION_TITLE}>
        {title}
      </Heading>
      {body && (
        <p className="mt-4 max-w-[65ch] text-pretty text-body-large leading-[1.7] text-on-surface-variant">
          {body}
        </p>
      )}
    </div>
  );
}

export type PointTone = 'primary' | 'tertiary' | 'success';

/* Container pairs, never a colour and a fill picked separately: the `-container`
 * fill and its `-on-container` text are defined against each other in both
 * themes, which is what a hand-picked pair failed at here — `text-tertiary` on
 * a grey fill measured 3.39:1 in the light theme. */
const POINT_TONE: Record<PointTone, string> = {
  primary: 'bg-primary-container text-primary-on-container',
  tertiary: 'bg-tertiary-container text-tertiary-on-container',
  success: 'bg-success-container text-success-on-container',
};

export interface Point {
  icon: LucideIcon;
  tone?: PointTone;
  text: string;
}

/** The supporting facts under a band's heading. */
export function PointList({ points, className }: { points: readonly Point[]; className?: string }) {
  return (
    // A list arrives item by item along the line it is read on.
    <ul data-enter-stagger="soft" className={cn('flex flex-col gap-3', className)}>
      {points.map((p) => {
        const Icon = p.icon;
        // Start-aligned, not centred: a point that wraps to two lines would
        // otherwise float its badge between them.
        return (
          <li key={p.text} className="flex items-start gap-3">
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full',
                POINT_TONE[p.tone ?? 'success'],
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-body-large">{p.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface Claim {
  icon: LucideIcon;
  /** What the visitor gets. */
  title: string;
  /** How it works. A different sentence, not the title again. */
  body: string;
}

/**
 * A claim and its mechanism, as pairs.
 *
 * One muted icon each, at the title's size rather than in a filled badge: a row
 * of coloured badges here codes nothing, and with no icon at all the three read
 * as one grey block. The icon is what gives the eye a place to start, and the
 * indent under it holds the pair together.
 */
export function ClaimList({ claims, className }: { claims: readonly Claim[]; className?: string }) {
  return (
    <ul data-enter-stagger="soft" className={cn('flex w-full flex-col gap-6', className)}>
      {claims.map(({ icon: Icon, title, body }) => (
        <li key={title} className="flex gap-3.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
          <div className="min-w-0">
            <div className="text-title-dense font-semibold">{title}</div>
            <p className="mt-1 text-body-medium text-on-surface-variant">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
