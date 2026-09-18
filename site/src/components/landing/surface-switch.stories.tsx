import type { Meta, StoryObj } from '@storybook/react-vite';
import { SurfaceSwitch } from './surface-switch';

const meta = {
  title: 'Landing/SurfaceSwitch',
  component: SurfaceSwitch,
  parameters: { layout: 'padded' },
  args: { value: 'extension' as const },
} satisfies Meta<typeof SurfaceSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Which interface the popup band demonstrates, ported from the aria2t site.
 *
 * A group of toggle buttons with `aria-pressed`, not a tablist: it swaps a
 * mock, not a panel, and it matches the extension's own Segmented control.
 *
 * The terminal client is real and in progress — `host/cmd/noctis` is the CLI
 * and TUI — but it has not shipped, so the switch shows it rather than offering
 * it. It carries `aria-disabled` rather than `disabled`, because a disabled
 * button drops out of the tab order and then the one thing worth knowing about
 * it, that it is coming, cannot be reached with a keyboard. The "soon" badge is
 * inside the label for the same reason: "Terminal" on its own would announce as
 * a surface you could pick.
 *
 * When the TUI ships, the `SOON` set empties and the band grows a second mock.
 */
export const Default: Story = {};

/**
 * Both toggles at 44px, hovering on colour alone. Nothing here changes shape
 * under the pointer — the page has no radius morph anywhere, which is the one
 * effect that read as a template when it did.
 */
export const Hovering: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-4">
      <SurfaceSwitch {...args} />
      <p className="text-body-small text-on-surface-variant">
        Hover either toggle: the unpressed one takes a fill, the unavailable one takes nothing.
      </p>
    </div>
  ),
};
