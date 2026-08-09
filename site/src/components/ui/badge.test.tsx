import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeVariants } from './badge';

describe('Badge', () => {
  it('renders a span with the default variant and size', () => {
    render(<Badge>New</Badge>);
    const el = screen.getByText('New');
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('bg-secondary-container', 'h-6');
  });

  it('applies variant, size and extra classes', () => {
    render(
      <Badge variant="outline" size="sm" className="font-mono" data-testid="b">
        VLESS
      </Badge>,
    );
    const el = screen.getByTestId('b');
    expect(el).toHaveClass('border-outline-variant', 'h-5', 'font-mono');
  });

  it('exposes the cva helper', () => {
    expect(badgeVariants({ variant: 'success' })).toContain('bg-success-container');
    expect(badgeVariants()).toContain('bg-secondary-container');
  });
});
