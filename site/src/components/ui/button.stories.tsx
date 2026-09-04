import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight, Download, Github, Power, Trash2 } from 'lucide-react';
import { Row, Stack } from '@/storybook/layout';
import { Button } from './button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  argTypes: {
    // `asChild` needs a single React element child, which the controls panel
    // cannot supply — see the AsChildLink story instead.
    asChild: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/** All seven variants. `filled` is the default and carries the page's primary action. */
export const Variants: Story = {
  render: () => (
    <Row>
      <Button variant="filled">Get Noctis</Button>
      <Button variant="filled-tonal">How it works</Button>
      <Button variant="outlined">Read the license</Button>
      <Button variant="text">Skip</Button>
      <Button variant="elevated">Download the host</Button>
      <Button variant="destructive">Remove</Button>
      <Button variant="ghost">Dismiss</Button>
    </Row>
  ),
};

/**
 * The five size tiers. `s` is the default; `l` and `xl` are the marketing hero
 * sizes, which is why they dwarf the control tiers.
 */
export const Sizes: Story = {
  render: () => (
    <Stack>
      <Label>xs / s / m</Label>
      <Row>
        <Button size="xs">Extra small</Button>
        <Button size="s">Small</Button>
        <Button size="m">Medium</Button>
      </Row>
      <Label>l / xl</Label>
      <Row>
        <Button size="l">Large</Button>
        <Button size="xl">Extra large</Button>
      </Row>
    </Stack>
  ),
};

/**
 * `shape` swaps the pill for a rounded rectangle, and the radius it swaps to is
 * per size: `!rounded-md` at `xs` and `s`, `!rounded-lg` at `m`, `!rounded-2xl`
 * at `l`, `!rounded-3xl` at `xl`. All five tiers are here because each of those
 * is a compound variant of its own — the two hero sizes had no specimen while
 * carrying two of the five radii.
 */
export const Shapes: Story = {
  render: () => (
    <Stack>
      {(['round', 'square'] as const).map((shape) => (
        <Stack key={shape}>
          <Label>{shape}</Label>
          <Row>
            <Button shape={shape} size="xs">
              Extra small
            </Button>
            <Button shape={shape} size="s">
              Small
            </Button>
            <Button shape={shape} size="m">
              Medium
            </Button>
          </Row>
          <Row>
            <Button shape={shape} size="l">
              Large
            </Button>
            <Button shape={shape} size="xl">
              Extra large
            </Button>
          </Row>
        </Stack>
      ))}
    </Stack>
  ),
};

/** Icons are plain children; the variant sizes them through `[&_svg]:size-*`. */
export const WithIcon: Story = {
  render: () => (
    <Row>
      <Button variant="filled">
        <Download /> Install the extension
      </Button>
      <Button variant="outlined">
        <Github /> View source
      </Button>
      <Button variant="text">
        Continue <ArrowRight />
      </Button>
      <Button variant="destructive">
        <Trash2 /> Delete profile
      </Button>
    </Row>
  ),
};

/**
 * `asChild` hands the styling to the child element, so a call to action can be
 * a real anchor — crawlable, middle-clickable, and still a Button visually.
 */
export const AsChildLink: Story = {
  render: () => (
    <Row>
      <Button asChild size="m">
        <a href="/install/">Install Noctis</a>
      </Button>
      <Button asChild variant="outlined" size="m">
        <a href="/privacy/">
          Privacy <ArrowRight />
        </a>
      </Button>
    </Row>
  ),
};

/** Disabled uses one opacity token across the interactive family, plus no pointer events. */
export const Disabled: Story = {
  render: () => (
    <Row>
      <Button variant="filled" disabled>
        <Power /> Connect
      </Button>
      <Button variant="filled-tonal" disabled>
        Reconnect
      </Button>
      <Button variant="outlined" disabled>
        Details
      </Button>
      <Button variant="text" disabled>
        Cancel
      </Button>
      <Button variant="destructive" disabled>
        Remove
      </Button>
    </Row>
  ),
};

export const Playground: Story = {
  args: {
    variant: 'filled',
    size: 's',
    shape: 'round',
    disabled: false,
    children: 'Get Noctis',
  },
};
