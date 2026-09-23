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
 * A share link taken apart into an entry per field, with the engine those
 * fields ask for on a rail beside them. The link sits in the field along the
 * top and is parsed on every keystroke.
 *
 * It is a real field rather than a picture of one because that is the band's
 * claim. "Every field is read locally" is a statement about where the work
 * happens, and a static list cannot make it — the same reasoning the aria2t
 * landing applies to its file picker and its rate limits.
 *
 * Six drafts stand behind this one: nine rows at one weight, a leadered ledger
 * of four, four tiles with the rest behind a count, all nine as tiles, four
 * tiles over a line of the rest, and a numbered listing with comments. Every
 * one was an inventory. They told a visitor what the link contains and none of
 * them said what any of it means.
 *
 * Here a field is an entry of three lines — its name, its value, what it is
 * for — so it reads as one unit instead of a row to read across.
 * `cdn.example.com` is a string until something says it is the site the
 * handshake claims to visit.
 *
 * Nothing is marked until the pointer asks. An entry lights its own slice of
 * the link, a slice of the link lights its entry, and the rail lights all four
 * deciding fields at once. The band walked the fields on a timer for a while;
 * it made the point that the two halves are one object with nobody pointing at
 * anything, and it cost a mark moving in the corner of the eye for as long as
 * the band was on screen.
 *
 * An `<input>` paints one colour, so the slices are a copy of the string lying
 * exactly under the caret and scrolled with it; the input's own text is
 * transparent, and the mark is grown by a ring rather than by padding, which
 * would move every glyph after it. That copy cannot take events either — the
 * input has to keep every click — so pointing at the link is arithmetic: a
 * monospaced face makes one character's advance the line's width over its
 * length, and `fieldAt` reads the column back to a field.
 *
 * The rail holds the answer: which engine starts, what the other two can do
 * with this link, and the fields that decided it — read off the link rather
 * than written out, so a link with no security parameter names three. Pointing
 * at the rail lights exactly those fields. `engine-pick.ts` reads the verdict
 * off the same two tables the engine matrix draws, so a link and the grid
 * cannot disagree about what runs where.
 */
export const Default: Story = {};

/**
 * One entry under the pointer.
 *
 * The entry takes a ground, its value is marked, and the same field lights up
 * in the link above it. Three marks, one piece of state: that is what makes the
 * field and the entries one object instead of a control and a table.
 */
export const EntryUnderThePointer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sni = canvasElement.querySelectorAll('[data-field]')[5] as HTMLElement;

    await userEvent.hover(sni);

    await expect(sni).toHaveAttribute('data-state', 'active');
    await expect(canvasElement.querySelectorAll('[data-slice][data-state="active"]')).toHaveLength(
      1,
    );
    await expect(canvas.getByText(t('home.anatomy.note.sni'), { exact: false })).toBeInTheDocument();
  },
};

/**
 * The rail under the pointer.
 *
 * It lights the four fields it names in its own foot — protocol, host, security
 * and transport — in the link and in their entries at once. The grounds stay
 * where the pointer is: four filled cells would read as a selection rather than
 * as an answer.
 */
export const RailUnderThePointer: Story = {
  play: async ({ canvasElement }) => {
    const rail = canvasElement.querySelector('[data-rail]') as HTMLElement;

    await userEvent.hover(rail);

    await expect(canvasElement.querySelectorAll('[data-slice][data-state="active"]')).toHaveLength(
      4,
    );
    await expect(rail).toHaveTextContent('protocol · host · security · transport');
  },
};

/**
 * Somebody else's link, pasted over the sample.
 *
 * A Trojan link with no Reality parameters comes apart into fewer fields, and
 * the cells are the ones the string actually carries — this is the parse, not a
 * canned second state. Every engine runs Trojan over ws, so the foot still
 * starts sing-box.
 */
export const PastedOver: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('trojan://pw@relay.example.org:8443?type=ws');

    await expect(canvas.getByText('relay.example.org')).toBeInTheDocument();
    await expect(canvas.queryByText('cdn.example.com')).not.toBeInTheDocument();
    // And a way back to the example, now that there is something to go back to.
    await expect(canvas.getByRole('button', { name: t('home.anatomy.reset') })).toBeInTheDocument();
  },
};

/**
 * The one transport that settles the question on its own: xhttp is xray-core's
 * alone, so a link asking for it leaves one chip standing and the caption says
 * which row decided.
 */
export const OneEngineOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('vless://d1f4...8c2a@ams.example.net:443?type=xhttp');

    await expect(
      canvas.getByText(
        t('home.anatomy.engine_only').replace('{engine}', 'xray-core').replace('{what}', 'xhttp'),
      ),
    ).toBeInTheDocument();
  },
};

/**
 * The other direction: Hysteria2 is sing-box and mihomo, and the foot names the
 * engine it rules out rather than only the two it leaves. A visitor holding
 * this link wants their line of the matrix, not the grid.
 */
export const RulesOneOut: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('hysteria2://d1f4...8c2a@ams.example.net:443');

    await expect(
      canvas.getByText(
        t('home.anatomy.engine_without')
          .replace('{what}', 'Hysteria2')
          .replace('{engine}', 'xray-core'),
      ),
    ).toBeInTheDocument();
  },
};

/**
 * Both rows narrow, and nothing is left: Hysteria2 asks for an engine xhttp
 * does not have. The panel says so in the two terms that refused it rather than
 * falling back on an engine that cannot run the link.
 */
export const NothingRunsIt: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole('textbox', { name: t('home.anatomy.input_aria') });

    await userEvent.clear(field);
    await userEvent.paste('hysteria2://d1f4...8c2a@ams.example.net:443?type=xhttp');

    await expect(
      canvas.getByText(
        t('home.anatomy.engine_none').replace('{other}', 'Hysteria2').replace('{what}', 'xhttp'),
      ),
    ).toBeInTheDocument();
  },
};

/**
 * What it says when what it has is not a link. No cells and no verdict, because
 * there was nothing to read — and the empty state names the schemes that do
 * come apart, rather than reporting an error about the one that did not.
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
