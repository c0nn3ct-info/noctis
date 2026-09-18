import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Chrome,
  Cpu,
  Gauge,
  Globe,
  Layers,
  Link as LinkIcon,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  modes: Route,
  rules: Globe,
  profiles: Layers,
  paste: LinkIcon,
  engines: Cpu,
  latency: Gauge,
  scope: Chrome,
  noadmin: ShieldCheck,
  traffic: Activity,
};

interface Lane {
  group: string;
  keys: readonly string[];
  /** Seconds for one full loop. Three primes-ish values, so the three lanes
   * never line back up into a single moving block. */
  seconds: number;
  reverse: boolean;
}

export const CAPABILITY_LANES: readonly Lane[] = [
  { group: 'routing', keys: ['modes', 'rules', 'profiles'], seconds: 26, reverse: false },
  { group: 'setup', keys: ['paste', 'engines', 'latency'], seconds: 32, reverse: true },
  { group: 'scope', keys: ['scope', 'noadmin', 'traffic'], seconds: 29, reverse: false },
];

/* Three copies of a lane's cards make the track; one third of its width is one
 * loop, which is what `lane-drift` translates by. Two copies would seam at the
 * turn, four would cost a third of a screen of layout for nothing. */
const COPIES = 3;

/**
 * Nine capabilities on three drifting lanes: routing, then setup, then scope.
 * The middle lane runs the other way, which is what stops the three from
 * reading as one block sliding sideways.
 *
 * Nothing stops them short of `prefers-reduced-motion`, which drops the
 * duplicates and unwraps the track into a grid.
 *
 * Only the first copy of each lane is real. The other two are `aria-hidden`, so
 * a screen reader hears nine capabilities rather than twenty-seven, and they
 * are dropped entirely when the reader has asked for less motion — at which
 * point the track stops, unwraps into rows, and the fade at both edges lifts,
 * because a still lane behind a mask is just content that has been cut off.
 */
export function CapabilityLanes({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 overflow-hidden',
        '[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]',
        'motion-reduce:overflow-visible motion-reduce:[mask-image:none]',
        // A phone is narrower than one card, so a drifting lane never shows a
        // whole one: every card is cut at both edges and the sentence you are
        // reading slides out of the screen. Below `sm` the band takes the
        // layout reduced motion already gets — the track unwraps, the clones
        // go, and the nine cards stack.
        'max-sm:overflow-visible max-sm:[mask-image:none]',
        className,
      )}
    >
      {CAPABILITY_LANES.map((lane) => (
        <ul
          key={lane.group}
          data-lane
          style={
            {
              '--lane-dur': `${lane.seconds}s`,
              animationDirection: lane.reverse ? 'reverse' : 'normal',
            } as CSSProperties
          }
          className="flex w-max animate-lane-drift gap-2.5 motion-reduce:w-auto motion-reduce:flex-wrap max-sm:w-auto max-sm:animate-none max-sm:flex-wrap"
        >
          {Array.from({ length: COPIES }).flatMap((_, copy) =>
            lane.keys.map((key, i) => {
              const Icon = ICONS[key];
              // Corners alternate along the lane so the row has a rhythm. They
              // are static: swapping them on hover was the design file's
              // radius morph, which the aria2t landing has nowhere.
              const loose = i % 2 === 0;
              return (
                <li
                  key={`${copy}-${key}`}
                  data-card
                  aria-hidden={copy > 0 ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 grow-0 basis-[300px] flex-col gap-3 px-6 py-[22px]',
                    // Stacked, the card's own padding is the band's height: nine
                    // of them at 44px of vertical padding each is a screen and a
                    // half of nothing but gaps.
                    'max-sm:w-full max-sm:basis-full max-sm:px-5 max-sm:py-4',
                    loose ? 'rounded-xl' : 'rounded-lg',
                    'transition-colors duration-med ease-emph hover:bg-surface-container-high',
                    // The lane's own first card sits a step brighter, so each
                    // lane has a head rather than three equal cards.
                    i === 0 ? 'bg-surface-container' : 'bg-surface-container-low',
                    copy > 0 && 'motion-reduce:hidden max-sm:hidden',
                  )}
                >
                  {/* Icon beside the title at the title's size, not stacked
                      over it in a filled circle: that block is the
                      interchangeable feature card, and the container coded
                      nothing. Same call aria2t's ClaimList already made.
                    *
                      Primary, not tertiary. Under the planet accent tertiary
                      is the globe's cyan rim — the rare second voice — and
                      nine of it on a moving band stopped being rare; primary
                      is the land's lavender, the colour this band belongs to. */}
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-[18px] font-bold tracking-[-0.02em] text-on-surface">
                      {t(`home.caps.${key}.title`)}
                    </span>
                  </span>
                  <span className="text-body-medium text-on-surface-variant [text-wrap:pretty]">
                    {t(`home.caps.${key}.body`)}
                  </span>
                </li>
              );
            }),
          )}
        </ul>
      ))}
    </div>
  );
}
