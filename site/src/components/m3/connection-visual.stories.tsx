import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from '@/storybook/layout';
import { ConnectionVisual } from './connection-visual';

const meta = {
  title: 'M3/ConnectionVisual',
  component: ConnectionVisual,
  args: { state: 'connected', size: 132 },
  argTypes: {
    // Spelled out rather than left to docgen: the state is the whole point of
    // the Playground, and a radio makes the four cases one click apart.
    state: {
      control: 'inline-radio',
      options: ['idle', 'connecting', 'connected', 'error'],
    },
    size: { control: { type: 'range', min: 20, max: 240, step: 4 } },
  },
} satisfies Meta<typeof ConnectionVisual>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

function Case({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <Stack gap={8} align="center">
      {children}
      <Label>{caption}</Label>
    </Stack>
  );
}

/**
 * The four states. Each one sets its own core color and ring tempo: `idle` does
 * not pulse at all — a single ring breathes — while the other three stagger three
 * expanding rings a third of a period apart, fast for `connecting` and `error`,
 * slow for `connected`.
 */
export const States: Story = {
  render: (args) => (
    <Row gap={24} align="flex-start">
      <Case caption="idle">
        <ConnectionVisual {...args} state="idle" />
      </Case>
      <Case caption="connecting">
        <ConnectionVisual {...args} state="connecting" />
      </Case>
      <Case caption="connected">
        <ConnectionVisual {...args} state="connected" />
      </Case>
      <Case caption="error">
        <ConnectionVisual {...args} state="error" />
      </Case>
    </Row>
  ),
};

/**
 * `size` is a single number in px; the core, the rings and the power glyph are all
 * derived from it, so the proportions hold at any scale. 20px is the inline dot in
 * the home page's architecture diagram, 188px the component's own default.
 */
export const Sizes: Story = {
  render: (args) => (
    <Row gap={24} align="flex-end">
      <Case caption="20 — diagram dot">
        <ConnectionVisual {...args} size={20} />
      </Case>
      <Case caption="80">
        <ConnectionVisual {...args} size={80} />
      </Case>
      <Case caption="132">
        <ConnectionVisual {...args} size={132} />
      </Case>
      <Case caption="188 — default">
        <ConnectionVisual {...args} size={188} />
      </Case>
    </Row>
  ),
};

/** Flip `state` in the controls panel to watch the core color and ring tempo cross over. */
export const Playground: Story = {
  args: { state: 'connecting', size: 188 },
};
