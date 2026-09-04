import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConnectionVisual } from '@/components/m3/connection-visual';
import { Button } from '@/components/ui/button';
import { Grid, Row, Stack } from '@/storybook/layout';
import { keyOf, useRootTokens, Section } from './shared';

/**
 * Durations, easings and the standing loops.
 *
 * Motion is the one foundation a static page cannot show, so the travel stories
 * are driven by a button: press Play and every bar starts at the same instant,
 * which is the only way to compare two curves or two durations honestly. The
 * values printed beside each bar are read from `getComputedStyle`, and the bars
 * themselves transition on `var(--dur-*)` / `var(--ease-*)` rather than on a
 * copy of the numbers.
 */
const meta = {
  title: 'Foundations/Motion',
  // A full-width reference sheet, not a centred specimen (see shared.tsx).
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const TRACK = 320;
const THUMB = 28;

/**
 * One bar. `duration` and `easing` are passed through as `var()` references, so
 * the animation is timed by the token and not by a number copied out of it.
 */
function Bar({ duration, easing, moved }: { duration: string; easing: string; moved: boolean }) {
  return (
    <div
      className="rounded-pill bg-surface-container-high"
      style={{
        position: 'relative',
        width: TRACK,
        maxWidth: '100%',
        height: 16,
        overflow: 'hidden',
      }}
    >
      <div
        className="rounded-pill bg-primary"
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: THUMB,
          height: 12,
          transform: moved ? `translateX(${TRACK - THUMB - 4}px)` : 'translateX(0)',
          transitionProperty: 'transform',
          transitionDuration: `var(${duration})`,
          transitionTimingFunction: `var(${easing})`,
        }}
      />
    </div>
  );
}

/**
 * Live `prefers-reduced-motion` state. Under `reduce` the stylesheet narrows
 * `transition-property` to colour, opacity and shadow, so the bars below jump
 * instead of travelling — that is the intended behaviour, not a broken story.
 */
function ReducedMotionNote() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return (
    <div className="rounded-md bg-surface-container p-3">
      <Stack gap={4}>
        <div className="text-title-small text-on-surface">
          prefers-reduced-motion: {reduced ? 'reduce' : 'no-preference'}
        </div>
        <div className="text-body-small text-on-surface-variant">
          Reduce is not a blanket kill. Colour, opacity and elevation keep easing, at
          --dur-short, so a hover or a theme flip still reads as a change; everything that
          travels stops, which is why the bars above jump. The decorative loops settle at 0.4
          opacity, the status dot holds full strength, a spinner slows to 1.8s rather than
          stopping — a stopped spinner reads as a hang — and .shape-morph drops its
          transition. The active state of a press keeps its scale: it lasts as long as the
          pointer is down and reads as pressure, not as animation.
        </div>
      </Stack>
    </div>
  );
}

/** Play/Reset for the travel stories. */
function Transport({ moved, onToggle }: { moved: boolean; onToggle: () => void }) {
  return (
    <Row gap={8}>
      <Button variant="filled-tonal" size="s" onClick={onToggle}>
        {moved ? 'Reset' : 'Play'}
      </Button>
      <span className="text-body-small text-on-surface-variant">
        Every bar starts together, so the difference is the token.
      </span>
    </Row>
  );
}

// Only two of the five steps have a caller on the site; the other three are
// carried so the scale matches the extension's, which is where the popup's
// longer panel transitions live.
const DURATIONS = [
  { token: '--dur-x-short', use: 'No caller on the site' },
  { token: '--dur-short', use: 'State layers, hover and press, the FAQ chevron' },
  { token: '--dur-med', use: 'Card elevation, the monogram shape morph' },
  { token: '--dur-long', use: 'No caller on the site' },
  { token: '--dur-x-long', use: 'No caller — the bars in Easings run at it' },
] as const;

const DURATION_TOKENS = DURATIONS.map((duration) => duration.token);

/**
 * The five duration steps, all on `--ease-emph`, so only the length differs.
 * `duration-short` and `duration-med` in the components come from
 * `transitionDuration` in `tailwind.config.ts`, which restates these as
 * literal ms values rather than as `var()` references — the one place where
 * the two lists have to be kept in step by hand.
 */
export const Durations: Story = {
  render: (_args, { globals }) => <DurationsPage tokenKey={keyOf(globals)} />,
};

function DurationsPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(DURATION_TOKENS, tokenKey);
  const [moved, setMoved] = useState(false);
  return (
    <Stack gap={20}>
      <Transport moved={moved} onToggle={() => setMoved((previous) => !previous)} />
      <Section title="Duration">
        <Stack gap={16}>
          {DURATIONS.map((duration) => (
            <Stack key={duration.token} gap={6}>
              <Row gap={8}>
                <code className="text-label-small text-on-surface">{duration.token}</code>
                <code className="text-label-small text-on-surface-variant">
                  {values[duration.token] || '—'}
                </code>
                <span className="text-body-small text-on-surface-variant">{duration.use}</span>
              </Row>
              <Bar duration={duration.token} easing="--ease-emph" moved={moved} />
            </Stack>
          ))}
        </Stack>
      </Section>
      <ReducedMotionNote />
    </Stack>
  );
}

