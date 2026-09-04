import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTriangle, Download, Plus, Power, RefreshCw, Route } from 'lucide-react';
import { Row, Stack } from '@/storybook/layout';
import { ExtendedFab, Fab } from './fab';

const meta = {
  title: 'Primitives/Fab',
  component: Fab,
  argTypes: {
    // `asChild` needs a single React element child, which the controls panel
    // cannot supply.
    asChild: { control: false },
  },
} satisfies Meta<typeof Fab>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * Six container colors. `primary` is the default; `success` and `error` are the
 * connected and failed states of the popup's power button, which is the only FAB
 * the product actually ships.
 */
export const Colors: Story = {
  render: () => (
    <Row gap={16}>
      <Fab color="primary" type="button" aria-label="Connect">
        <Power aria-hidden />
      </Fab>
      <Fab color="success" type="button" aria-label="Disconnect">
        <Power aria-hidden />
      </Fab>
      <Fab color="error" type="button" aria-label="Retry connection">
        <AlertTriangle aria-hidden />
      </Fab>
      <Fab color="surface" type="button" aria-label="Re-ping servers">
        <RefreshCw aria-hidden />
      </Fab>
      <Fab color="secondary" type="button" aria-label="Add server">
        <Plus aria-hidden />
      </Fab>
      <Fab color="tertiary" type="button" aria-label="Routing rules">
        <Route aria-hidden />
      </Fab>
    </Row>
  ),
};

/** Three sizes — 40px, 56px and 96px — each with its own corner radius and icon size. */
export const Sizes: Story = {
  render: () => (
    <Row gap={16}>
      <Fab size="small" color="primary" type="button" aria-label="Connect">
        <Power aria-hidden />
      </Fab>
      <Fab size="regular" color="primary" type="button" aria-label="Connect">
        <Power aria-hidden />
      </Fab>
      <Fab size="large" color="primary" type="button" aria-label="Connect">
        <Power aria-hidden />
      </Fab>
    </Row>
  ),
};

/**
 * `ExtendedFab` is the labelled sibling: one height (56px), one radius, and the
 * same six colors. The label makes it self-describing, so no `aria-label`.
 */
export const Extended: Story = {
  render: () => (
    <Stack>
      <Label>primary / success / surface</Label>
      <Row gap={16}>
        <ExtendedFab color="primary" type="button">
          <Power aria-hidden />
          <span>Connect</span>
        </ExtendedFab>
        <ExtendedFab color="success" type="button">
          <Power aria-hidden />
          <span>Connected</span>
        </ExtendedFab>
        <ExtendedFab color="surface" type="button">
          <RefreshCw aria-hidden />
          <span>Connecting</span>
        </ExtendedFab>
      </Row>
      <Label>error / secondary / tertiary</Label>
      <Row gap={16}>
        <ExtendedFab color="error" type="button">
          <AlertTriangle aria-hidden />
          <span>Helper offline</span>
        </ExtendedFab>
        <ExtendedFab color="secondary" type="button">
          <Plus aria-hidden />
          <span>Add server</span>
        </ExtendedFab>
        <ExtendedFab color="tertiary" type="button">
          <Download aria-hidden />
          <span>Import subscription</span>
        </ExtendedFab>
      </Row>
    </Stack>
  ),
};

/** Disabled drops to the shared opacity token and stops taking pointer events. */
export const Disabled: Story = {
  render: () => (
    <Row gap={16}>
      <Fab color="primary" type="button" disabled aria-label="Connect">
        <Power aria-hidden />
      </Fab>
      <Fab color="surface" type="button" disabled aria-label="Re-ping servers">
        <RefreshCw aria-hidden />
      </Fab>
      <ExtendedFab color="surface" type="button" disabled>
        <RefreshCw aria-hidden />
        <span>Checking helper</span>
      </ExtendedFab>
    </Row>
  ),
};
