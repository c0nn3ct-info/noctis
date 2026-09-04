import type { Meta, StoryObj } from '@storybook/react-vite';
import { HomePage } from './home';

/**
 * The landing page, whole.
 *
 * The import is `./home` rather than `src/entries/home.tsx` on purpose: the
 * entry calls `mountPage`, which starts Amplitude on idle. A page story would
 * then count a workshop visit as a page view every time someone opened it. The
 * page component itself is pure — it reads `t()` and renders — so the toolbar's
 * locale, theme and accent are the only inputs.
 */
const meta = {
  title: 'Pages/Home',
  component: HomePage,
  parameters: {
    // The page owns the whole viewport: `Layout` is `min-h-screen` with a
    // sticky header, and padding around it would misplace both.
    layout: 'fullscreen',
    // Autodocs is on project-wide, and this title carries two full pages. Left
    // inline they would run to several thousand pixels on one docs page, and
    // the sticky header would stick to the docs scroller rather than to the
    // page's own. One iframe each instead.
    docs: { story: { inline: false, iframeHeight: 900 } },
  },
} satisfies Meta<typeof HomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Wide layout: the hero splits into copy and a `BrowserMock` holding the live
 * `PopupMock`, and the popup keeps ticking — a new traffic sample scrolls into
 * the wave once a second, which is the state a visitor actually lands on.
 *
 * Below the hero: the protocol strip, the nine-item feature list inside a
 * `Section`, the architecture diagram, the ten-question FAQ as native
 * `<details>`, and a closing call to action. Every link the page points at is
 * locale-aware — `localePath('/install/')` becomes `/ru/install/` when the
 * toolbar switches to Russian.
 */
export const Default: Story = {};

/**
 * 320px wide, which is where the page's three responsive decisions land at
 * once: the `lg:` two-column hero collapses to one, the `BrowserMock` frame
 * drops out and the bare popup moves up between the headline and the lede, and
 * the header's four nav links disappear below `sm` so the 64px bar keeps the
 * lockup, the repository link and the language switcher — the footer carries
 * the same links for anyone who came here for them.
 */
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: {
    // 320×568; a taller frame than the viewport so the fold is visible rather
    // than being the bottom of the iframe.
    docs: { story: { inline: false, iframeHeight: 700 } },
  },
};
