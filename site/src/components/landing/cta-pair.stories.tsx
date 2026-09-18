import type { Meta, StoryObj } from '@storybook/react-vite';
import { CtaPair, InstallButton } from './cta-pair';

const meta = {
  title: 'Landing/CtaPair',
  component: CtaPair,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CtaPair>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The page's one call to action, used in the hero and again under the closing
 * steps.
 *
 * The store comes first and the guide second — the opposite of the live landing
 * page. Installing is the shorter path for most readers, and the guide is what
 * the extension itself hands you when it finds no helper, so leading with it
 * asked people to read a manual before they had anything to run.
 *
 * Both are `Button size="s"`, which is what the aria2t landing uses for every
 * button it has and what the live noctis home page uses too. The 56px `m` tier
 * this replaced came from the design file, and it made the CTA the loudest
 * thing on a page whose subject is the product beside it.
 */
export const Default: Story = {};

/**
 * The Install half on its own, run across its column. The FAQ band closes on
 * this: the store is already reachable from the header, the footer and the
 * hero, and a second button there made the last row a choice rather than a
 * next step.
 */
export const InstallOnly: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <InstallButton block />
    </div>
  ),
};
