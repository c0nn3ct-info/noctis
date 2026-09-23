import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { RoutingBand } from './routing-band';
import { t } from '@/i18n';

const meta = {
  title: 'Landing/RoutingBand',
  component: RoutingBand,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RoutingBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Seven requests, three lanes.
 *
 * A request sits in the lane it was sent down, and the lane is the answer —
 * there is no badge to read and no colour to decode twice. The lanes are
 * outlined rather than filled, so the table stays one table instead of three
 * standing side by side.
 *
 * Each mode tile carries the distribution it would produce: the bar is these
 * same seven requests sorted into lanes. Global is one colour, Direct is one
 * colour, by rules is three — the difference between the modes, drawn, before a
 * tile is chosen.
 *
 * "Matched by" belongs to the profile, so it collapses with the column when the
 * mode stops reading it. A column of dashes would be the page insisting that
 * Global consulted a rule.
 *
 * The verdicts are computed. `routing-scene.ts` carries the rules and a matcher
 * that takes its laws from the extension — an entry covers its domain and
 * everything under it, glob or not — so `api.openai.com` matches `openai.com`
 * and `ru.wikipedia.org` matches `wikipedia.*`. The colours are the product's
 * `dir-proxy`, `dir-direct` and `dir-block`.
 */
export const Default: Story = {};

/**
 * Global.
 *
 * The mode is the one thing above the profile, and this is what that means: no
 * rule decided anything, because none of them was read. Direct is the same
 * statement in the other direction.
 */
export const EveryRequestThroughTheTunnel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvasElement.querySelector('[data-mode="global"]') as HTMLElement);

    await expect(canvasElement.querySelectorAll('[data-cell="proxy"][data-hit]')).toHaveLength(7);
    await expect(canvas.getByText(t('home.routing.about_global'))).toBeInTheDocument();
  },
};
