import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { EngineReach } from './engine-reach';
import { t } from '@/i18n';

const meta = {
  title: 'Landing/EngineReach',
  component: EngineReach,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EngineReach>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The three engines, and what each one reaches.
 *
 * It replaced a table of twenty-two rows by three columns of dots — sixty-six
 * marks, of which the nine in the security section said only that the three
 * engines agree. The same twenty-two capabilities are here, grouped by the one
 * thing that varies: who runs them. Fifteen are run by all three and take one
 * line; the seven that are not take the rest.
 *
 * One tile is chosen and it grows to two and a bit times the others, which is
 * where its sentence fits. Three tiles of equal size ask the visitor to choose
 * an engine, and that is the wrong question — one is already running and the
 * others are there for the servers it cannot drive, so sing-box opens chosen.
 *
 * The figure is the whole list, not a column of one axis: 21 of 22, 16 of 22,
 * 20 of 22. The sentence under it is what keeps those from reading as a
 * ranking — xray-core reaches sixteen and is the only engine on the page that
 * can build xhttp.
 */
export const Default: Story = {};

/**
 * xray-core in the tile.
 *
 * The groups do not move: what changes is the answer each chip gives. xhttp
 * becomes the one capability this engine has to itself, ShadowTLS and the QUIC
 * family go struck and dashed, and the heading of the group xray-core is not in
 * goes quiet.
 */
export const AnotherEngine: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /xray-core/ }));

    await expect(canvasElement.querySelector('[data-capability="xhttp"]')).toHaveAttribute(
      'data-state',
      'only',
    );
    await expect(canvasElement.querySelector('[data-capability="ShadowTLS"]')).toHaveAttribute(
      'data-state',
      'out',
    );
    await expect(canvas.getByText(t('home.engines.about.xray'))).toBeInTheDocument();
  },
};
