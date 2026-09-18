import type { Meta, StoryObj } from '@storybook/react-vite';
import { HeroScene } from './hero-scene';

const meta = {
  title: 'Landing/HeroScene',
  component: HeroScene,
  parameters: { layout: 'centered' },
  args: {
    'aria-label':
      'A globe whose land is a grid of tiles, with waves gathering and packets crossing between them',
  },
} satisfies Meta<typeof HeroScene>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The planet, and the one thing it does: a wave of light converges on a single
 * tile, a packet leaves it along an arc over the surface, and from where that
 * packet lands another wave spreads out. Sixteen of those run at once, evenly
 * staggered, so two or three packets are in the air at any moment.
 *
 * A wave measures its distance through the land rather than across the sphere,
 * so it follows coastlines and stops at seas it cannot cross. The camera never
 * moves; the planet turns on its own tilted axis.
 */
export const Default: Story = {
  render: (args) => (
    <div className="h-[620px] w-[700px] max-w-full">
      <HeroScene {...args} />
    </div>
  ),
};

/** The phone gets the same planet in a smaller box; nothing is cropped away,
 *  the globe is simply fitted to the shorter side. */
export const Narrow: Story = {
  render: (args) => (
    <div className="h-[360px] w-[340px] max-w-full">
      <HeroScene {...args} />
    </div>
  ),
};

/**
 * Daylight is not a tint of the dark stage. The globe goes pale and the tiles
 * go *darker* than it, which is the opposite relationship, and the rims come
 * down to almost nothing: a coloured rim over white reads as a stain rather
 * than as light.
 */
export const Light: Story = {
  ...Default,
  globals: { theme: 'light' },
};
