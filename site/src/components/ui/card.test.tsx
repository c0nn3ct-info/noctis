import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
} from './card';

describe('Card', () => {
  it('renders every slot with its classes', () => {
    render(
      <Card data-testid="card">
        <CardHeader data-testid="header">
          <CardTitle data-testid="title">Title</CardTitle>
          <CardDescription data-testid="desc">Description</CardDescription>
        </CardHeader>
        <CardContent data-testid="content">Body</CardContent>
        <CardFooter data-testid="footer">Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId('card')).toHaveClass('bg-surface-container-low', 'shadow-e1', 'p-5');
    expect(screen.getByTestId('header')).toHaveClass('flex', 'flex-col', 'gap-1');
    expect(screen.getByTestId('title')).toHaveClass('text-title-medium');
    expect(screen.getByTestId('desc')).toHaveClass('text-on-surface-variant');
    expect(screen.getByTestId('content')).toHaveClass('mt-4');
    expect(screen.getByTestId('footer')).toHaveClass('mt-4', 'flex');
  });

  it('applies variant, padding and custom classes', () => {
    render(
      <Card variant="outlined" padding="none" className="w-40" data-testid="card">
        x
      </Card>,
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-outline', 'w-40');
    expect(card).not.toHaveClass('p-5');
  });

  it('forwards refs on every slot', () => {
    const refs = {
      card: createRef<HTMLDivElement>(),
      header: createRef<HTMLDivElement>(),
      title: createRef<HTMLDivElement>(),
      desc: createRef<HTMLDivElement>(),
      content: createRef<HTMLDivElement>(),
      footer: createRef<HTMLDivElement>(),
    };
    render(
      <Card ref={refs.card}>
        <CardHeader ref={refs.header} className="gap-2">
          <CardTitle ref={refs.title} className="text-lg">
            t
          </CardTitle>
          <CardDescription ref={refs.desc} className="italic">
            d
          </CardDescription>
        </CardHeader>
        <CardContent ref={refs.content} className="mt-2">
          c
        </CardContent>
        <CardFooter ref={refs.footer} className="justify-end">
          f
        </CardFooter>
      </Card>,
    );
    for (const ref of Object.values(refs)) {
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    }
  });

  it('exposes the cva helper', () => {
    expect(cardVariants({ variant: 'tonal', padding: 'lg' })).toContain('bg-primary-container');
    expect(cardVariants({ variant: 'filled' })).toContain('bg-surface-container-high');
    expect(cardVariants({ variant: 'accent', padding: 'sm' })).toContain('bg-dir-container');
  });

  it('lets a card title be a real heading', () => {
    render(<CardTitle as="h2">Before you start</CardTitle>);
    expect(
      screen.getByRole('heading', { name: 'Before you start', level: 2 }),
    ).toBeInTheDocument();
  });
});
