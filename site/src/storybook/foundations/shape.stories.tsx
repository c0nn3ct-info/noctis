import type { Meta, StoryObj } from '@storybook/react-vite';
import { ServerMonogram } from '@/components/m3/server-monogram';
import { Grid, Row, Stack } from '@/storybook/layout';
import { keyOf, useRootTokens, Section, Caption } from './shared';

/**
 * Corner shapes only: the `--shape-*` radius scale and the squircle clip-paths.
 * Elevation is a page of its own here (`Foundations/Elevation`), where the
 * extension catalogues the two together as `Foundations/Shape & Elevation` —
 * two mechanisms, two reference sheets.
 *
 * `borderRadius` in `tailwind.config.ts` is nothing but `var(--shape-*)`, so
 * the utilities below and the values printed beside them come from the same
 * place. Squircles are a different mechanism — a `clip-path` superellipse at a
 * fixed size — and are kept in their own story because of it.
 */
const meta = {
  title: 'Foundations/Shape',
  // A full-width reference sheet, not a centred specimen (see shared.tsx).
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// `rounded-*` maps 1:1 onto the `--shape-*` scale.
const RADII = [
  { className: 'rounded-xs', token: '--shape-xs', use: 'Menu items' },
  // Second step of the scale, and the one step no component reaches for: the
  // site jumps from menu items at xs straight to md.
  { className: 'rounded-sm', token: '--shape-sm', use: 'Unused' },
  { className: 'rounded-md', token: '--shape-md', use: 'Command blocks, the FAQ list, tables' },
  { className: 'rounded-lg', token: '--shape-lg', use: 'Cards, the popup frame' },
  { className: 'rounded-xl', token: '--shape-xl', use: 'Section headers, the browser mock' },
  { className: 'rounded-pill', token: '--shape-pill', use: 'Buttons, badges, the skip link' },
] as const;

const RADII_TOKENS = RADII.map((radius) => radius.token);

/**
 * The six corner sizes. `--shape-pill` is 999px rather than 50%, so a pill
 * stays a pill at any width instead of turning into an ellipse.
 *
 * `--radius: 16px` is also in `:root`, left over from the shadcn scaffold the
 * primitives grew out of; nothing reads it — `tailwind.config.ts` maps every
 * `rounded-*` onto a `--shape-*` instead.
 */
export const Radii: Story = {
  render: (_args, { globals }) => <RadiiPage tokenKey={keyOf(globals)} />,
};

function RadiiPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(RADII_TOKENS, tokenKey);
  return (
    <Section title="Corner radius">
      <Grid columns={3} gap={16}>
        {RADII.map((radius) => (
          <Stack key={radius.className} gap={6}>
            <div
              className={radius.className}
              style={{
                height: 72,
                background: 'hsl(var(--surface-container-high))',
                border: '1px solid hsl(var(--outline-variant))',
              }}
            />
            <code className="text-label-small text-on-surface">{radius.className}</code>
            <Caption>{`${radius.token}: ${values[radius.token] || '—'}`}</Caption>
            <span className="text-body-small text-on-surface-variant">{radius.use}</span>
          </Stack>
        ))}
      </Grid>
    </Section>
  );
}

// The clip-path in each of these is a hard-coded superellipse path, so the box
// has to be exactly the size the path was drawn for — anything else clips.
const SQUIRCLES = [
  { className: 'shape-squircle-sm', size: 36 },
  { className: 'shape-squircle-power', size: 40 },
  { className: 'shape-squircle-md', size: 44 },
  { className: 'shape-squircle-lg', size: 56 },
] as const;

/**
 * M3 Expressive squircles: a superellipse (n≈4) drawn as a `clip-path`. The
 * path is authored at one size per class, so the element must match it —
 * `ServerMonogram`'s `sm`/`md`/`lg` are 36, 44 and 56px for exactly that
 * reason. `shape-squircle-power` is the fourth path, 40px, which the site
 * itself does not use yet.
 *
 * `clip-path` also clips `box-shadow`, which is why an elevated squircle needs
 * the shadow on a wrapper rather than on the clipped element.
 */
export const Squircles: Story = {
  render: () => (
    <Stack gap={24}>
      <Section title="Clip paths">
        <Row gap={24} align="flex-end">
          {SQUIRCLES.map((squircle) => (
            <Stack key={squircle.className} gap={6} align="center">
              <div
                className={squircle.className}
                style={{
                  width: squircle.size,
                  height: squircle.size,
                  background: 'hsl(var(--primary-container))',
                }}
              />
              <code className="text-label-small text-on-surface">{squircle.className}</code>
              <Caption>{`${squircle.size}×${squircle.size}px`}</Caption>
            </Stack>
          ))}
        </Row>
      </Section>
      <Section title="In use">
        {/* The real consumer, at the three sizes that have a path. The monogram
            transitions `clip-path` and `border-radius` together on
            `--ease-spring-standard`, so switching `shape` morphs rather than
            cuts. */}
        <Row gap={16} align="flex-end">
          <ServerMonogram name="Frankfurt edge" size="sm" shape="squircle" />
          <ServerMonogram name="Amsterdam relay" size="md" shape="squircle" />
          <ServerMonogram name="Tokyo exit" size="lg" shape="squircle" />
          <ServerMonogram name="🇯🇵 Osaka" size="lg" shape="squircle" />
        </Row>
      </Section>
    </Stack>
  ),
};
