import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityLanes } from './capability-lanes';

const meta = {
  title: 'Landing/CapabilityLanes',
  component: CapabilityLanes,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CapabilityLanes>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Nine capabilities on three drifting lanes — routing, then setup, then scope.
 * The middle lane runs the other way and all three have different periods,
 * which is what stops them reading as one block sliding sideways.
 *
 * Each lane holds its three cards three times over: a third of the track's
 * width is one loop, which is exactly what `lane-drift` translates by, so the
 * seam never shows. Only the first copy is real — the other two are
 * `aria-hidden`, so a screen reader hears nine capabilities rather than
 * twenty-seven.
 *
 * When the reader has asked for less motion the duplicates are dropped
 * outright, the track unwraps into rows, and the fade at both edges lifts. A
 * still lane behind a mask is not a calm lane; it is content that has been cut
 * off with no way to reach it.
 */
export const Default: Story = {};
