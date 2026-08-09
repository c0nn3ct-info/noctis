import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('DropdownMenu', () => {
  it('renders label, items, separator and checkbox items when open', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Cores</DropdownMenuLabel>
          <DropdownMenuItem>Plain</DropdownMenuItem>
          <DropdownMenuItem inset className="text-xs">
            Inset
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>On</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>Off</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByText('Cores')).toHaveClass('uppercase');
    expect(screen.getByRole('menuitem', { name: 'Plain' })).not.toHaveClass('ps-9');
    expect(screen.getByRole('menuitem', { name: 'Inset' })).toHaveClass('ps-9', 'text-xs');
    expect(screen.getByRole('separator')).toHaveClass('bg-outline-variant');

    const on = screen.getByRole('menuitemcheckbox', { name: 'On' });
    const off = screen.getByRole('menuitemcheckbox', { name: 'Off' });
    expect(on).toHaveAttribute('data-state', 'checked');
    expect(off).toHaveAttribute('data-state', 'unchecked');
    // Only the checked item renders the indicator glyph.
    expect(on.querySelector('svg')).not.toBeNull();
    expect(off.querySelector('svg')).toBeNull();
  });

  it('accepts custom classes and an explicit side offset', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={12} className="min-w-[20rem]" align="start">
          <DropdownMenuLabel className="tracking-wide">L</DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuCheckboxItem checked className="font-mono">
            Mono
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByRole('menu')).toHaveClass('min-w-[20rem]');
    expect(screen.getByText('L')).toHaveClass('tracking-wide');
    expect(screen.getByRole('separator')).toHaveClass('my-2');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Mono' })).toHaveClass('font-mono');
  });

  it('opens from the trigger and fires item handlers', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onSelect = vi.fn();
    const onCheckedChange = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Pick</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
            Toggle
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Toggle' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pick' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('forwards refs to the underlying primitives', () => {
    const content = createRef<HTMLDivElement>();
    const item = createRef<HTMLDivElement>();
    const separator = createRef<HTMLDivElement>();
    const label = createRef<HTMLDivElement>();
    const checkbox = createRef<HTMLDivElement>();
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent ref={content}>
          <DropdownMenuLabel ref={label}>L</DropdownMenuLabel>
          <DropdownMenuItem ref={item}>I</DropdownMenuItem>
          <DropdownMenuSeparator ref={separator} />
          <DropdownMenuCheckboxItem ref={checkbox} checked>
            C
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    for (const ref of [content, item, separator, label, checkbox]) {
      expect(ref.current).toBeInstanceOf(HTMLElement);
    }
  });
});
