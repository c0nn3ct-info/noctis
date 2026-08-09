import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AmbientWave } from './ambient-wave';

function paths(container: HTMLElement) {
  const [area, line] = Array.from(container.querySelectorAll('svg > path'));
  return { area: area.getAttribute('d') ?? '', line: line.getAttribute('d') ?? '' };
}

describe('AmbientWave', () => {
  it('renders nothing for fewer than two samples', () => {
    expect(render(<AmbientWave points={[]} max={100} />).container).toBeEmptyDOMElement();
    expect(render(<AmbientWave points={[5]} max={100} />).container).toBeEmptyDOMElement();
  });

  it('draws a closed area plus the stroked line', () => {
    const { container } = render(<AmbientWave points={[100, 400, 900, 1600]} max={1600} />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg).toHaveAttribute('viewBox', '0 0 320 120');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'none');
    expect(svg).toHaveAttribute('aria-hidden');

    const { area, line } = paths(container);
    // sqrt(100)/sqrt(1600) * (120 * 0.84) = 25.2 above the baseline
    expect(line.startsWith('M0.0 94.8')).toBe(true);
    expect(line.split('C')).toHaveLength(4);
    expect(area).toBe(`${line} L320.0 120 L0 120 Z`);
  });

  it('scales by the square root of the peak and pads the top', () => {
    const { container } = render(<AmbientWave points={[0, 10_000]} max={10_000} />);
    const { line } = paths(container);
    // Last point sits at the peak: VH - usableH = 120 - 120*0.84 = 19.2
    expect(line.endsWith('320.0 19.2')).toBe(true);
    expect(line.startsWith('M0.0 120.0')).toBe(true);
  });

  it('emits an empty line when the projection yields fewer than two coords', () => {
    // `points.length < 2` is already screened out above, so the path builder's
    // own guard only fires if the projection itself comes back short. Hand it a
    // list whose map() does exactly that.
    const points = [100, 400];
    Object.defineProperty(points, 'map', { value: () => [] });

    const { container } = render(<AmbientWave points={points} max={400} />);
    const { area, line } = paths(container);
    expect(line).toBe('');
    expect(area).toBe(' L320.0 120 L0 120 Z');
  });

  it('handles a zero peak and clamps negative samples to the baseline', () => {
    const { container } = render(<AmbientWave points={[-50, 0]} max={0} />);
    const { line } = paths(container);
    expect(line).toBe('M0.0 120.0 C64.0 120.0 256.0 120.0 320.0 120.0');
  });

  it('gives each instance its own gradient id and merges classes', () => {
    const first = render(<AmbientWave points={[1, 2]} max={2} className="h-full" />);
    const second = render(<AmbientWave points={[1, 2]} max={2} />);

    const svg = first.container.querySelector('svg') as SVGSVGElement;
    expect(svg).toHaveClass('h-full');
    expect(svg.className.baseVal).toContain('mask-image');

    const idA = first.container.querySelector('linearGradient')?.id ?? '';
    const idB = second.container.querySelector('linearGradient')?.id ?? '';
    expect(idA).not.toBe('');
    expect(idA).not.toContain(':');
    expect(idA).not.toBe(idB);
    expect(first.container.querySelector('path')?.getAttribute('fill')).toBe(`url(#${idA})`);
  });
});
