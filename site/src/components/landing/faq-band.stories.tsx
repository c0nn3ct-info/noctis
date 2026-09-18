import type { Meta, StoryObj } from '@storybook/react-vite';
import { FaqBand } from './faq-band';

const meta = {
  title: 'Landing/FaqBand',
  component: FaqBand,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FaqBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The closing band, built the way the aria2t landing page builds its own: the
 * ten questions this site already answers, set beside the two ways to ask an
 * eleventh.
 *
 * The rows are `Blocks/FaqList` in its `flush` frame — the same component and
 * the same strings the live home page shows boxed, so the two pages cannot
 * drift apart. Native `<details>`: every answer is in the prerendered HTML
 * whether or not it is open, and opening one costs no JavaScript. The flush
 * rows take the hover fill alone, because the press and focus fills linger on a
 * bare background and read as a selected band.
 *
 * Both contact links are labelled by where they go rather than by what they
 * are, and both stay `dir="ltr"`, so an address is not reordered around its @
 * in Arabic or Farsi.
 *
 * It carries the page's second call to action too. This band is the last thing
 * on the page, and a landing page whose final screen offers no way to install
 * is a page that stops rather than ends.
 */
export const Default: Story = {};

/** One column, as it lands below `lg`: the questions follow the framing. */
export const Stacked: Story = {
  render: (args) => (
    <div style={{ maxWidth: 560 }}>
      <FaqBand {...args} />
    </div>
  ),
};
