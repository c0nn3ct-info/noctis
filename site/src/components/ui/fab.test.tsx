import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtendedFab, Fab, extendedFabVariants, fabVariants } from './fab';

describe('Fab', () => {
  it('renders a regular primary FAB by default', () => {
    render(<Fab aria-label="Connect" />);
    const btn = screen.getByRole('button', { name: 'Connect' });
    expect(btn).toHaveClass('bg-primary-container', 'h-14', 'rounded-2xl');
  });

  it('applies color, size and custom classes', () => {
    render(<Fab color="success" size="small" className="shadow-none" aria-label="Go" />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(
      'bg-success-container',
      'h-10',
      'shadow-none',
    );
  });

  it('renders the child element when asChild is set', () => {
    render(
      <Fab asChild size="large" color="error">
        <a href="/x" aria-label="Link fab" />
      </Fab>,
    );
    expect(screen.getByRole('link', { name: 'Link fab' })).toHaveClass('h-24', 'bg-error-container');
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Fab ref={ref} aria-label="Ref" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('ExtendedFab', () => {
  it('renders a labelled FAB', () => {
    render(<ExtendedFab>Connect</ExtendedFab>);
    expect(screen.getByRole('button', { name: 'Connect' })).toHaveClass(
      'bg-primary-container',
      'h-14',
    );
  });

  it('applies color, custom classes and asChild', () => {
    render(
      <ExtendedFab color="tertiary" className="w-full">
        Tonal
      </ExtendedFab>,
    );
    expect(screen.getByRole('button', { name: 'Tonal' })).toHaveClass(
      'bg-tertiary-container',
      'w-full',
    );

    render(
      <ExtendedFab asChild color="surface">
        <a href="/y">Linked</a>
      </ExtendedFab>,
    );
    expect(screen.getByRole('link', { name: 'Linked' })).toHaveClass('bg-surface-container-high');
  });

  it('forwards refs', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<ExtendedFab ref={ref}>R</ExtendedFab>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('variant helpers', () => {
  it('expose the cva builders', () => {
    expect(fabVariants({ color: 'secondary', size: 'small' })).toContain('bg-secondary-container');
    expect(fabVariants()).toContain('bg-primary-container');
    expect(extendedFabVariants({ color: 'error' })).toContain('bg-error-container');
    expect(extendedFabVariants()).toContain('bg-primary-container');
  });
});
