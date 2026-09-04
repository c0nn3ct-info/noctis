import { useLayoutEffect } from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';
import { LOCALE_OPTIONS } from '../src/components/language-switcher';
import { isRtl, setLocale, type Locale } from '../src/i18n';
import {
  applyAccent,
  applyTheme,
  watchSystemTheme,
  type Accent,
  type Theme,
} from '../src/lib/theme';

// The site has no theme context: `applyTheme`/`applyAccent` mutate <html>, and
// components read the resulting CSS custom properties. Running the real
// functions (instead of an addon that swaps a wrapper class) keeps the toolbar
// honest, and mutating <html> rather than remounting keeps every
// `transition-colors` on the story observable as the theme flips.
//
// `useLayoutEffect`, not `useEffect`: globals.css resolves dark from
// `prefers-color-scheme` whenever <html> carries no `data-theme`, so an effect
// that runs after the commit would let a light story paint one dark frame on a
// dark-OS machine. The same holds for `[data-accent]` tokens.
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as Theme;
  const accent = context.globals.accent as Accent;

  useLayoutEffect(() => {
    applyTheme(theme);
    watchSystemTheme(theme);
  }, [theme]);

  useLayoutEffect(() => {
    applyAccent(accent);
  }, [accent]);

  return <Story />;
};

// i18n is a module-level singleton, so `setLocale` has to land before the story
// renders — an effect would fire too late. `key={locale}` then remounts the
// story, so components that read `t()` once (in a state initialiser or an
// effect) pick the new dictionary up.
const withLocale: Decorator = (Story, context) => {
  const locale = context.globals.locale as Locale;
  setLocale(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  return <Story key={locale} />;
};

// Toolbar items, one per member of the union they set. `Record<Theme, …>` and
// `Record<Accent, …>` are what makes that a type error rather than a silent
// mismatch: a fourth theme or a fifth accent in `src/lib/theme.ts` fails `tsc`
// here until it has an entry, and a mistyped value ('strom') fails as an
// unknown key. The locale items derive from `LOCALE_OPTIONS` for the same
// reason. Object key order is the order the toolbar lists them in.
const THEME_TITLES: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const ACCENT_TITLES: Record<Accent, string> = {
  neutral: 'Neutral',
  storm: 'Storm',
  purple: 'Purple',
  cyan: 'Cyan',
};

/** `{ value, title }` items in declaration order. */
function toolbarItems(titles: Record<string, string>): { value: string; title: string }[] {
  return Object.entries(titles).map(([value, title]) => ({ value, title }));
}

const preview: Preview = {
  // withTheme is last, so it wraps withLocale: a locale switch remounts the
  // story without discarding the theme decorator's effect state.
  decorators: [withLocale, withTheme],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Color scheme, applied through the real applyTheme()',
      toolbar: {
        icon: 'contrast',
        dynamicTitle: true,
        items: toolbarItems(THEME_TITLES),
      },
    },
    accent: {
      name: 'Accent',
      description: 'Source-color palette on [data-accent]',
      toolbar: {
        icon: 'paintbrush',
        dynamicTitle: true,
        items: toolbarItems(ACCENT_TITLES),
      },
    },
    locale: {
      name: 'Locale',
      description: 'Dictionary and text direction',
      toolbar: {
        icon: 'globe',
        dynamicTitle: true,
        items: LOCALE_OPTIONS.map(({ code, label }) =>
          isRtl(code) ? { value: code, title: label, right: 'RTL' } : { value: code, title: label },
        ),
      },
    },
  },
  initialGlobals: { locale: 'en', theme: 'light', accent: 'neutral' },
  parameters: {
    layout: 'centered',
    // The theme decorator paints <html>; a backgrounds swatch on top of it
    // would only ever disagree with the tokens.
    backgrounds: { disable: true },
    options: {
      storySort: { order: ['Foundations', 'Primitives', 'M3', 'Blocks', 'Pages'] },
    },
  },
  tags: ['autodocs'],
};

export default preview;
