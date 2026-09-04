import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from '@/storybook/layout';
import { ServerMonogram } from './server-monogram';

const meta = {
  title: 'M3/ServerMonogram',
  component: ServerMonogram,
  args: { name: 'Frankfurt Edge' },
} satisfies Meta<typeof ServerMonogram>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/** One monogram over its input, since the input is what the output is derived from. */
function Case({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <Stack gap={6} align="center">
      {children}
      <Label>{caption}</Label>
    </Stack>
  );
}

/** Three sizes — 36px, 44px and 56px — each with its own radius and type scale. */
export const Sizes: Story = {
  render: (args) => (
    <Row gap={16}>
      <ServerMonogram {...args} size="sm" />
      <ServerMonogram {...args} size="md" />
      <ServerMonogram {...args} size="lg" />
    </Row>
  ),
};

/**
 * `squircle` clips to a superellipse instead of rounding the corners, and the
 * transition between the two is animated — the popup morphs the shape when a
 * server becomes the active one.
 */
export const Shapes: Story = {
  render: () => (
    <Stack>
      <Label>rounded</Label>
      <Row gap={16}>
        <ServerMonogram name="Frankfurt Edge" size="lg" shape="rounded" />
        <ServerMonogram name="Amsterdam Relay" size="lg" shape="rounded" />
        <ServerMonogram name="Singapore Gateway" size="lg" shape="rounded" />
      </Row>
      <Label>squircle</Label>
      <Row gap={16}>
        <ServerMonogram name="Frankfurt Edge" size="lg" shape="squircle" />
        <ServerMonogram name="Amsterdam Relay" size="lg" shape="squircle" />
        <ServerMonogram name="Singapore Gateway" size="lg" shape="squircle" />
      </Row>
    </Stack>
  ),
};

/**
 * The color is a hash of the name, not a stored field: the same server keeps its
 * hue across reloads and machines, and a list of servers comes out visually
 * distinct without anyone choosing colors. Lightness swaps with the theme, so
 * both ends stay legible.
 */
export const Palette: Story = {
  render: () => (
    <Row gap={16}>
      <Case caption="Frankfurt Edge">
        <ServerMonogram name="Frankfurt Edge" size="md" />
      </Case>
      <Case caption="Amsterdam Relay">
        <ServerMonogram name="Amsterdam Relay" size="md" />
      </Case>
      <Case caption="Singapore Gateway">
        <ServerMonogram name="Singapore Gateway" size="md" />
      </Case>
      <Case caption="Tokyo 01">
        <ServerMonogram name="Tokyo 01" size="md" />
      </Case>
      <Case caption="US West">
        <ServerMonogram name="US West" size="md" />
      </Case>
      <Case caption="sing-box">
        <ServerMonogram name="sing-box" size="md" />
      </Case>
    </Row>
  ),
};

/**
 * A leading emoji wins over the letters, so the flag people paste in front of a
 * server name becomes the avatar — the three servers in the site's popup mock are
 * all named this way. The grapheme is taken whole (a regional-indicator pair, a
 * ZWJ sequence, a variation selector), never split down the middle.
 */
export const Emoji: Story = {
  render: () => (
    <Row gap={16} align="flex-start">
      <Case caption="🇳🇱 Amsterdam">
        <ServerMonogram name="🇳🇱 Amsterdam" size="lg" />
      </Case>
      <Case caption="🇩🇪 Frankfurt">
        <ServerMonogram name="🇩🇪 Frankfurt" size="lg" />
      </Case>
      <Case caption="🇸🇬 Singapore">
        <ServerMonogram name="🇸🇬 Singapore" size="lg" />
      </Case>
      <Case caption="🇯🇵 Tokyo 01">
        <ServerMonogram name="🇯🇵 Tokyo 01" size="lg" />
      </Case>
      <Case caption="🏴‍☠️ Test node">
        <ServerMonogram name="🏴‍☠️ Test node" size="lg" />
      </Case>
    </Row>
  ),
};

/**
 * What a name with nothing to initialise falls back to. Two middle dots stand in
 * for an empty or letterless name; a one-character name pads to the same width, so
 * a column of monograms never goes ragged. Digits count as characters.
 */
export const EdgeCases: Story = {
  render: () => (
    <Row gap={16} align="flex-start">
      <Case caption='"" — empty'>
        <ServerMonogram name="" size="md" />
      </Case>
      <Case caption='"   " — whitespace'>
        <ServerMonogram name="   " size="md" />
      </Case>
      <Case caption='"A" — single char'>
        <ServerMonogram name="A" size="md" />
      </Case>
      <Case caption='"01" — digits'>
        <ServerMonogram name="01" size="md" />
      </Case>
      <Case caption='"443" — digits'>
        <ServerMonogram name="443" size="md" />
      </Case>
      <Case caption='"—" — no letters'>
        <ServerMonogram name="—" size="md" />
      </Case>
    </Row>
  ),
};
