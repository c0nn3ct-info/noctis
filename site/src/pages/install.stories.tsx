import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { t } from '@/i18n';
import { withClipboardOutcome } from '@/storybook/clipboard';
import { InstallPage, INSTALL_CORES, macosCmd } from './install';

/**
 * The install page, whole: the three numbered steps, the engine picker that
 * rewrites all three one-liners, and the troubleshooting hand-off.
 *
 * The import is `./install` rather than `src/entries/install.tsx`, which calls
 * `mountPage` and starts Amplitude on idle — a page story must not count a
 * workshop visit as a page view. `CodeBlock` and `CoreMultiSelect` have their
 * own entries under `Blocks/Install`; the stories here exercise them where they
 * actually live, through the page's own state.
 */
const meta = {
  title: 'Pages/Install',
  component: InstallPage,
  parameters: {
    // `Layout` is `min-h-screen` with a sticky header; padding around it would
    // misplace both.
    layout: 'fullscreen',
    // One iframe per story on the docs page. Four full pages inline would run
    // to several thousand pixels, the two clipboard stories would fight over
    // one `navigator.clipboard`, and `CoreMultiSelect`'s ids are fixed
    // (`aria-labelledby="cores-label cores-value"`) — four copies in one
    // document and every trigger would borrow the first story's heading.
    docs: { story: { inline: false, iframeHeight: 1000 } },
  },
} satisfies Meta<typeof InstallPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The engine picker's trigger. Its accessible name is assembled by
 * `aria-labelledby` from the heading and the current selection, so it moves
 * with both the locale and every toggle; matching on the labelling
 * relationship instead keeps the play below working in all six dictionaries.
 */
function coresTrigger(canvas: ReturnType<typeof within>): HTMLElement {
  return canvas.getByRole('button', {
    name: (_name: string, element: Element) =>
      element.getAttribute('aria-labelledby') === 'cores-label cores-value',
  });
}

/**
 * The state the page loads in: all three engines selected, which is the
 * installer's own default, so every command is the bare one-liner with no cores
 * argument at all.
 *
 * `dir="ltr"` on each `<pre>` is what keeps that readable in the RTL locales —
 * switch the toolbar to Farsi or Arabic and the page mirrors while the commands
 * do not.
 */
export const Default: Story = {};

/**
 * One engine dropped, which is the only way a cores argument appears: the play
 * opens the picker, unchecks `xray` and closes the menu with Escape, and all
 * three commands pick up `sing-box,mihomo` — the canonical order, not the click
 * order.
 *
 * Escape rather than a click outside: `onSelect` is prevented so the menu stays
 * open for a second pick, which is what a multi-select needs and what makes the
 * keyboard the way out.
 */
export const CoresPartiallySelected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(coresTrigger(canvas));

    // Radix portals the menu to the end of `<body>`, outside the canvas.
    const overlay = within(canvasElement.ownerDocument.body);
    const xray = await overlay.findByRole('menuitemcheckbox', { name: 'xray' });
    await userEvent.click(xray);
    await expect(xray).toHaveAttribute('aria-checked', 'false');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(overlay.queryByRole('menu')).toBeNull());

    await expect(canvas.getByText('sing-box, mihomo')).toBeVisible();
    await expect(canvas.getAllByText(/sing-box,mihomo/, { selector: 'code' })).toHaveLength(3);
  },
};

/**
 * Records what the stubbed clipboard was handed, for the Copied play below. The
 * play clears it first: the module can mount twice in one iframe (the docs page,
 * then the story page), and a second click that wrote nothing would otherwise
 * still be satisfied by the first mount's call.
 */
const writeText = fn();

/**
 * A copy that landed. The icon flips to a check and both the accessible name
 * and the tooltip switch to "Copied" — for `1600ms`, then back, so this is the
 * frame right after the click rather than a resting state. Only the block that
 * was clicked flips; the other two stay as they were.
 *
 * The story installs its own `navigator.clipboard`: the real one rejects inside
 * a Storybook iframe unless the click counts as user activation for the top
 * document, so the success path is not otherwise reachable here. The stub
 * records its payload, and the play asserts that payload is the macOS command
 * the page is showing — a button that flips to "Copied" while copying nothing,
 * or copying the Linux block, would otherwise pass.
 */
export const Copied: Story = {
  decorators: [withClipboardOutcome('ok', writeText)],
  play: async ({ canvasElement }) => {
    writeText.mockClear();
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `${t('install.copy')}: macOS` }));

    // The page loads with every engine selected, which is the installer's own
    // default, so the command carries no cores argument.
    await expect(writeText).toHaveBeenLastCalledWith(macosCmd(INSTALL_CORES));
    await expect(
      await canvas.findByRole('button', { name: `${t('install.copied')}: macOS` }),
    ).toHaveAttribute('title', t('install.copied'));
    // The two untouched blocks still offer to copy. By title rather than by
    // accessible name: the name carries the platform suffix, and a name pattern
    // built from a translated string would have to be escaped first.
    await expect(canvas.getAllByTitle(t('install.copy'))).toHaveLength(2);
  },
};

/**
 * A blocked clipboard, which browsers do refuse on insecure origins, under some
 * permission policies and inside cross-origin frames. This used to be a silent
 * dead end; the block now says so in the error color under the command it
 * failed on, and the command stays selectable either way.
 *
 * Each block owns one `role="status"` node, empty until its own copy succeeds
 * or fails, so a screen reader hears the outcome once rather than three times.
 */
export const CopyFailed: Story = {
  decorators: [withClipboardOutcome('fail')],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: `${t('install.copy')}: Linux` }));

    // The live region is in the DOM from the first render, empty; waiting on the
    // text rather than on the node is what proves the failure landed.
    await expect(await canvas.findByText(t('install.copy_failed'))).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: `${t('install.copied')}: Linux` }),
    ).toBeNull();
  },
};
