import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { t } from '@/i18n';
import { FaqSection } from './faq-section';

const meta = {
  title: 'Blocks/FaqSection',
  component: FaqSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FaqSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Ten questions in one hairline-divided card, every one of them a native
 * `<details>`: closed on first paint, no JavaScript involved in opening one,
 * and the answers are in the prerendered HTML whether or not they are on
 * screen. The chevron rotates off `group-open:`, so the marker and the state
 * can never fall out of step.
 *
 * Both the questions and the answers come from the dictionary — switch the
 * locale in the toolbar and the whole section follows, right-to-left included.
 */
export const Default: Story = {};

/**
 * The first answer, opened the way a reader opens it. `toBeVisible` is what
 * proves the point: a closed `<details>` keeps its answer in the DOM, so only
 * visibility distinguishes the two states.
 */
export const FirstOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const answer = canvas.getByText(t('home.faq.what.a'));
    // The control is the whole `<summary>`, not the `<span>` that holds the
    // question — hence `closest`: the chevron and the padding are part of the
    // hit area a reader aims at.
    const summary = canvas.getByText(t('home.faq.what.q')).closest('summary')!;

    await expect(answer).not.toBeVisible();
    await userEvent.click(summary);
    await expect(answer).toBeVisible();
  },
};
