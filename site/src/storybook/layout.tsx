import type { CSSProperties, ReactNode } from 'react';

// Layout glue for stories, as inline styles.
//
// The app's Tailwind `content` globs deliberately exclude stories (see
// tailwind.config.ts), so a utility written only in a story never reaches the
// shipped CSS — Storybook renders it, the site would not. Keeping sizing, gaps
// and grids out of `className` altogether keeps that boundary from turning
// into a judgement call: only design-token classes the app itself uses belong
// in a story's `className`.

interface LayoutProps {
  children: ReactNode;
  /** Gap between children, in px. */
  gap?: number;
  align?: CSSProperties['alignItems'];
  style?: CSSProperties;
}

/** Horizontal, wrapping strip — variant and size line-ups. */
export function Row({ children, gap = 12, align = 'center', style }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap, alignItems: align, ...style }}>
      {children}
    </div>
  );
}

/** Vertical stack — labelled groups, one Row per group. */
export function Stack({ children, gap = 16, align = 'stretch', style }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: align, ...style }}>
      {children}
    </div>
  );
}

interface GridProps extends LayoutProps {
  /** Number of equal columns. */
  columns?: number;
}

/** Equal-column grid — token swatches, matrices of one prop against another. */
export function Grid({ children, columns = 3, gap = 12, align = 'center', style }: GridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
        alignItems: align,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
