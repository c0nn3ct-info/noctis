import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomePage } from './home';

/**
 * The landing page, whole.
 *
 * Seven bands under a hero: the product itself, the protocols, a link taken
 * apart, nine capabilities, the architecture and the FAQ that closes the page.
 *
 * The import is `./home` rather than `src/entries/home.tsx` on purpose: the
 * entry calls `mountPage`, which starts Amplitude on idle, and a page story
 * would then count a workshop visit as a page view every time someone opened
 * it. The page itself only reads `t()` and renders — except the two places
 * that hold state, both of which are the point: the popup mock can be
 * operated, and the anatomy panel parses whatever you paste into it.
 */
const meta = {
  title: 'Pages/Home',
  component: HomePage,
  parameters: {
    // The page owns the whole viewport: `Layout` is `min-h-screen` with a
    // sticky header, and padding around it would misplace both.
    layout: 'fullscreen',
    // Several thousand pixels of page; inline it would run away with the docs
    // scroller and steal the sticky header from its own.
    docs: { story: { inline: false, iframeHeight: 900 } },
  },
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
