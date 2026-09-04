import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '@/storybook/layout';
import { keyOf, Section } from './shared';

/**
 * The type scale, measured rather than quoted.
 *
 * Each row renders its sample with the literal utility class and then reports
 * what `getComputedStyle` makes of it, so the numbers cannot drift from
 * `tailwind.config.ts`. Class strings are written out in full — Tailwind scans
 * this file for candidates, and a class assembled from a template literal would
 * never be generated.
 */
const meta = {
  title: 'Foundations/Typography',
  // A full-width reference sheet, not a centred specimen (see shared.tsx).
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

type Metrics = {
  size: string;
  line: string;
  weight: string;
  tracking: string;
};

/** Metrics of a rendered element, re-measured when the toolbar globals change. */
function useMetrics(tokenKey: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = getComputedStyle(element);
    setMetrics({
      size: style.fontSize,
      line: style.lineHeight,
      weight: style.fontWeight,
      tracking: style.letterSpacing,
    });
  }, [tokenKey]);
  return { ref, metrics };
}

function Readout({ metrics }: { metrics: Metrics | null }) {
  return (
    <code className="text-label-small text-on-surface-variant">
      {metrics
        ? `${metrics.size} / ${metrics.line} · ${metrics.weight} · ${metrics.tracking}`
        : 'measuring…'}
    </code>
  );
}

/**
 * One step of the scale: the sample on the left, the class and the measured
 * metrics on the right.
 */
function TypeRow({
  className,
  sample,
  tokenKey,
}: {
  className: string;
  sample: string;
  tokenKey: string;
}) {
  const { ref, metrics } = useMetrics(tokenKey);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'baseline',
        gap: 24,
        borderBottom: '1px solid hsl(var(--outline-variant))',
        paddingBottom: 12,
      }}
    >
      <span ref={ref} className={className}>
        {sample}
      </span>
      <Stack gap={2} align="flex-end">
        <code className="text-label-small text-on-surface">{className}</code>
        <Readout metrics={metrics} />
      </Stack>
    </div>
  );
}

// Every `fontSize` key in tailwind.config.ts, in the order the config declares
// them — which is not strictly descending: the two sizes M3 does not name sit
// together after `label-large`, so `label-unit` (10px) comes before
// `label-medium` (12px). The class strings are literals so the purge sees them.
const SCALE = [
  { className: 'text-display-small', sample: 'VLESS for Chrome' },
  { className: 'text-headline-large', sample: 'Install Noctis' },
  { className: 'text-headline-medium', sample: 'Install Noctis' },
  { className: 'text-headline-small', sample: 'Why three parts?' },
  { className: 'text-title-large', sample: 'Run the helper installer' },
  { className: 'text-title-medium', sample: 'Run the helper installer' },
  { className: 'text-title-small', sample: 'Run the helper installer' },
  { className: 'text-label-large', sample: 'Install' },
  // The pair M3 does not name, declared together in the config and listed
  // together here. `label-dense` is the `xs` button tier; `label-unit` names
  // the 10px unit suffix in the extension's traffic readouts, and is carried
  // here so the two scales stay in step.
  { className: 'text-label-dense', sample: 'Install' },
  { className: 'text-label-unit', sample: 'MB/S' },
  { className: 'text-label-medium', sample: 'Install' },
  { className: 'text-label-small', sample: 'Install' },
  {
    className: 'text-body-large',
    sample: 'The extension keeps the servers, the rules and the profiles.',
  },
  {
    className: 'text-body-medium',
    sample: 'The extension keeps the servers, the rules and the profiles.',
  },
  {
    className: 'text-body-small',
    sample: 'The extension keeps the servers, the rules and the profiles.',
  },
] as const;

/**
 * Display, headline, title, label and body — the whole `fontSize` scale.
 *
 * The site starts at `display-small`: the hero is the only place that needs a
 * display size, and it overrides the step outright above `sm`
 * (`sm:text-[44px] lg:text-[52px]`), which is why the scale stops there instead
 * of carrying medium and large steps nothing would use.
 */
export const Scale: Story = {
  render: (_args, { globals }) => (
    <Stack gap={12}>
      {SCALE.map((step) => (
        <TypeRow
          key={step.className}
          className={step.className}
          sample={step.sample}
          tokenKey={keyOf(globals)}
        />
      ))}
    </Stack>
  ),
};

