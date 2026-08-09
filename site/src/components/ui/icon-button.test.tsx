import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconButton, iconButtonVariants } from './icon-button';

describe('IconButton', () => {
  it('renders a round standard button by default', () => {
    render(<IconButton aria-label="Menu" />);
    const btn = screen.getByRole('button', { name: 'Menu' });
    expect(btn).toHaveClass('bg-transparent', 'h-10', 'rounded-pill');
  });

  it('renders the child element when asChild is set', () => {
    render(
      <IconButton asChild variant="filled" size="m">
        <a href="https://example.com" aria-label="Out" />
      </IconButton>,
    );
    const link = screen.getByRole('link', { name: 'Out' });
    expect(link).toHaveClass('bg-primary', 'h-14');
  });

  it('applies square compound variants and custom classes', () => {
    render(
      <IconButton shape="square" size="xl" variant="outlined" className="ms-2" aria-label="Sq" />,
    );
    const btn = screen.getByRole('button', { name: 'Sq' });
    expect(btn).toHaveClass('rounded-3xl', 'border-outline', 'ms-2');
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} aria-label="Ref" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('exposes the cva helper', () => {
    expect(iconButtonVariants({ variant: 'filled-tonal', size: 'xs' })).toContain(
      'bg-secondary-container',
    );
    expect(iconButtonVariants({ shape: 'square', size: 'l' })).toContain('rounded-2xl');
    expect(iconButtonVariants({ shape: 'square', size: 's' })).toContain('rounded-md');
  });
});
