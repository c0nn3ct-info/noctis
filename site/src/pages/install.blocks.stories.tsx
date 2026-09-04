import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { t } from '@/i18n';
import { withClipboardOutcome } from '@/storybook/clipboard';
import { CodeBlock, INSTALL_CORES, macosCmd } from './install';

// The page's own builder, on the page's own default selection, rather than a
// copy of the string: the install URL and the extension id live in one place
// and this story follows them.
const MACOS_CMD = macosCmd(INSTALL_CORES);

/**
 * Records what the stubbed clipboard was handed, for the Copied play below. The
 * play clears it first: the module can mount twice in one iframe (the docs page,
 * then the story page), and a second click that wrote nothing would otherwise
 * still be satisfied by the first mount's call.
 */
const writeText = fn();

const meta = {
  title: 'Blocks/Install/CodeBlock',
  component: CodeBlock,
  args: { children: MACOS_CMD, label: 'macOS' },
  decorators: [
    (Story) => (
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One install command with its copy button. The button sits in the flow rather
 * than floating over the text — as an overlay it covered the first line on
 * narrow screens — and the command wraps instead of scrolling, so the whole
 * thing stays readable without dragging.
 *
 * `dir="ltr"` on the `<pre>` is not optional: bidi reorders a shell command in
 * Arabic and Farsi (`$env:…` comes out as `env:…$`), which makes it wrong to
 * read even though copying it still works. Switch the toolbar to `fa` or `ar`
 * and the label and button follow while the command does not.
 *
 * `label` is what distinguishes one block's button from the next three on the
 * install page, so it goes into the accessible name rather than into a heading.
 */
export const Default: Story = {};

/**
 * After a successful copy: the icon flips to a check and both the name and the
 * tooltip switch to "Copied". The confirmation is deliberately short-lived —
 * `1600ms` and it flips back — so this story shows the frame right after the
 * click, not a resting state.
 *
 * The story installs its own `navigator.clipboard`: the real one rejects inside
 * a Storybook iframe unless the click counts as user activation for the top
 * document, so the success path would never be reachable here. The stub records
 * its payload, so the play asserts the command reached the clipboard as well as
 * the button reporting that it did — a copy button that flips to "Copied"
 * without copying anything would otherwise pass.
 */
export const Copied: Story = {
  decorators: [withClipboardOutcome('ok', writeText)],
  play: async ({ canvasElement }) => {
    writeText.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `${t('install.copy')}: macOS` }));

    await expect(writeText).toHaveBeenLastCalledWith(MACOS_CMD);
    const copied = await canvas.findByRole('button', {
      name: `${t('install.copied')}: macOS`,
    });
    await expect(copied).toHaveAttribute('title', t('install.copied'));
  },
};

/**
 * A blocked clipboard, which browsers do refuse on insecure origins, under some
 * permission policies, and inside cross-origin frames. This used to be a silent
 * dead end; now the block says so in the error color and the command stays
 * selectable either way.
 *
 * One `role="status"` node does both jobs — the confirmation nobody needs to see
 * and the failure everybody does — because two live regions would announce the
 * same event twice.
 */
export const CopyFailed: Story = {
  decorators: [withClipboardOutcome('fail')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `${t('install.copy')}: macOS` }));

    // The live region is in the DOM from the first render, empty; waiting on the
    // text rather than on the node is what proves the failure landed.
    await expect(await canvas.findByText(t('install.copy_failed'))).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: `${t('install.copied')}: macOS` }),
    ).toBeNull();
  },
};