const MONO_SAMPLES = [
  { className: 'font-mono text-body-small', sample: 'curl -fsSL https://noctis.c0nn3ct.info/macos.sh' },
  { className: 'font-mono text-body-medium', sample: 'sing-box, xray, mihomo' },
  { className: 'font-mono text-label-small', sample: '~/.local/share/noctis' },
] as const;

/**
 * Monospace is not a scale of its own: `font-mono` swaps the face and keeps a
 * body or label size. Install commands, paths, permission names and the
 * protocol badges use it so that a command can be read character by character
 * and lookalikes stay apart.
 *
 * Nothing overrides `fontFamily` in `tailwind.config.ts`, so this is Tailwind's
 * own stack rather than a Noctis one — the face below is whatever the platform
 * offers first from it.
 */
export const Mono: Story = {
  render: (_args, { globals }) => (
    <Stack gap={12}>
      {MONO_SAMPLES.map((step) => (
        <TypeRow
          key={step.className}
          className={step.className}
          sample={step.sample}
          tokenKey={keyOf(globals)}
        />
      ))}
    </Stack>
  ),
};

/** Reports the face an element actually resolved to, plus the stack it was offered. */
function StackProbe({
  label,
  className,
  tokenKey,
  children,
}: {
  label: string;
  className: string;
  tokenKey: string;
  children: string;
}) {
  const probe = useRef<HTMLDivElement>(null);
  const [family, setFamily] = useState('');
  useEffect(() => {
    const element = probe.current;
    if (!element) return;
    setFamily(getComputedStyle(element).fontFamily);
  }, [tokenKey]);
  return (
    <Stack gap={6}>
      <div className="text-label-large text-on-surface-variant">{label}</div>
      <div ref={probe} className={className}>
        <Stack gap={4}>
          <div className="text-title-medium">{children}</div>
          <div className="text-body-medium">0123456789 — Il1 O0 · {'{}[]()<>'}</div>
        </Stack>
      </div>
      <code className="text-label-small text-on-surface-variant">{family || 'measuring…'}</code>
    </Stack>
  );
}

// The site's own `home.hero.h1_sub`, one locale each, so the coverage sample is
// text the site actually ships rather than a pangram invented for the page.
const SCRIPTS = [
  { label: 'Latin', text: 'Route browser traffic through your own proxies' },
  { label: 'Cyrillic', text: 'Прокси для браузера без системного VPN' },
  { label: 'Simplified Chinese', text: '让浏览器流量走你自己的代理' },
  { label: 'Persian', text: 'ترافیک مرورگر را از طریق پراکسی\u200cهای خودتان مسیریابی کنید' },
  { label: 'Arabic', text: 'وجّه ترافيك المتصفّح عبر وكلائك الخاصين' },
] as const;

/**
 * No web font ships with the site: nothing is fetched from a font host and
 * there is no `@font-face`, so the UI face is whatever the platform offers
 * first from the stack on `html, body` — San Francisco on macOS, Segoe on
 * Windows. Inter was named there for years without a single font file behind
 * it; the stack stated now is the one that was always rendering.
 *
 * The Arabic and CJK fallbacks are in that stack on purpose: four of the six
 * locales the site ships need them, and the samples below fall through to them
 * rather than to a default with no coverage.
 */
export const Stacks: Story = {
  render: (_args, { globals }) => (
    <Stack gap={24}>
      <StackProbe label="System UI stack" className="" tokenKey={keyOf(globals)}>
        The quick brown fox routes over the lazy dog
      </StackProbe>
      <StackProbe label="Monospace stack" className="font-mono" tokenKey={keyOf(globals)}>
        The quick brown fox routes over the lazy dog
      </StackProbe>
      <Section title="Coverage">
        {SCRIPTS.map((script) => (
          <div
            key={script.label}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'baseline',
              gap: 24,
            }}
          >
            <span className="text-title-medium">{script.text}</span>
            <code className="text-label-small text-on-surface-variant">{script.label}</code>
          </div>
        ))}
      </Section>
    </Stack>
  ),
};
