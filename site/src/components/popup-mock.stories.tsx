import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrowserMock } from '@/components/browser-mock';
import { PopupMock } from './popup-mock';

const meta = {
  title: 'Blocks/PopupMock',
  component: PopupMock,
  parameters: {
    // 560px tall at minimum, so the centered layout would clip it.
    layout: 'padded',
  },
} satisfies Meta<typeof PopupMock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The landing page's hero mock, ticking. A new traffic sample scrolls in once a
 * second: the ↓/↑ readout and the ambient wave behind the status card read from
 * one rolling buffer, so they can never disagree.
 */
export const Default: Story = {};

/**
 * `paused` drops the interval, which leaves the seeded mulberry32 opening frame
 * on screen. Same render every time — the state to reach for in a snapshot, a
 * store capture, or anywhere a moving number would be noise.
 */
export const Static: Story = {
  args: { paused: true },
};

/**
 * How the site actually ships it: `BrowserMock` anchors the popup under a
 * toolbar, arrow and all. Paused, because the frame is the point here rather
 * than the traffic.
 */
export const InBrowser: Story = {
  render: (args) => (
    <div style={{ width: 880 }}>
      <BrowserMock>
        <PopupMock {...args} />
      </BrowserMock>
    </div>
  ),
  args: { paused: true },
};

/**
 * The popup's own width is 380px, and `className` merges through `twMerge`, so
 * a caller's width wins over the default — which is how the landing page fits
 * it into a narrow column with `w-full max-w-[380px]`. At 320px the truncating
 * server rows, the three-segment routing switcher and the footer's button pair
 * are what give first.
 */
export const Narrow: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <PopupMock {...args} className="w-full max-w-[380px]" />
    </div>
  ),
  args: { paused: true },
};
