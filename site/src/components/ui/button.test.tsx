import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renders a button with the default variant/size/shape', () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn).toHaveClass('bg-primary', 'h-10');
  });

  it('renders the child element when asChild is set', () => {
    render(
      <Button asChild variant="outlined" size="xs">
        <a href="/install/">Install</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Install' });
    expect(link).toHaveClass('border-outline', 'h-8');
  });

  it('merges compound variants and a custom className', () => {
    render(
      <Button variant="text" size="m" shape="square" className="w-full">
        Text
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Text' });
    expect(btn).toHaveClass('px-6', '!rounded-lg', 'w-full');
  });

  it('forwards refs and click handlers', async () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <Button ref={ref} onClick={onClick}>
        Tap
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    await userEvent.click(screen.getByRole('button', { name: 'Tap' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes the cva helper', () => {
    expect(buttonVariants({ variant: 'destructive', size: 'l' })).toContain('bg-error');
    expect(buttonVariants({ shape: 'round' })).toContain('bg-primary');
  });
});
