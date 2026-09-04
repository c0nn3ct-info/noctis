import type { Meta, StoryObj } from '@storybook/react-vite';
import { PopupMock } from '@/components/popup-mock';
import { BrowserMock } from './browser-mock';

const meta = {
  title: 'Blocks/BrowserMock',
  component: BrowserMock,
  parameters: {
    // A 620px viewport under a toolbar; the centered layout would clip it.
    layout: 'padded',
  },
  // The frame takes its width from the parent, and below ~700px the popup it
  // anchors runs off the right edge. The landing page gives it the full column.
  decorators: [
    (Story) => (
      <div style={{ width: 880 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrowserMock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The chrome on its own: traffic lights, a locked address bar, the extension
 * tile with its connected dot, and a wallpapered viewport standing in for a
 * page. `dir="ltr"` is pinned on the frame — a browser window does not mirror
 * in Arabic or Farsi even when the page around it does.
 *
 * The children slot is anchored under the toolbar rather than filling the
 * viewport, so whatever goes in it reads as a popup hanging off the tile.
 */
export const Empty: Story = {
  args: {
    children: (
      <div
        className="rounded-lg border border-outline-variant bg-surface-container p-4 text-body-small text-on-surface-variant"
        style={{ width: 240 }}
      >
        Popup slot
      </div>
    ),
  },
};

/**
 * The pairing the landing page ships, with the popup paused here so the frame
 * renders the same on every reload — the page itself lets it tick. The arrow
 * above the popup belongs to the frame, not to the popup.
 */
export const WithPopup: Story = {
  args: { children: <PopupMock paused /> },
};
