import type { Meta, StoryObj } from '@storybook/react-vite';
import { EngineMatrix } from './engine-matrix';

const meta = {
  title: 'Landing/EngineMatrix',
  component: EngineMatrix,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EngineMatrix>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Which engine runs what, on both axes, under one set of columns.
 *
 * The default engine's column carries a ground from the header's radius to the
 * footer's, so one column is solid and two are perforated before a name is
 * read. A closed section states each engine's count in that engine's column —
 * 13/7/12 for the protocols, 5/6/5 for the transports — which is where the one
 * thing xray-core leads on becomes visible without expanding anything.
 *
 * Support is a shape and not a tone: a filled dot or a rule, each carrying its
 * own text for a screen reader.
 */
export const Default: Story = {};
