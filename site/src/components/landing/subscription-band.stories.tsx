import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SubscriptionBand } from './subscription-band';
import { t } from '@/i18n';

const meta = {
  title: 'Landing/SubscriptionBand',
  component: SubscriptionBand,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SubscriptionBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A subscription, its plan and the servers it brought.
 *
 * The provider's figures are a gauge rather than a bar across a card: the plan
 * is the column, what has been spent fills it from the bottom, and the legend
 * names the three parts — down, up, and what is left. A bar with a percentage
 * says how full the plan is; this says what it is made of, which is what the
 * provider actually reported.
 *
 * Both controls do the thing rather than mime it. Refresh re-reads the traffic
 * and probes every server again, and the figures travel to the new reading over
 * the time the request would plausibly take. Sort orders the servers by the
 * latency that just came back and slides the rows to their new places — the
 * same three rows, in a different order, which is what sorting is.
 *
 * The opening reading is fixed, because the page is prerendered and a random
 * figure in the first render is a hydration mismatch.
 */
export const Default: Story = {};

/**
 * A refresh landing.
 *
 * The icon turns once, the line under the name says it is working, and the
 * gauge and every latency travel to the reading that came back.
 */
export const Refreshed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: t('home.subs.refresh') }));

    await expect(canvas.getByText(t('home.subs.fetching'))).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText(t('home.subs.updated_now'))).toBeInTheDocument(), {
      timeout: 3000,
    });
  },
};

/**
 * Sorted by latency.
 *
 * The rows do not redraw: they move, each to the place its reading puts it.
 */
export const SortedByLatency: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: t('home.subs.sort') }));

    await expect(canvas.getByRole('button', { name: t('home.subs.sort') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};
