import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row, Stack } from '@/storybook/layout';
import { NoctisLogo } from './noctis-logo';

/**
 * The Noctis mark as the site uses it: at the sizes the header and the mocks
 * ask for, and inside the two lockups those build from it. A site block rather
 * than a token — the extension catalogues the same generated artwork under
 * `Foundations/Brand/Logo`, where it stands with the design system it ships in.
 */
const meta = {
  title: 'Blocks/NoctisLogo',
  component: NoctisLogo,
  // No `args` here. Every story below sets its own `className` inside a custom
  // `render` — that is the specimen — so a meta-level default would be a
  // control that moves nothing.
} satisfies Meta<typeof NoctisLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

function Label({ children }: { children: string }) {
  return <span className="text-label-small text-on-surface-variant">{children}</span>;
}

/**
 * The mark is generated artwork — masks and all — and its only prop is
 * `className`, so size and color come entirely from the caller: `currentColor`
 * for the fill, Tailwind's sizing utilities for the box. `shrink-0` is baked in
 * so it never collapses inside a flex row.
 *
 * At 16px the shield's inner detail and the server's status dots go to a pixel
 * or two each; 24px is the smallest size that still reads as the mark rather
 * than as a blob, which is why the header uses that and the favicon does not
 * shrink below it.
 */
export const Sizes: Story = {
  render: () => (
    <Row gap={24} align="flex-end">
      {[
        ['16', 'h-4 w-4'],
        ['24', 'h-6 w-6'],
        ['48', 'h-12 w-12'],
        ['96', 'h-24 w-24'],
      ].map(([label, size]) => (
        <Stack key={label} gap={8} align="center">
          <NoctisLogo className={`${size} text-primary`} />
          <Label>{`${label}px`}</Label>
        </Stack>
      ))}
    </Row>
  ),
};

/**
 * The header's lockup: the mark at 24px in the primary color, next to the
 * wordmark, inside the state-layer pill that makes the pair one link back to
 * the home page.
 */
export const HeaderTile: Story = {
  render: () => (
    <span className="m3-state-layer inline-flex items-center gap-2 rounded-pill px-2 py-1 text-on-surface">
      <NoctisLogo className="h-6 w-6 text-primary" />
      <span className="text-title-medium tracking-tight">Noctis</span>
    </span>
  ),
};

/**
 * The extension's toolbar icon as `BrowserMock` draws it: 16px on a
 * primary-container tile, ringed to read as pinned, with the connected dot in
 * the corner. This is the smallest place the mark ships, and the reason the
 * artwork keeps its silhouette simple.
 */
export const ToolbarTile: Story = {
  render: () => (
    <span
      className="relative grid h-7 w-7 place-items-center rounded-md bg-primary-container text-primary-on-container ring-2 ring-primary/40"
      aria-hidden
    >
      <NoctisLogo className="h-4 w-4" />
      <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-surface-container" />
    </span>
  ),
};
