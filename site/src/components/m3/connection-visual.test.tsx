import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectionVisual, type ConnState } from './connection-visual';

function rings(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('div > span[class*="absolute"]'));
}

describe('ConnectionVisual', () => {
  it('renders three static rings and a breathing middle ring when idle', () => {
    const { container } = render(<ConnectionVisual state="idle" />);
    const [a, b, c] = rings(container);
    expect(a).toHaveClass('opacity-25');
    expect(b).toHaveClass('animate-breathe');
    expect(c).toHaveClass('opacity-25');
    for (const ring of [a, b, c]) {
      expect(ring.style.animationDelay).toBe('');
      expect(ring).toHaveClass('bg-outline/30');
    }
  });

  it.each<[ConnState, string, string, string]>([
    ['connecting', 'bg-primary/40', 'bg-primary-container', '1.6s'],
    ['connected', 'bg-success/35', 'bg-success', '3.2s'],
    ['error', 'bg-error/40', 'bg-error-container', '1.4s'],
  ])('pulses staggered rings when %s', (state, ringClass, coreClass, dur) => {
    const { container } = render(<ConnectionVisual state={state} />);
    const list = rings(container);
    expect(list).toHaveLength(3);
    const stagger = Number.parseFloat(dur) / 3;
    list.forEach((ring, i) => {
      expect(ring).toHaveClass('animate-pulse-ring', ringClass);
      expect(ring.style.animationDelay).toBe(`${i * stagger}s`);
    });

    const core = container.querySelector('span.relative') as HTMLElement;
    expect(core.className).toContain(coreClass);
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--pulse-dur')).toBe(dur);
  });

  it('sizes the wrapper, rings, core and glyph from the size prop', () => {
    const { container } = render(<ConnectionVisual state="connected" size={100} className="mx-1" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('mx-1');
    expect(root.style.width).toBe('100px');
    expect(root.style.height).toBe('100px');

    const ring = rings(container)[0];
    expect(ring.style.width).toBe('86px');

    const core = container.querySelector('span.relative') as HTMLElement;
    expect(core.style.width).toBe('70px');

    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('29');
    expect(svg.getAttribute('height')).toBe('29');
  });

  it('defaults to the large size', () => {
    const { container } = render(<ConnectionVisual state="idle" />);
    expect((container.firstChild as HTMLElement).style.width).toBe('188px');
  });
});
