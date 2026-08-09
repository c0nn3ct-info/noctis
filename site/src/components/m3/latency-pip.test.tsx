import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LatencyPip } from './latency-pip';

describe('LatencyPip', () => {
  it('shows a neutral dash when there is no measurement', () => {
    render(<LatencyPip />);
    const el = screen.getByText('—');
    expect(el).toHaveClass('bg-surface-container-high');
    expect(el.querySelector('span')).toHaveClass('bg-outline');
  });

  it('treats a null latency as unknown', () => {
    render(<LatencyPip ms={null} />);
    expect(screen.getByText('—')).toHaveClass('bg-surface-container-high');
  });

  it('shows a spinner and hides the dot while pending', () => {
    const { container } = render(<LatencyPip pending />);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
    expect(container.querySelectorAll('span > span')).toHaveLength(0);
  });

  it('prefers pending over failed and over a number', () => {
    const { container } = render(<LatencyPip pending failed ms={12} />);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
    expect(container.textContent).toBe('');
  });

  it('renders the failure state', () => {
    render(<LatencyPip failed ms={12} />);
    const el = screen.getByText('fail');
    expect(el).toHaveClass('bg-error-container');
    expect(el.querySelector('span')).toHaveClass('bg-error');
  });

  it.each([
    [23, 'bg-success-container', 'bg-success'],
    [999, 'bg-success-container', 'bg-success'],
    [1000, 'bg-warning-container', 'bg-warning'],
    [1999, 'bg-warning-container', 'bg-warning'],
    [2000, 'bg-error-container', 'bg-error'],
    [5000, 'bg-error-container', 'bg-error'],
  ])('colours %dms by threshold', (ms, tone, dot) => {
    render(<LatencyPip ms={ms} />);
    const el = screen.getByText(`${ms}ms`);
    expect(el).toHaveClass(tone);
    expect(el.querySelector('span')).toHaveClass(dot);
  });

  it('merges a custom className', () => {
    render(<LatencyPip ms={10} className="ms-2" />);
    expect(screen.getByText('10ms')).toHaveClass('ms-2');
  });
});
