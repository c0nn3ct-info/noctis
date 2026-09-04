import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid, Stack } from '@/storybook/layout';
import { keyOf, useRootTokens, Section, Caption } from './shared';

/**
 * Colour roles, painted from the live custom properties.
 *
 * Every swatch fills with `hsl(var(--role))` and every printed value comes from
 * `getComputedStyle`, so the page shows what the site itself would render after
 * `applyTheme`/`applyAccent` — not a copy of the numbers in `globals.css`.
 * Switch Theme or Accent in the toolbar and both the fills and the values move.
 *
 * The neutrals and the status families are theme-fixed; `[data-accent]` sweeps
 * primary, secondary and tertiary and tints the surface ladder with them, which
 * is why the greys are not the same grey under Storm as under Neutral.
 */
const meta = {
  title: 'Foundations/Colors',
  // A full-width reference sheet, not a centred specimen (see shared.tsx).
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** One role: the fill, its name, and its resolved triple. */
function Swatch({
  token,
  on,
  value,
  height = 60,
}: {
  token: string;
  on?: string;
  value: string;
  height?: number;
}) {
  return (
    <Stack gap={4}>
      <div
        className="text-label-large"
        style={{
          background: `hsl(var(${token}))`,
          color: on ? `hsl(var(${on}))` : undefined,
          border: '1px solid hsl(var(--outline-variant))',
          borderRadius: 'var(--shape-sm)',
          height,
          display: 'flex',
          alignItems: 'flex-end',
          padding: 8,
        }}
      >
        {on ? 'Aa' : null}
      </div>
      <code className="text-label-small text-on-surface">{token}</code>
      <Caption>{value}</Caption>
    </Stack>
  );
}

/** A container role with the text role that is meant to sit on it. */
function Pair({
  container,
  on,
  values,
}: {
  container: string;
  on?: string;
  values: Record<string, string>;
}) {
  return (
    <div
      style={{
        background: `hsl(var(${container}))`,
        color: on ? `hsl(var(${on}))` : 'hsl(var(--on-surface))',
        border: '1px solid hsl(var(--outline-variant))',
        borderRadius: 'var(--shape-sm)',
        padding: 12,
      }}
    >
      <Stack gap={2}>
        <div className="text-title-small">{on ? 'Text on this role' : 'No paired text role'}</div>
        <code className="text-label-small">{container}</code>
        <code className="text-label-small">{values[container] || '—'}</code>
        {on ? (
          <>
            <code className="text-label-small">{on}</code>
            <code className="text-label-small">{values[on] || '—'}</code>
          </>
        ) : null}
      </Stack>
    </div>
  );
}

const SURFACE_TONES = [
  { token: '--background', on: '--on-background' },
  { token: '--surface', on: '--on-surface' },
  { token: '--surface-container-lowest', on: '--on-surface' },
  { token: '--surface-container-low', on: '--on-surface' },
  { token: '--surface-container', on: '--on-surface' },
  { token: '--surface-container-high', on: '--on-surface' },
  { token: '--surface-container-highest', on: '--on-surface' },
  { token: '--surface-variant', on: '--on-surface-variant' },
  { token: '--inverse-surface', on: '--on-inverse-surface' },
] as const;

const ON_ROLES = [
  '--on-background',
  '--on-surface',
  '--on-surface-variant',
  '--on-inverse-surface',
] as const;

const LINE_ROLES = ['--outline', '--outline-variant'] as const;

const SURFACE_TOKENS = [
  ...SURFACE_TONES.flatMap((tone) => [tone.token, tone.on]),
  ...ON_ROLES,
  ...LINE_ROLES,
];

/**
 * The tone-based surface set plus the text roles that ride on it. `--surface`
 * and `--background` are the same tone by design; the five containers step up
 * from it — the header sits on `low`, a `CodeBlock` on `highest` — and
 * `--inverse-surface` is what the skip link uses once it is focused.
 */
export const Surfaces: Story = {
  render: (_args, { globals }) => <SurfacesPage tokenKey={keyOf(globals)} />,
};

function SurfacesPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(SURFACE_TOKENS, tokenKey);
  return (
    <Stack gap={24}>
      <Section title="Surface tones">
        <Grid columns={3} gap={16}>
          {SURFACE_TONES.map((tone) => (
            <Swatch key={tone.token} token={tone.token} on={tone.on} value={values[tone.token]} />
          ))}
        </Grid>
      </Section>
      <Section title="Text on surfaces">
        <Grid columns={4} gap={16}>
          {ON_ROLES.map((token) => (
            <Swatch key={token} token={token} value={values[token]} height={40} />
          ))}
        </Grid>
      </Section>
      <Section title="Lines">
        <Grid columns={4} gap={16}>
          {LINE_ROLES.map((token) => (
            <Swatch key={token} token={token} value={values[token]} height={40} />
          ))}
        </Grid>
      </Section>
    </Stack>
  );
}

