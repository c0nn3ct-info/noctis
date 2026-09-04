import type { Meta, StoryObj } from '@storybook/react-vite';
import { PrivacyPage } from './privacy';

/**
 * The privacy policy, whole.
 *
 * The import is `./privacy` rather than `src/entries/privacy.tsx`, which calls
 * `mountPage` and starts Amplitude on idle — the one page on the site where
 * counting a workshop visit as a page view would be its own small irony.
 */
const meta = {
  title: 'Pages/Privacy',
  component: PrivacyPage,
  parameters: {
    // `Layout` is `min-h-screen` with a sticky header; padding around it would
    // misplace both.
    layout: 'fullscreen',
    // A long legal page, in its own iframe so the autodocs page stays
    // navigable and the sticky header sticks to the story's viewport.
    docs: { story: { inline: false, iframeHeight: 900 } },
  },
} satisfies Meta<typeof PrivacyPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Five `Section` blocks — what the extension stores, what crosses the network,
 * what is never collected, what this website itself collects, and the
 * permission table — then the children and contact cards and a closing note on
 * changes.
 *
 * The permission rows are the part that has to stay in step with the shipped
 * manifest: each Chrome permission is named verbatim beside the reason it is
 * requested, from the page's own const rather than from anything read out of
 * the extension, so a permission added there has to be added here too. The
 * names are monospace and `dir="ltr"` in every locale — bidi would reorder
 * `host_permissions: <all_urls>` — while the reasons follow the toolbar.
 */
export const Default: Story = {};
