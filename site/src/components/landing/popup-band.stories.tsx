import type { Meta, StoryObj } from '@storybook/react-vite';
import { PopupBand } from './popup-band';

const meta = {
  title: 'Landing/PopupBand',
  component: PopupBand,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PopupBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The band that shows the product itself, modelled on the aria2t landing's
 * `SurfacesSection` — and the answer to the one thing that rework had lost: a
 * landing page for a browser extension that showed no browser extension.
 *
 * The mock is `Blocks/PopupMock` inside `Blocks/BrowserMock`, the same pair the
 * live home page uses, so this band and the rest of the site cannot drift apart
 * by a change to one of them. It is operable, not a screenshot: the server rows
 * respond, the traffic walks.
 *
 * The popup renders at its real 380px in both layouts, with no transform. The
 * window is 500 wide, so the popup nearly fills it — the proportion a visitor
 * sees on their own screen. Handing the frame the whole column would keep the
 * popup at 380 and still misreport its size, by making the browser enormous.
 * Below `sm` the frame is the wrong container altogether: wider than the
 * viewport, it would put the subject of the band off the right edge, so the
 * popup goes alone in a strip that scrolls sideways.
 *
 * No surface switch, unlike aria2t: noctis has one surface. The helper and the
 * engine have no interface of their own, which is the architecture band's job.
 */
export const Default: Story = {};
