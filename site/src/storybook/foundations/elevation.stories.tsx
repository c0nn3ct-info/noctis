import type { Meta, StoryObj } from '@storybook/react-vite';
import { cn } from '@/lib/utils';
import { Grid, Stack } from '@/storybook/layout';
import { keyOf, useRootTokens, Section, Caption } from './shared';

/**
 * The four shadow steps only — `--shadow-1` to `--shadow-4` and the utilities
 * over them. Corner shapes are a page of their own here
 * (`Foundations/Shape`), where the extension catalogues the two together as
 * `Foundations/Shape & Elevation`.
 *
 * `boxShadow.e1…e4` in `tailwind.config.ts` is nothing but `var(--shadow-*)`,
 * so the utilities below and the values printed beside them come from the same
 * place.
 */
const meta = {
  title: 'Foundations/Elevation',
  // A full-width reference sheet, not a centred specimen (see shared.tsx).
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const ELEVATIONS = [
  { className: 'shadow-e1', token: '--shadow-1', use: 'The elevated Card; a button on hover' },
  { className: 'shadow-e2', token: '--shadow-2', use: 'Menus, the language popover' },
  { className: 'shadow-e3', token: '--shadow-3', use: 'The popup frame, the resting FAB' },
  { className: 'shadow-e4', token: '--shadow-4', use: 'The browser mock, the FAB on hover' },
] as const;

const ELEVATION_TOKENS = ELEVATIONS.map((elevation) => elevation.token);

/**
 * Four steps, each a two-layer shadow: a tight key shadow plus a softer ambient
 * one, both fixed black at low alpha. `transition-shadow duration-med ease-emph`
 * on `Card` and the button family is what makes a hover step up rather than
 * snap.
 */
export const Elevation: Story = {
  render: (_args, { globals }) => <ElevationPage tokenKey={keyOf(globals)} />,
};

function ElevationPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(ELEVATION_TOKENS, tokenKey);
  return (
    <Section title="Elevation">
      <Grid columns={2} gap={24} style={{ padding: 8 }}>
        {ELEVATIONS.map((elevation) => (
          <Stack key={elevation.className} gap={8}>
            <div
              className={cn('rounded-lg bg-surface-container-low p-5', elevation.className)}
              style={{ minHeight: 88 }}
            >
              <Stack gap={4}>
                <div className="text-title-small text-on-surface">{elevation.className}</div>
                <div className="text-body-small text-on-surface-variant">{elevation.use}</div>
              </Stack>
            </div>
            <Caption>{`${elevation.token}: ${values[elevation.token] || '—'}`}</Caption>
          </Stack>
        ))}
      </Grid>
    </Section>
  );
}

const GROUNDS = [
  { label: 'bg-background', className: 'bg-background' },
  { label: 'bg-surface-container-low', className: 'bg-surface-container-low' },
  { label: 'bg-surface-container-high', className: 'bg-surface-container-high' },
] as const;

/**
 * The same four shadows over three grounds, because the tones are fixed black
 * at low alpha rather than tinted by the theme: on a dark ground they all but
 * disappear, and depth has to come from the surface ladder instead. That is why
 * the popup mock pairs `shadow-e3` with a `border-outline-variant`, and why the
 * browser mock at `shadow-e4` still draws a border.
 */
export const Layering: Story = {
  render: () => (
    <Stack gap={24}>
      {GROUNDS.map((ground) => (
        <Section key={ground.label} title={ground.label}>
          <div className={cn('rounded-lg p-6', ground.className)}>
            <Grid columns={4} gap={20}>
              {ELEVATIONS.map((elevation) => (
                <div
                  key={elevation.className}
                  className={cn(
                    'rounded-md bg-surface-container-lowest p-3 text-label-small text-on-surface',
                    elevation.className,
                  )}
                >
                  {elevation.className}
                </div>
              ))}
            </Grid>
          </div>
        </Section>
      ))}
    </Stack>
  ),
};