const SOLID_ROLES = [
  { container: '--primary', on: '--on-primary' },
  { container: '--tertiary', on: '--on-tertiary' },
  { container: '--success', on: '--on-success' },
  { container: '--error', on: '--on-error' },
  // No `--on-warning`: nothing on the site puts text on solid warning, so the
  // role deliberately has no paired text tone.
  { container: '--warning', on: undefined },
  { container: '--inverse-primary', on: undefined },
  { container: '--ring', on: undefined },
] as const;

const CONTAINER_ROLES = [
  { container: '--primary-container', on: '--on-primary-container' },
  { container: '--secondary-container', on: '--on-secondary-container' },
  { container: '--tertiary-container', on: '--on-tertiary-container' },
  { container: '--success-container', on: '--on-success-container' },
  { container: '--warning-container', on: '--on-warning-container' },
  { container: '--error-container', on: '--on-error-container' },
  { container: '--info-container', on: '--on-info-container' },
] as const;

// Compatibility aliases, kept from the shadcn scaffold the primitives grew out
// of. Every one of these points at a role above with `var()`, which is why the
// resolved value of, say, `--card` is the triple of `--surface-container-low`
// rather than the text `var(--surface-container-low)`.
const ALIAS_ROLES = [
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
] as const;

const ROLE_TOKENS = [
  ...SOLID_ROLES.flatMap((role) => (role.on ? [role.container, role.on] : [role.container])),
  ...CONTAINER_ROLES.flatMap((role) => [role.container, role.on]),
  ...ALIAS_ROLES,
];

/**
 * Accent roles as they are used: a fill with the text tone that belongs on it.
 * The status families (success/warning/error) and `--info-container` stay put
 * across accents; primary, secondary and tertiary are swept by `[data-accent]`.
 */
export const Roles: Story = {
  render: (_args, { globals }) => <RolesPage tokenKey={keyOf(globals)} />,
};

function RolesPage({ tokenKey }: { tokenKey: string }) {
  const values = useRootTokens(ROLE_TOKENS, tokenKey);
  return (
    <Stack gap={24}>
      <Section title="Solid roles">
        <Grid columns={3} gap={16}>
          {SOLID_ROLES.map((role) => (
            <Pair key={role.container} container={role.container} on={role.on} values={values} />
          ))}
        </Grid>
      </Section>
      <Section title="Containers and their text">
        <Grid columns={3} gap={16}>
          {CONTAINER_ROLES.map((role) => (
            <Pair key={role.container} container={role.container} on={role.on} values={values} />
          ))}
        </Grid>
      </Section>
      <Section title="Aliases">
        <Grid columns={4} gap={16}>
          {ALIAS_ROLES.map((token) => (
            <Swatch key={token} token={token} value={values[token]} height={40} />
          ))}
        </Grid>
      </Section>
    </Stack>
  );
}

const DIR_TOKENS = ['--dir', '--dir-on', '--dir-container', '--dir-on-container'] as const;

const DIRECTIONS = [
  { label: 'proxy', className: 'dir-proxy' },
  { label: 'direct', className: 'dir-direct' },
  { label: 'block', className: 'dir-block' },
] as const;

/**
 * `--dir-*` is a scoped alias set, not a root role: `.dir-proxy`,
 * `.dir-direct` and `.dir-block` each point the four variables at a different
 * family, and there is no `:root` fallback — a `bg-dir-container` with no such
 * ancestor renders transparent. `Card variant="accent"` is the one consumer on
 * the site, which is why its own story wraps it in a `.dir-*` scope.
 *
 * Values below are read off the scoped element rather than off `<html>`, since
 * `<html>` never carries them.
 */
export const Direction: Story = {
  render: (_args, { globals }) => (
    <Grid columns={3} gap={16}>
      {DIRECTIONS.map((direction) => (
        <DirBlock
          key={direction.label}
          label={direction.label}
          className={direction.className}
          tokenKey={keyOf(globals)}
        />
      ))}
    </Grid>
  ),
};

function DirBlock({
  label,
  className,
  tokenKey,
}: {
  label: string;
  className: string;
  tokenKey: string;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const element = scope.current;
    if (!element) return;
    const style = getComputedStyle(element);
    setValues(
      Object.fromEntries(DIR_TOKENS.map((name) => [name, style.getPropertyValue(name).trim()])),
    );
  }, [tokenKey]);
  return (
    <div ref={scope} className={className}>
      <Stack gap={8}>
        <code className="text-label-small text-on-surface-variant">.{className}</code>
        <div className="rounded-md bg-dir-container p-3 text-dir-on-container">
          <Stack gap={2}>
            <div className="text-title-small">{label}</div>
            <div className="text-body-small">bg-dir-container / text-dir-on-container</div>
          </Stack>
        </div>
        <Grid columns={2} gap={8}>
          {DIR_TOKENS.map((token) => (
            <Swatch key={token} token={token} value={values[token]} height={32} />
          ))}
        </Grid>
      </Stack>
    </div>
  );
}
