import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { LinkAnatomy } from './link-anatomy';
import { SAMPLE_LINK } from './share-link';
import { t } from '@/i18n';

const meta = {
  title: 'Landing/LinkAnatomy',
  component: LinkAnatomy,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LinkAnatomy>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A share link read out as a ledger: the field's name, a run of leader dots,
 * and the value it resolved to. The link sits in the field along the top and is
 * parsed on every keystroke.
 *
 * It is a real field rather than a picture of one because that is the band's
 * claim. "Every field is read locally" is a statement about where the work
 * happens, and a static list cannot make it — the same reasoning the aria2t
 * landing applies to its file picker and its rate limits.
 *
 * One column, so every name starts at one x and every value ends at another.
 * The leader is what ties the two rails together across the gap; in two columns
 * it was about three dots long, which is texture rather than the device a spec
 * sheet has used for a century.
 *
 * The raw slice each field was read out of used to sit between the two as a
 * chip. It repeated the link in the field above, and for five of the nine rows
 * its value was that same slice minus a delimiter — so the value column ran
 * four entries and five holes. The slice is in the field; the ledger carries
 * what it became.
 *
 * Four values are tinted: the fields that decide how the tunnel is built rather
 * than merely where it points. The uuid is elided rather than invented in full,
 * because a complete one reads as a credential someone might try.
 *
 * The panel claims its own caret and text selection. Both ship as the browser's
 * unless a palette takes them.
 */
export const Default: Story = {};

/**
 * Somebody else's link, pasted over the sample.
 *
 * A Trojan link with no Reality parameters comes apart into five fields instead
 * of nine, and the cells are the ones the string actually carries — this is the
 * parse, not a canned second state.
 */
export const PastedOver: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('trojan://pw@relay.example.org:8443?type=ws');

    await expect(canvas.getByText('@relay.example.org')).toBeInTheDocument();
    await expect(canvas.queryByText('cdn.example.com')).not.toBeInTheDocument();
    // And a way back to the example, now that there is something to go back to.
    await expect(canvas.getByRole('button', { name: t('home.anatomy.reset') })).toBeInTheDocument();
  },
};

/**
 * What it says when what it has is not a link. No cells, because there was
 * nothing to read — and the empty state names the schemes that do come apart,
 * rather than reporting an error about the one that did not.
 */
export const NotALink: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('my proxy please');

    await expect(canvas.getByText(t('home.anatomy.empty'))).toBeInTheDocument();
    await expect(canvas.queryByText(SAMPLE_LINK)).not.toBeInTheDocument();
  },
};