const EASINGS = [
  { token: '--ease-emph', use: 'The default: colour, state layers, elevation' },
  { token: '--ease-emph-decel', use: 'Arrivals — the pulse-ring keyframes' },
  { token: '--ease-spring', use: 'Press feedback on the button family' },
  // The site is the only surface that still carries this curve.
  { token: '--ease-spring-standard', use: 'ServerMonogram and .shape-morph' },
] as const;

const EASING_TOKENS = EASINGS.map((easing) => easing.token);

/**
 * The same travel at `--dur-x-long`, so the shape of each curve is visible.
 * Both springs overshoot and come back, by very different amounts:
 * `--ease-spring` is the generic backOut (control point 1.56), which passes its
 * target by about 10% before settling, while `--ease-spring-standard` (1.06)
 * barely reaches past it at all. Neither belongs on a `transition` shorthand
 * that also carries colour, where an overshoot interpolates past the target and
 * back. The extension keeps only the gentle curve, under the name
 * `--ease-spring`; the site still carries both.
 */
export const Easings: Story = {
  render: (_args, { globals }) => <EasingsPage tokenKey={keyOf(globals)} />,
};

function EasingsPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(EASING_TOKENS, tokenKey);
  const [moved, setMoved] = useState(false);
  return (
    <Stack gap={20}>
      <Transport moved={moved} onToggle={() => setMoved((previous) => !previous)} />
      <Section title="Easing">
        <Stack gap={16}>
          {EASINGS.map((easing) => (
            <Stack key={easing.token} gap={6}>
              <Row gap={8}>
                <code className="text-label-small text-on-surface">{easing.token}</code>
                <code className="text-label-small text-on-surface-variant">
                  {values[easing.token] || '—'}
                </code>
                <span className="text-body-small text-on-surface-variant">{easing.use}</span>
              </Row>
              <Bar duration="--dur-x-long" easing={easing.token} moved={moved} />
            </Stack>
          ))}
        </Stack>
      </Section>
      <ReducedMotionNote />
    </Stack>
  );
}

function Loop({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <Stack gap={8}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 96,
          borderRadius: 'var(--shape-md)',
          background: 'hsl(var(--surface-container-low))',
        }}
      >
        {children}
      </div>
      <code className="text-label-small text-on-surface">{title}</code>
      <span className="text-body-small text-on-surface-variant">{note}</span>
    </Stack>
  );
}

/**
 * The three named keyframe animations from `tailwind.config.ts`, the spinner
 * Tailwind ships, and the one component whose whole purpose is motion. Every
 * one of them is infinite; the one-shot family belongs elsewhere —
 * `data-[state=open]:animate-in` and its siblings come from
 * `tailwindcss-animate` and are the dropdown menu's enter and exit, which
 * `Primitives/DropdownMenu` shows.
 *
 * `animate-pulse-ring` reads `var(--pulse-dur, 3s)`, so a caller sets the
 * period — `ConnectionVisual` gives each state its own and staggers three rings
 * by a third of it.
 */
export const Loops: Story = {
  render: () => (
    <Stack gap={20}>
      <Grid columns={3} gap={20}>
        <Loop title="animate-pulse-ring" note="Attention ring around a live target.">
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <span
              className="animate-pulse-ring rounded-pill bg-primary"
              style={{ position: 'absolute', inset: -6 }}
            />
            <span className="rounded-pill bg-primary" style={{ width: 16, height: 16 }} />
          </span>
        </Loop>
        <Loop title="animate-breathe" note="Idle glow: scale 0.94→1 at 45–70% opacity.">
          <span
            className="animate-breathe rounded-pill bg-tertiary"
            style={{ width: 32, height: 32 }}
          />
        </Loop>
        <Loop title="animate-status-dot" note="A connection that is up and reporting.">
          <span
            className="animate-status-dot rounded-pill bg-success"
            style={{ width: 12, height: 12 }}
          />
        </Loop>
        <Loop title="animate-spin" note="Busy. Slowed to 1.8s under reduced motion.">
          <span
            className="animate-spin rounded-pill"
            style={{
              width: 24,
              height: 24,
              border: '3px solid hsl(var(--outline-variant))',
              borderTopColor: 'hsl(var(--primary))',
            }}
          />
        </Loop>
        <Loop title="ConnectionVisual connecting" note="Three pulse rings, staggered.">
          <ConnectionVisual state="connecting" size={88} />
        </Loop>
        <Loop title="ConnectionVisual idle" note="One breathing ring, two at rest.">
          <ConnectionVisual state="idle" size={88} />
        </Loop>
      </Grid>
      <ReducedMotionNote />
    </Stack>
  ),
};
