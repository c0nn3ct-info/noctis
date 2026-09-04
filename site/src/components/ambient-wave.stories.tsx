import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Stack } from '@/storybook/layout';
import { WAVE_FLAT, WAVE_MAX, WAVE_SEEDED, WAVE_SPIKY } from '@/storybook/fixtures';
import { AmbientWave } from './ambient-wave';

const meta = {
  title: 'Blocks/AmbientWave',
  component: AmbientWave,
  args: { points: WAVE_SEEDED, max: WAVE_MAX },
} satisfies Meta<typeof AmbientWave>;

export default meta;
type Story = StoryObj<typeof meta>;

// The wave has no size of its own — `preserveAspectRatio="none"` stretches it to
// whatever box it is given, which is how the popup can hand it a third of a
// card. The three shape stories share one box so their curves compare, and
// `text-primary` is what feeds `currentColor`.
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="text-primary" style={{ width: 380, height: 120 }}>
      {children}
    </div>
  );
}

/**
 * The popup's own opening frame — 44 samples of `PopupMock`'s seeded mulberry32
 * walk. The color comes from `currentColor` throughout, so the wave takes the
 * accent from whatever text color its parent sets. The left edge fades out under
 * a mask: the parent's buffer drops its oldest sample every tick, and an
 * unmasked cut would pop.
 */
export const Seeded: Story = {
  render: (args) => (
    <Frame>
      <AmbientWave {...args} className="h-full w-full" />
    </Frame>
  ),
};

/** An idle tunnel: identical samples, so the smoothing has nothing to smooth. */
export const Flat: Story = {
  ...Seeded,
  args: { points: WAVE_FLAT },
};

/**
 * Floor to ceiling on every sample. The path is Catmull-Rom at a tension of
 * 0.2, and this is the only input that shows how far its control points reach —
 * the peaks round over instead of coming to a point.
 */
export const Spiky: Story = {
  ...Seeded,
  args: { points: WAVE_SPIKY },
};

/**
 * How the popup mounts it: absolutely positioned across the bottom two thirds
 * of the status card at 15% opacity, behind the readout. The gradient fill
 * carries the glow, and the 1.5px non-scaling stroke keeps the crest legible at
 * that opacity.
 */
export const InCard: Story = {
  render: (args) => (
    <div style={{ width: 380 }}>
      <Card variant="elevated" padding="md" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 text-primary opacity-[0.15]">
          <AmbientWave {...args} className="h-full w-full" />
        </div>
        <Stack gap={4} style={{ position: 'relative' }}>
          <CardTitle>You are protected</CardTitle>
          <CardDescription>Amsterdam · via reality</CardDescription>
        </Stack>
      </Card>
    </div>
  ),
};
