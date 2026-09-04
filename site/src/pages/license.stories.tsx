import type { Meta, StoryObj } from '@storybook/react-vite';
import { LicensePage } from './license';

/**
 * The license page, whole.
 *
 * The import is `./license` rather than `src/entries/license.tsx`, which calls
 * `mountPage` and starts Amplitude on idle; a page story must not count a
 * workshop visit as a page view.
 */
const meta = {
  title: 'Pages/License',
  component: LicensePage,
  parameters: {
    // `Layout` is `min-h-screen` with a sticky header; padding around it would
    // misplace both.
    layout: 'fullscreen',
    // A long legal page, in its own iframe so the autodocs page stays
    // navigable and the sticky header sticks to the story's viewport.
    docs: { story: { inline: false, iframeHeight: 900 } },
  },
} satisfies Meta<typeof LicensePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The three-line summary of who owns what, then the EULA in full — grant,
 * restrictions, warranty, liability, termination, governing law — and two cards
 * that point the other way: the helper is open source in the repository, and
 * each bundled proxy engine keeps its own license.
 *
 * Every paragraph comes from the dictionary, so the whole document is
 * translated rather than being an English page with a translated shell. The
 * engine names and their license identifiers are not.
 */
export const Default: Story = {};
