import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from '@/storybook/layout';

// Reading machinery shared by the five Foundations pages.
//
// Each of them prints token values measured from the live document rather than
// copied out of `globals.css`, and each has to re-measure when the toolbar
// rewrites `<html>`. That was the same four helpers in five files; they live
// here instead. `shared.tsx`, not `shared.stories.tsx`, so Storybook's glob
// (`src/**/*.stories.@(ts|tsx)`) does not pick the module up as a story file —
// `src/storybook/**` is already outside the shipped Tailwind content and
// outside the coverage include.
//
// Names match the extension's `src/storybook/foundations/` helpers, so the two
// lanes read alike in the composed shell.
//
// Each of the five metas also sets `layout: 'padded'`. The site's preview
// centres stories, which shrink-wraps a token grid into a column in the middle
// of an otherwise empty frame; these pages are reference sheets and want the
// width. The extension's foundations default to padded for the same reason.

/**
 * The globals that rewrite `<html>`; a change to any of them invalidates every
 * read value. Locale is in the key because it changes `lang`, `dir` and the
 * resolved face, not only the strings.
 */
export function keyOf(globals: { [name: string]: unknown }): string {
  return [globals.theme, globals.accent, globals.locale].join('/');
}

/**
 * Resolved values of custom properties on `<html>`, re-read whenever `tokenKey`
 * changes. The preview's theme decorator applies the theme and the accent in a
 * `useLayoutEffect`, so by the time this effect runs the document already
 * carries them and a read here is a read of the real cascade — media-query dark
 * and `[data-accent]` overrides included.
 */
export function useRootTokens(
  names: readonly string[],
  tokenKey: string,
): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()])));
  }, [names, tokenKey]);
  return values;
}

/**
 * A labelled group on a docs page — the heading above a swatch grid, not
 * `components/m3/section`, which is the site's own collapsible container.
 */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={8}>
      <div className="text-label-large text-on-surface-variant">{title}</div>
      {children}
    </Stack>
  );
}

/** A measured value under whatever it describes; an em dash until it is read. */
export function Caption({ children }: { children: string }) {
  return <code className="text-label-small text-on-surface-variant">{children || '—'}</code>;
}
