import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from '@/storybook/layout';
import { Badge } from './badge';

// Mirrors the PROTOCOLS list in src/pages/home.tsx. The array is private to that
// page, so the copy is deliberate: the Protocols story is the place a change to
// the list — or to the chip styling — becomes visible without building the site.
const PROTOCOLS = [
  'VLESS',
  'VLESS Reality',
  'VMess',
  'Trojan',
  'Shadowsocks',
  'Hysteria/2',
  'TUIC',
  'WireGuard',
  'AnyTLS',
  'ShadowTLS',
  'SSH',
  'SOCKS5',
  'HTTP',
] as const;

const meta = {
  title: 'Primitives/Badge',
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * All eight variants. `default` is the neutral metadata chip; `success`,
 * `warning` and `destructive` carry the helper's three health states, and `mono`
 * is the tabular one for versions and identifiers.
 */
export const Variants: Story = {
  render: () => (
    <Row>
      <Badge variant="default">Chromium</Badge>
      <Badge variant="primary">sing-box</Badge>
      <Badge variant="outline">VLESS Reality</Badge>
      <Badge variant="success">Helper running</Badge>
      <Badge variant="info">Subscription</Badge>
      <Badge variant="warning">Helper outdated</Badge>
      <Badge variant="destructive">Helper missing</Badge>
      <Badge variant="mono">xtls-rprx-vision</Badge>
    </Row>
  ),
};

/** Two tiers, 20px and 24px tall. `md` is the default and the one the site ships. */
export const Sizes: Story = {
  render: () => (
    <Stack>
      <Label>sm</Label>
      <Row>
        <Badge variant="primary" size="sm">
          sing-box
        </Badge>
        <Badge variant="default" size="sm">
          Chromium
        </Badge>
        <Badge variant="mono" size="sm">
          reality
        </Badge>
      </Row>
      <Label>md</Label>
      <Row>
        <Badge variant="primary" size="md">
          sing-box
        </Badge>
        <Badge variant="default" size="md">
          Chromium
        </Badge>
        <Badge variant="mono" size="md">
          reality
        </Badge>
      </Row>
    </Stack>
  ),
};

/**
 * The "works with" strip on the home page: thirteen outlined, monospaced chips
 * in the order `pages/home.tsx` lists them. The markup — list element, classes
 * and all — is the page's, so the two can be compared line by line.
 */
export const Protocols: Story = {
  render: () => (
    <ul className="mt-3 flex flex-wrap gap-2">
      {PROTOCOLS.map((p) => (
        <li key={p}>
          <Badge variant="outline" size="md" className="font-mono">
            {p}
          </Badge>
        </li>
      ))}
    </ul>
  ),
};
