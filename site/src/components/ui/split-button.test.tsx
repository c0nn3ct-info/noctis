import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitButton, SplitButtonAction, SplitButtonCaret } from './split-button';

describe('SplitButton', () => {
  it('renders a group with an action and a caret at the default size', () => {
    render(
      <SplitButton>
        <SplitButtonAction>Add</SplitButtonAction>
        <SplitButtonCaret aria-label="More" />
      </SplitButton>,
    );

    const group = screen.getByRole('group');
    expect(group).toHaveClass('h-10');

    const action = screen.getByRole('button', { name: 'Add' });
    expect(action).toHaveAttribute('type', 'button');
    expect(action).toHaveClass('bg-primary', 'px-5');

    const caret = screen.getByRole('button', { name: 'More' });
    expect(caret).toHaveClass('w-10', 'rounded-r-pill');
    expect(caret.querySelector('svg')).not.toBeNull();
  });

  it('passes variant and size down through context', () => {
    render(
      <SplitButton variant="outlined" size="m" className="mt-2">
        <SplitButtonAction>Action</SplitButtonAction>
        <SplitButtonCaret>▾</SplitButtonCaret>
      </SplitButton>,
    );

    expect(screen.getByRole('group')).toHaveClass('h-14', 'mt-2');
    expect(screen.getByRole('button', { name: 'Action' })).toHaveClass('border-outline', 'px-7');
    const caret = screen.getByRole('button', { name: '▾' });
    expect(caret).toHaveClass('w-14');
    expect(caret.querySelector('svg')).toBeNull();
  });

  it('falls back to the small size when size is null', () => {
    render(
      <SplitButton size={null} variant="elevated">
        <SplitButtonAction className="uppercase">A</SplitButtonAction>
        <SplitButtonCaret className="ps-0" aria-label="C" />
      </SplitButton>,
    );
    expect(screen.getByRole('button', { name: 'A' })).toHaveClass('px-5', 'uppercase');
    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('w-10', 'ps-0');
  });

  it('uses the xs size and honours explicit button types', async () => {
    const onClick = vi.fn();
    render(
      <SplitButton size="xs" variant="filled-tonal">
        <SplitButtonAction type="submit" onClick={onClick}>
          Submit
        </SplitButtonAction>
        <SplitButtonCaret type="reset" aria-label="Reset" />
      </SplitButton>,
    );
    const action = screen.getByRole('button', { name: 'Submit' });
    expect(action).toHaveAttribute('type', 'submit');
    expect(action).toHaveClass('px-3');
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveAttribute('type', 'reset');
    await userEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders segments outside a group with the context defaults', () => {
    render(
      <>
        <SplitButtonAction>Solo</SplitButtonAction>
        <SplitButtonCaret aria-label="Solo caret" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveClass('bg-primary', 'px-5');
    expect(screen.getByRole('button', { name: 'Solo caret' })).toHaveClass('w-10');
  });

  it('forwards refs', () => {
    const group = createRef<HTMLDivElement>();
    const action = createRef<HTMLButtonElement>();
    const caret = createRef<HTMLButtonElement>();
    render(
      <SplitButton ref={group}>
        <SplitButtonAction ref={action}>A</SplitButtonAction>
        <SplitButtonCaret ref={caret} aria-label="C" />
      </SplitButton>,
    );
    expect(group.current).toBeInstanceOf(HTMLDivElement);
    expect(action.current).toBeInstanceOf(HTMLButtonElement);
    expect(caret.current).toBeInstanceOf(HTMLButtonElement);
  });
});
