import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NoctisLogo } from './noctis-logo';

describe('NoctisLogo', () => {
  it('renders a decorative currentColor svg', () => {
    const { container } = render(<NoctisLogo idSuffix="story" />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('viewBox', '295.9 122.9 736.1 736.1');
    expect(svg).toHaveClass('shrink-0');
  });

  it('carries the masks the artwork depends on, and points them at itself', () => {
    const { container } = render(<NoctisLogo idSuffix="story" />);

    for (const prefix of ['noctis-logo-a', 'noctis-logo-b', 'noctis-logo-f', 'noctis-logo-s']) {
      expect(container.querySelector(`[id^="${prefix}-"]`)).not.toBeNull();
    }
    expect(container.querySelectorAll('svg > path')).toHaveLength(3);

    const full = container.querySelector('[id^="noctis-logo-f-"]')!.id;
    const masked = container.querySelectorAll(`[mask="url(#${full})"]`);
    expect(masked).toHaveLength(1);
  });

  it('gives every instance its own ids', () => {
    const { container } = render(
      <>
        <NoctisLogo idSuffix="a" />
        <NoctisLogo idSuffix="b" />
      </>,
    );

    // The mark renders more than once per page — header, footer, browser-mock
    // tab. With one shared set of ids that was several elements sharing an
    // `id`, and `use href="#…"` and `mask="url(#…)"` both resolve to the first
    // match: every mark after the first was masked by the first one's paths.
    // The suffix is the caller's, not `useId`'s: the prerender captures a
    // `createRoot` render and the visitor hydrates, and those two never agree
    // on a generated id.
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toHaveLength(8);
  });

  it('merges a custom className', () => {
    const { container } = render(<NoctisLogo idSuffix="story" className="h-6 w-6 text-primary" />);
    expect(container.querySelector('svg')).toHaveClass('shrink-0', 'h-6', 'w-6', 'text-primary');
  });
});
