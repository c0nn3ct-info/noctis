import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['variant', ['.dark &', '[data-theme="dark"] &']],
  content: [
    './src/**/*.{ts,tsx,html}',
    // Stories never ship, so a utility used only in one must not enter this
    // bundle. Storybook scans them through its own Tailwind instance
    // (see vite.storybook.config.ts).
    '!./src/**/*.stories.tsx',
    '!./src/storybook/**',
    './index.html',
    './install/index.html',
    './privacy/index.html',
    './license/index.html',
    './ru/**/index.html',
  ],
  // Hover styles apply only where a pointer can hover, so a tap on a phone
  // does not leave a tile stuck in its hover colour.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          container: 'hsl(var(--primary-container))',
          'on-container': 'hsl(var(--on-primary-container))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          container: 'hsl(var(--secondary-container))',
          'on-container': 'hsl(var(--on-secondary-container))',
        },
        tertiary: {
          DEFAULT: 'hsl(var(--tertiary))',
          foreground: 'hsl(var(--on-tertiary))',
          container: 'hsl(var(--tertiary-container))',
          'on-container': 'hsl(var(--on-tertiary-container))',
        },
        dir: {
          DEFAULT: 'hsl(var(--dir))',
          foreground: 'hsl(var(--dir-on))',
          container: 'hsl(var(--dir-container))',
          'on-container': 'hsl(var(--dir-on-container))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          variant: 'hsl(var(--surface-variant))',
          'container-lowest': 'hsl(var(--surface-container-lowest))',
          'container-low': 'hsl(var(--surface-container-low))',
          container: 'hsl(var(--surface-container))',
          'container-high': 'hsl(var(--surface-container-high))',
          'container-highest': 'hsl(var(--surface-container-highest))',
        },
        'on-surface': {
          DEFAULT: 'hsl(var(--on-surface))',
          variant: 'hsl(var(--on-surface-variant))',
        },
        outline: {
          DEFAULT: 'hsl(var(--outline))',
          variant: 'hsl(var(--outline-variant))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--on-success))',
          container: 'hsl(var(--success-container))',
          'on-container': 'hsl(var(--on-success-container))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          container: 'hsl(var(--warning-container))',
          'on-container': 'hsl(var(--on-warning-container))',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--on-error))',
          container: 'hsl(var(--error-container))',
          'on-container': 'hsl(var(--on-error-container))',
        },
        info: {
          container: 'hsl(var(--info-container))',
          'on-container': 'hsl(var(--on-info-container))',
        },
      },
      borderRadius: {
        xs: 'var(--shape-xs)',
        sm: 'var(--shape-sm)',
        md: 'var(--shape-md)',
        lg: 'var(--shape-lg)',
        xl: 'var(--shape-xl)',
        pill: 'var(--shape-pill)',
      },
      boxShadow: {
        e1: 'var(--shadow-1)',
        e2: 'var(--shadow-2)',
        e3: 'var(--shadow-3)',
        e4: 'var(--shadow-4)',
      },
      transitionTimingFunction: {
        emph: 'var(--ease-emph)',
        'emph-decel': 'var(--ease-emph-decel)',
        spring: 'var(--ease-spring)',
        'spring-standard': 'var(--ease-spring-standard)',
      },
      opacity: {
        // One disabled level for the whole interactive family. It used to be 50
        // on buttons, 60 on the FAB and the row controls, and 70 on labels, so
        // three different greys sat side by side in the popup footer.
        disabled: '0.5',
      },
      transitionDuration: {
        'x-short': '80ms',
        short: '120ms',
        med: '250ms',
        long: '450ms',
        'x-long': '600ms',
        // One slow turn, for the refresh glyph that has to read as a full spin.
        'xx-long': '900ms',
      },
      fontFamily: {
        // Written down rather than inherited from Tailwind, alongside the sans
        // stack in globals.css: the platform's own mono first on each system.
        mono: [
          'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Cascadia Mono', 'Menlo',
          'Consolas', 'Ubuntu Mono', 'Noto Sans Mono', 'Liberation Mono', 'monospace',
        ],
      },
      fontSize: {
        'display-small':   ['36px', { lineHeight: '44px', letterSpacing: '0px' }],
        'headline-large':  ['32px', { lineHeight: '40px', letterSpacing: '0px' }],
        'headline-medium': ['28px', { lineHeight: '36px', letterSpacing: '0px' }],
        'headline-small':  ['24px', { lineHeight: '32px', letterSpacing: '0px' }],
        'title-large':     ['22px', { lineHeight: '28px', letterSpacing: '0px' }],
        'title-medium':    ['16px', { lineHeight: '24px', letterSpacing: '0.15px', fontWeight: '500' }],
        'title-small':     ['14px', { lineHeight: '20px', letterSpacing: '0.1px',  fontWeight: '500' }],
        'label-large':     ['14px', { lineHeight: '20px', letterSpacing: '0.1px',  fontWeight: '500' }],
        // Two sizes M3 does not define, but this UI does: a 13px dense control
        // label (the `xs`/`s` button tier) and a 10px unit suffix in the traffic
        // readouts. They were arbitrary `text-[13px]`/`text-[10px]` in a dozen
        // places; naming them keeps the scale honest about what it contains.
        'label-dense':     ['13px', { lineHeight: '18px', letterSpacing: '0.1px',  fontWeight: '500' }],
        'label-unit':      ['10px', { lineHeight: '14px', letterSpacing: '0.4px',  fontWeight: '500' }],
        // The landing's small uppercase labels over lists, columns and figures.
        // They were a hand-typed `text-[11px] uppercase tracking-[0.1em]` in
        // seven places and 10px in one; 12px is the floor for text a visitor
        // has to read, and the tracking is the half of the look that stays.
        'overline':        ['12px', { lineHeight: '16px', letterSpacing: '0.1em',  fontWeight: '600' }],
        // A dense title between body-medium and body-large: claim titles, CTA
        // labels and the mono values in the landing's tables.
        'title-dense':     ['15px', { lineHeight: '21px', letterSpacing: '0px' }],
        // The landing's own steps, named by the job they do. Every one of them
        // was a hand-typed `text-[Npx]`, eleven sizes in thirty-four places;
        // 18 and 19 were one step spelled twice, and so were 22 and 24. No
        // tracking or weight, and the 1.5 line height those spans inherited,
        // so the move to names changes no rendering beyond those two merges.
        'meta':            ['13px', { lineHeight: '1.5' }],
        'caption':         ['14px', { lineHeight: '1.5' }],
        'value':           ['16px', { lineHeight: '1.5' }],
        'title-card':      ['19px', { lineHeight: '1.5' }],
        'lead':            ['20px', { lineHeight: '1.5' }],
        'title-plan':      ['24px', { lineHeight: '1.5' }],
        'figure':          ['44px', { lineHeight: '1.5' }],
        'figure-large':    ['72px', { lineHeight: '1.5' }],
        'label-medium':    ['12px', { lineHeight: '16px', letterSpacing: '0.5px',  fontWeight: '500' }],
        'label-small':     ['11px', { lineHeight: '16px', letterSpacing: '0.5px',  fontWeight: '500' }],
        'body-large':      ['16px', { lineHeight: '24px', letterSpacing: '0.5px' }],
        'body-medium':     ['14px', { lineHeight: '20px', letterSpacing: '0.25px' }],
        'body-small':      ['12px', { lineHeight: '16px', letterSpacing: '0.4px' }],
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '25%': { opacity: '0.55' },
          '100%': { transform: 'scale(1.55)', opacity: '0' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(0.94)', opacity: '0.45' },
          '50%': { transform: 'scale(1.0)', opacity: '0.7' },
        },
        'status-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        // The architecture diagram's rail. Both loops move a transform and
        // nothing else, so neither runs layout or repaints: `rail-march` slides
        // the dashed control strip by exactly one dash period, and `rail-comet`
        // walks a full-width carrier in from the left until the packet it holds
        // lands flush on the next node's edge.
        'rail-march': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(14px)' },
        },
        'rail-comet': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '8%': { opacity: '1' },
          '85%': { opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring var(--pulse-dur, 3s) var(--ease-emph-decel) infinite',
        breathe: 'breathe var(--breathe-dur, 3.6s) var(--ease-emph) infinite',
        'status-dot': 'status-dot 1.4s var(--ease-emph) infinite',
        'rail-march': 'rail-march 0.6s linear infinite',
        'rail-comet': 'rail-comet 4.2s linear infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
