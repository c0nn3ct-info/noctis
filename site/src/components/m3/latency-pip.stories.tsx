import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from '@/storybook/layout';
import { LatencyPip } from './latency-pip';

const meta = {
  title: 'M3/LatencyPip',
  component: LatencyPip,
} satisfies Meta<typeof LatencyPip>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/** One pip over its caption, so the case each tone belongs to stays readable. */
function Case({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <Stack gap={6} align="center">
      {children}
      <Label>{caption}</Label>
    </Stack>
  );
}

/**
 * Every case the pip can be in. The tone comes from two thresholds — under one
 * second is success, under two is warning, anything slower is an error — so 1240
 * and 2100 sit on either side of the second break. `pending` swaps the dot for a
 * spinner; a missing measurement is the neutral em dash.
 *
 * The whole pip is `aria-hidden`: the value it shows is already in the accessible
 * name of the control it sits in, and announcing it twice would only add noise.
 */
export const Cases: Story = {
  render: () => (
    <Row gap={16} align="flex-start">
      <Case caption="24 — success">
        <LatencyPip ms={24} />
      </Case>
      <Case caption="186 — success">
        <LatencyPip ms={186} />
      </Case>
      <Case caption="1240 — warning">
        <LatencyPip ms={1240} />
      </Case>
      <Case caption="2100 — error">
        <LatencyPip ms={2100} />
      </Case>
      <Case caption="pending">
        <LatencyPip pending />
      </Case>
      <Case caption="failed">
        <LatencyPip failed />
      </Case>
      <Case caption="null — never probed">
        <LatencyPip ms={null} />
      </Case>
    </Row>
  ),
};

/**
 * The failed pip is the only one that carries a word, so it is the only one that
 * needs translating. The component reads no dictionary of its own — the caller
 * passes `failLabel`, which keeps the pip usable from both the site and the
 * extension, each with its own i18n. These are the six locales the site ships.
 */
export const LocalizedFail: Story = {
  render: () => (
    <Row gap={16} align="flex-start">
      <Case caption="en">
        <LatencyPip failed />
      </Case>
      <Case caption="ru">
        <LatencyPip failed failLabel="сбой" />
      </Case>
      <Case caption="es">
        <LatencyPip failed failLabel="fallo" />
      </Case>
      <Case caption="zh-CN">
        <LatencyPip failed failLabel="失败" />
      </Case>
      <Case caption="fa">
        <LatencyPip failed failLabel="خطا" />
      </Case>
      <Case caption="ar">
        <LatencyPip failed failLabel="فشل" />
      </Case>
    </Row>
  ),
};
