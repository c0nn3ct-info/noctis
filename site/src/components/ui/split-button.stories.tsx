import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Plus } from 'lucide-react';
import { Row, Stack } from '@/storybook/layout';
import { SplitButton, SplitButtonAction, SplitButtonCaret } from './split-button';

const meta = {
  title: 'Primitives/SplitButton',
  component: SplitButton,
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * Four variants. The container passes variant and size to both segments through
 * context, so the two halves can never disagree — only the outer element is
 * configured.
 */
export const Variants: Story = {
  render: () => (
    <Stack>
      <Label>filled / filled-tonal</Label>
      <Row gap={16}>
        <SplitButton variant="filled" size="s">
          <SplitButtonAction>
            <Plus aria-hidden />
            Add server
          </SplitButtonAction>
          <SplitButtonCaret aria-label="More add options" />
        </SplitButton>
        <SplitButton variant="filled-tonal" size="s">
          <SplitButtonAction>
            <Plus aria-hidden />
            Add server
          </SplitButtonAction>
          <SplitButtonCaret aria-label="More add options" />
        </SplitButton>
      </Row>
      <Label>elevated / outlined</Label>
      <Row gap={16}>
        <SplitButton variant="elevated" size="s">
          <SplitButtonAction>
            <Plus aria-hidden />
            Add server
          </SplitButtonAction>
          <SplitButtonCaret aria-label="More add options" />
        </SplitButton>
        <SplitButton variant="outlined" size="s">
          <SplitButtonAction>
            <Plus aria-hidden />
            Add server
          </SplitButtonAction>
          <SplitButtonCaret aria-label="More add options" />
        </SplitButton>
      </Row>
    </Stack>
  ),
};

/**
 * Three heights — 32px, 40px and 56px. The caret keeps a square footprint at
 * each one, and the outer corners stay pills while the seam stays square.
 */
export const Sizes: Story = {
  render: () => (
    <Row gap={16}>
      <SplitButton variant="filled" size="xs">
        <SplitButtonAction>
          <Plus aria-hidden />
          Add
        </SplitButtonAction>
        <SplitButtonCaret aria-label="More add options" />
      </SplitButton>
      <SplitButton variant="filled" size="s">
        <SplitButtonAction>
          <Plus aria-hidden />
          Add server
        </SplitButtonAction>
        <SplitButtonCaret aria-label="More add options" />
      </SplitButton>
      <SplitButton variant="filled" size="m">
        <SplitButtonAction>
          <Plus aria-hidden />
          Add server
        </SplitButtonAction>
        <SplitButtonCaret aria-label="More add options" />
      </SplitButton>
    </Row>
  ),
};

/**
 * The segments are disabled one at a time: an action with no default target
 * still leaves the caret's menu reachable, which is why the prop sits on the
 * buttons rather than on the container.
 */
export const Disabled: Story = {
  render: () => (
    <Stack>
      <Label>action disabled, caret live</Label>
      <Row gap={16}>
        <SplitButton variant="filled-tonal" size="s">
          <SplitButtonAction disabled>
            <Download aria-hidden />
            Import subscription
          </SplitButtonAction>
          <SplitButtonCaret aria-label="More import options" />
        </SplitButton>
      </Row>
      <Label>both disabled</Label>
      <Row gap={16}>
        <SplitButton variant="filled-tonal" size="s">
          <SplitButtonAction disabled>
            <Download aria-hidden />
            Import subscription
          </SplitButtonAction>
          <SplitButtonCaret disabled aria-label="More import options" />
        </SplitButton>
      </Row>
    </Stack>
  ),
};
