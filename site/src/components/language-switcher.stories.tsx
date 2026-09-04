import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { t } from '@/i18n';
import { LanguageSwitcher } from './language-switcher';

const meta = {
  title: 'Blocks/LanguageSwitcher',
  component: LanguageSwitcher,
  parameters: {
    // The menu is absolutely positioned under the trigger. Autodocs is on for
    // every story here, and inline the open menu would spill out of its docs
    // block over whatever follows it, so each story gets its own iframe with
    // room underneath.
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The header's resting state: one icon button, `aria-expanded="false"`, and
 * nothing else in the DOM. The menu is built on click, which is why the layout
 * also renders the same six languages as plain links in the footer — the
 * prerendered HTML would otherwise carry no path between the locales at all.
 */
export const Closed: Story = {};

/**
 * Open, with the current locale marked by `aria-current` and a heavier weight.
 * Switch locale in the toolbar and the checked row moves with it.
 *
 * The hrefs are real, and they are built from `window.location.pathname` — in
 * here that is Storybook's own `/iframe.html`, so they come out as
 * `/ru/iframe.html` and the like rather than as site URLs. On the site the same
 * code pairs the current page with its translation.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: t('nav.lang_switch_aria') });

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getAllByRole('menuitem')).toHaveLength(6);
  },
};
