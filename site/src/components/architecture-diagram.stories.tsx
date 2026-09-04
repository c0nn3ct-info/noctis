import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArchitectureDiagram } from './architecture-diagram';

const meta = {
  title: 'Blocks/ArchitectureDiagram',
  component: ArchitectureDiagram,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ArchitectureDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The four hops the extension actually takes, left to right, with the sandbox
 * boundary drawn between the extension and the helper — the one crossing that
 * needs native messaging. That connector is the only place the site mounts
 * `M3/ConnectionVisual`: `connected`, at 20px, so its pulse marks the hop that
 * carries the tunnel.
 *
 * `dir="ltr"` is pinned: the chain is a sequence of machines, not prose, so it
 * keeps its order in Arabic and Farsi. Every label still comes from the
 * dictionary-free English source — this diagram is not translated.
 */
export const Default: Story = {};

/**
 * Below `lg` the row becomes a column and each connector swaps its arrow: the
 * dashed boundary rule turns from a vertical rule between two cards into a
 * horizontal one across the gap, and `ArrowRight` gives way to `ArrowDown`.
 */
export const Stacked: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
