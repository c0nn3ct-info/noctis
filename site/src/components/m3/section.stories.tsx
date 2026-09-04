import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Download, FileText, Palette, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Row, Stack } from '@/storybook/layout';
import { Section, SectionLink } from './section';

// Shortened from the feature list on the home page; the point here is the
// container, so the bodies stop at one line each.
const FEATURES = [
  {
    title: 'Pluggable proxy engine',
    body: 'Ships sing-box, and can also drive xray-core or mihomo.',
  },
  {
    title: 'Per-rule routing',
    body: 'Match by domain, GeoSite or GeoIP; route to proxy, direct or block.',
  },
  {
    title: 'Health checks and automatic failover',
    body: 'Background latency probes drop failing servers from the active route.',
  },
] as const;

/** The home page's feature rows, the standard body for a Section on the site. */
function FeatureList() {
  return (
    <Stack gap={8} style={{ padding: '4px 8px 8px' }}>
      {FEATURES.map((f) => (
        <Row key={f.title} gap={12} align="flex-start">
          <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="text-title-small">{f.title}</div>
            <div className="text-body-medium text-on-surface-variant">{f.body}</div>
          </div>
        </Row>
      ))}
    </Stack>
  );
}

const meta = {
  title: 'M3/Section',
  component: Section,
  args: {
    header: 'What you get',
    icon: Check,
    children: <FeatureList />,
  },
  // A Section is a full-width block on the site and a fixed-width panel in the
  // extension; 380px is the popup width, which is where the truncating heading
  // levels were tuned.
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * The level belongs to the caller, and it changes more than the tag: level 2 is
 * a document heading (larger type, balanced wrapping, top-aligned row), levels 3
 * and 4 stay the compact panel subsection the extension is built around.
 */
export const HeadingLevels: Story = {
  render: (args) => (
    <Stack>
      <Label>headingLevel=2 — document section, title-large</Label>
      <Section {...args} headingLevel={2} header="2. Run the helper installer" />
      <Label>headingLevel=3 — default panel subsection, title-medium</Label>
      <Section {...args} headingLevel={3} header="2. Run the helper installer" />
      <Label>headingLevel=4 — nested subsection, title-medium</Label>
      <Section {...args} headingLevel={4} header="2. Run the helper installer" />
    </Stack>
  ),
};

/** `count` adds a tonal pill after the heading — the home page passes the feature total. */
export const WithCount: Story = {
  args: { count: 9 },
};

/** `action` takes any node and sits at the far end of the header row, never shrinking. */
export const WithAction: Story = {
  args: {
    header: 'Servers',
    count: 12,
    action: (
      <IconButton variant="standard" size="xs" type="button" aria-label="Re-ping servers">
        <RefreshCw aria-hidden />
      </IconButton>
    ),
  },
};

/**
 * Where the two heading modes part ways. At level 2 the title wraps and balances,
 * and the icon rises to the first line; at level 3 it truncates, because a panel
 * row is always one line. The license page's EULA heading is the case that forced
 * the split — it lost most of its title in the longer locales.
 */
export const LongTitle: Story = {
  render: (args) => (
    <Stack>
      <Label>headingLevel=2 — wraps, balanced, icon top-aligned</Label>
      <Section
        {...args}
        headingLevel={2}
        icon={FileText}
        header="1. Noctis extension — End-User License Agreement"
      />
      <Label>headingLevel=3 — truncates</Label>
      <Section
        {...args}
        headingLevel={3}
        icon={FileText}
        header="1. Noctis extension — End-User License Agreement"
      />
      <Label>headingLevel=2 with a count</Label>
      <Section
        {...args}
        headingLevel={2}
        icon={ShieldCheck}
        header="Permissions Noctis requests, and why"
        count={9}
      />
    </Stack>
  ),
};

/**
 * `SectionLink` is the Section's flat sibling: the same tonal icon and container,
 * but the whole row is one button with a trailing chevron that mirrors under RTL.
 * `supporting` is optional, and both lines truncate.
 */
export const Links: Story = {
  render: () => (
    <Stack gap={8}>
      <SectionLink
        title="Appearance"
        icon={Palette}
        supporting="Theme, accent color, language"
        onClick={() => {}}
      />
      <SectionLink
        title="Run the helper installer"
        icon={Download}
        supporting="One line for macOS, Linux or Windows"
        onClick={() => {}}
      />
      <SectionLink
        title="Per-rule routing"
        icon={Route}
        supporting="Match by domain, GeoSite or GeoIP — a supporting line long enough to truncate"
        onClick={() => {}}
      />
      <SectionLink title="License" icon={FileText} onClick={() => {}} />
    </Stack>
  ),
};
