import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { NoctisLogo } from './noctis-logo';

describe('NoctisLogo', () => {
  it('renders a decorative currentColor svg', () => {
    const { container } = render(<NoctisLogo />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).toHaveAttribute('viewBox', '295.9 122.9 736.1 736.1');
    expect(svg).toHaveClass('shrink-0');
  });

  it('carries the masks the artwork depends on', () => {
    const { container } = render(<NoctisLogo />);
    expect(container.querySelector('#noctis-logo-a')).not.toBeNull();
    expect(container.querySelector('#noctis-logo-b')).not.toBeNull();
    expect(container.querySelector('#noctis-logo-f')).not.toBeNull();
    expect(container.querySelector('#noctis-logo-s')).not.toBeNull();
    expect(container.querySelectorAll('svg > path')).toHaveLength(3);
  });

  it('merges a custom className', () => {
    const { container } = render(<NoctisLogo className="h-6 w-6 text-primary" />);
    expect(container.querySelector('svg')).toHaveClass('shrink-0', 'h-6', 'w-6', 'text-primary');
  });
});
