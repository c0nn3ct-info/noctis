import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CoreMultiSelect } from './install';

const meta = {
  title: 'Blocks/Install/CoreMultiSelect',
  component: CoreMultiSelect,
  parameters: {
    // Two reasons for one iframe per story on the docs page. The menu renders
    // through a Radix portal at the end of `<body>`, so an opened one would
    // land outside its own docs block; and the trigger's accessible name comes
    // from `aria-labelledby="cores-label cores-value"`, whose ids are fixed —
    // three of these inline on one page and every trigger would borrow the
    // first story's heading and summary.
    docs: { story: { inline: false, iframeHeight: 320 } },
  },
  args: {
    // A literal, not `t('install.step2.cores_label')`: the heading is the
    // caller's string, and story args are evaluated once when this module
    // loads, so a dictionary lookup here would freeze whichever locale happened
    // to be active then. The install page passes the translated label; this
    // story documents the prop.
    label: 'Cores to install (all by default):',
    // Controlled component: the page owns the selection, so each story shows
    // one fixed state and records the toggles instead of applying them. Watch
    // the Actions panel — clicking an item logs `onToggle` and the menu stays
    // open, because `onSelect` is prevented so a multi-select does not close on
    // the first pick.
    onToggle: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CoreMultiSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The install page's default. All three engines selected means "install
 * everything", which is the installer's own default too — so the command the
 * page generates from this state carries no cores argument at all.
 */
export const All: Story = {
  args: { selected: ['sing-box', 'xray', 'mihomo'] },
};

/**
 * A narrowed selection, and deliberately not a contiguous one: the trigger's
 * summary is built by filtering the canonical `sing-box, xray, mihomo` order
 * rather than by joining the click order, so it reads `sing-box, mihomo`
 * however the two were picked.
 */
export const Partial: Story = {
  args: { selected: ['sing-box', 'mihomo'] },
};

/**
 * One engine — the shortest download, and the narrowest trigger. The summary
 * and the chevron hold their own ends of the row rather than centring, which is
 * only visible once the text stops filling the width.
 */
export const Single: Story = {
  args: { selected: ['sing-box'] },
};
