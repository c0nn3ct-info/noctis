import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Github, Languages, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { Row, Stack } from '@/storybook/layout';
import { IconButton } from './icon-button';

const meta = {
  title: 'Primitives/IconButton',
  component: IconButton,
  argTypes: {
    // `asChild` needs a single React element child, which the controls panel
    // cannot supply — see the site's GithubLink, which wraps a real anchor.
    asChild: { control: false },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * Four variants. `standard` is the default and the one the site's header and
 * copy buttons use; the other three add a container for rising emphasis.
 */
export const Variants: Story = {
  render: () => (
    <Row>
      <IconButton variant="filled" size="m" type="button" aria-label="Copy install command">
        <Copy aria-hidden />
      </IconButton>
      <IconButton variant="filled-tonal" size="m" type="button" aria-label="Re-ping servers">
        <RefreshCw aria-hidden />
      </IconButton>
      <IconButton variant="outlined" size="m" type="button" aria-label="Settings">
        <Settings aria-hidden />
      </IconButton>
      <IconButton variant="standard" size="m" type="button" aria-label="Change language">
        <Languages aria-hidden />
      </IconButton>
    </Row>
  ),
};

/**
 * Five sizes, 32px to 136px. `s` is the default and the header's; `xs` is the
 * inline copy button on the install page. `l` and `xl` are display sizes.
 */
export const Sizes: Story = {
  render: () => (
    <Stack>
      <Label>xs / s / m</Label>
      <Row>
        <IconButton variant="filled-tonal" size="xs" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled-tonal" size="s" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled-tonal" size="m" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
      </Row>
      <Label>l / xl</Label>
      <Row>
        <IconButton variant="filled-tonal" size="l" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled-tonal" size="xl" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
      </Row>
    </Stack>
  ),
};

/**
 * `round` is a pill at every size; `square` picks a radius per size through
 * compound variants, so the corner grows with the target.
 */
export const Shapes: Story = {
  render: () => (
    <Stack>
      <Label>round</Label>
      <Row>
        <IconButton variant="filled" shape="round" size="xs" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="round" size="s" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="round" size="m" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="round" size="l" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
      </Row>
      <Label>square</Label>
      <Row>
        <IconButton variant="filled" shape="square" size="xs" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="square" size="s" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="square" size="m" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
        <IconButton variant="filled" shape="square" size="l" type="button" aria-label="Copy">
          <Copy aria-hidden />
        </IconButton>
      </Row>
    </Stack>
  ),
};

/** Disabled across the four variants: one opacity token, no pointer events. */
export const Disabled: Story = {
  render: () => (
    <Row>
      <IconButton variant="filled" size="m" type="button" disabled aria-label="Copy">
        <Copy aria-hidden />
      </IconButton>
      <IconButton variant="filled-tonal" size="m" type="button" disabled aria-label="Re-ping">
        <RefreshCw aria-hidden />
      </IconButton>
      <IconButton variant="outlined" size="m" type="button" disabled aria-label="Remove server">
        <Trash2 aria-hidden />
      </IconButton>
      <IconButton variant="standard" size="m" type="button" disabled aria-label="GitHub">
        <Github aria-hidden />
      </IconButton>
    </Row>
  ),
};
