import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SURFACES, SurfaceSwitch } from './surface-switch';
import { t } from '@/i18n';

describe('SURFACES', () => {
  it('leads with the surface that exists', () => {
    expect(SURFACES).toEqual(['extension', 'terminal']);
  });
});

describe('SurfaceSwitch', () => {
  it('is a group of toggles, not a tablist — it swaps a mock, not a panel', () => {
    render(<SurfaceSwitch value="extension" />);

    expect(screen.getByRole('group', { name: t('home.popup.surface_aria') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extension/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the terminal client as coming, and says so in the label', () => {
    render(<SurfaceSwitch value="extension" />);

    const terminal = screen.getByRole('button', { name: /Terminal/ });
    expect(terminal).toHaveAccessibleName(
      `${t('home.popup.surface_terminal')} ${t('home.popup.surface_soon')}`,
    );
    expect(terminal).toHaveAttribute('aria-disabled', 'true');
    expect(terminal).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps the unavailable surface reachable, so its badge can be read', () => {
    render(<SurfaceSwitch value="extension" />);

    // `aria-disabled` rather than `disabled`: a disabled button drops out of
    // the tab order, and then the one thing worth knowing about it — that it
    // is coming — cannot be reached with a keyboard.
    expect(screen.getByRole('button', { name: /Terminal/ })).not.toBeDisabled();
  });

  it('does nothing when the surface that is not ready is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SurfaceSwitch value="extension" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Terminal/ }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Extension/ }));
    expect(onChange).toHaveBeenCalledWith('extension');
  });

  it('is inert but not broken with no handler, which is how the band uses it', async () => {
    const user = userEvent.setup();
    render(<SurfaceSwitch value="extension" />);

    // The band passes no `onChange` while one surface exists, so clicking the
    // pressed toggle must be a no-op rather than a call into nothing.
    await user.click(screen.getByRole('button', { name: /Extension/ }));
    expect(screen.getByRole('button', { name: /Extension/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('hovers on colour alone, like the rest of the page', async () => {
    render(<SurfaceSwitch value="extension" />);

    const terminal = screen.getByRole('button', { name: /Terminal/ });
    expect(terminal.className).toContain('transition-colors');
    expect(terminal.className).not.toContain('rounded-[');
  });

  it('is ready for the day the terminal ships', () => {
    // The one state the band cannot produce today: a surface that is
    // selectable but not pressed. When `SOON` empties this is what the
    // extension toggle becomes, so it carries the fill treatment already.
    render(<SurfaceSwitch value="terminal" />);

    const extension = screen.getByRole('button', { name: /Extension/ });
    expect(extension).toHaveAttribute('aria-pressed', 'false');
    expect(extension).toHaveClass('hover:bg-surface-container-high');
    expect(extension).not.toHaveClass('cursor-default');
  });

  it('gives every toggle a target a finger can land on', () => {
    render(<SurfaceSwitch value="extension" />);

    for (const b of screen.getAllByRole('button')) expect(b).toHaveClass('min-h-[44px]');
  });
});
