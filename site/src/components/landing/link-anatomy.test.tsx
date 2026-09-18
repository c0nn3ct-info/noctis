import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkAnatomy } from './link-anatomy';
import { SAMPLE_LINK, parseShareLink } from './share-link';
import { t } from '@/i18n';

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll('[data-field]')) as HTMLElement[];
const field = () => screen.getByRole('textbox', { name: t('home.anatomy.input_aria') });

describe('LinkAnatomy', () => {
  it('opens on the sample link, already read out', () => {
    const { container } = render(<LinkAnatomy />);

    expect(field()).toHaveValue(SAMPLE_LINK);
    expect(rows(container)).toHaveLength(parseShareLink(SAMPLE_LINK).length);
    expect(screen.getByText('cdn.example.com')).toBeInTheDocument();
  });

  it('reads out whatever you paste instead', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('trojan://pw@relay.example.org:8443?type=ws');

    expect(screen.getByText('relay.example.org')).toBeInTheDocument();
    expect(screen.getByText('trojan')).toBeInTheDocument();
    expect(screen.queryByText('cdn.example.com')).not.toBeInTheDocument();
    expect(rows(container)).toHaveLength(5);
  });

  it('is a name, a leader and a value — no third column to run empty', () => {
    const { container } = render(<LinkAnatomy />);

    // Five of nine values used to be suppressed as duplicates of a raw-slice
    // chip, leaving the column four entries and five holes. The slice lives in
    // the field above; the ledger carries what it resolved to.
    for (const row of rows(container)) {
      expect(row.children).toHaveLength(3);
      expect(row.querySelector('dt')).not.toBeNull();
      expect(row.querySelector('[data-leader]')).not.toBeNull();
      expect(row.querySelector('dd')?.textContent).toBeTruthy();
    }
  });

  it('names every field the parser read, in its order', () => {
    const { container } = render(<LinkAnatomy />);
    const parsed = parseShareLink(SAMPLE_LINK);

    expect(rows(container).map((r) => r.querySelector('dt')?.textContent)).toEqual(
      parsed.map((f) => f.label),
    );
    expect(rows(container).map((r) => r.querySelector('dd')?.textContent)).toEqual(
      parsed.map((f) => f.value),
    );
  });

  it('tints the fields that decide how the tunnel is built', () => {
    const { container } = render(<LinkAnatomy />);

    expect(rows(container).map((r) => r.querySelector('dd')?.className.includes('text-tertiary-on-container'))).toEqual([
      true, false, true, false, true, false, false, true, false,
    ]);
  });

  it('counts what it read, rather than claiming it was pasted', () => {
    render(<LinkAnatomy />);

    expect(screen.getByText(t('home.anatomy.fields').replace('{n}', '9'))).toBeInTheDocument();
  });

  it('asks for a link when what it has is not one', async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkAnatomy />);

    await user.clear(field());
    await user.paste('not a link');

    expect(rows(container)).toHaveLength(0);
    expect(screen.getByText(t('home.anatomy.empty'))).toBeInTheDocument();
  });

  it('offers a way back to the sample, only once you have left it', async () => {
    const user = userEvent.setup();
    render(<LinkAnatomy />);

    expect(screen.queryByRole('button', { name: t('home.anatomy.reset') })).toBeNull();

    await user.clear(field());
    await user.paste('ss://h.example:8388');
    await user.click(screen.getByRole('button', { name: t('home.anatomy.reset') }));

    expect(field()).toHaveValue(SAMPLE_LINK);
    expect(screen.queryByRole('button', { name: t('home.anatomy.reset') })).toBeNull();
  });

  it('narrates no pipeline it is not performing', () => {
    const { container } = render(<LinkAnatomy />);

    // The foot used to carry paste / split into fields / engine picked. It
    // described what the reader was looking at, and nothing on this page picks
    // an engine.
    expect(container.querySelectorAll('[data-step]')).toHaveLength(0);
    expect(screen.queryByText(/engine picked/i)).toBeNull();
  });

  it('claims the caret and the highlight in its own field', () => {
    const { container } = render(<LinkAnatomy />);

    // Both ship as the browser's unless a palette takes them, which is the
    // cheapest tell that a surface was assembled rather than built.
    expect(container.firstElementChild).toHaveClass(
      'caret-tertiary',
      'selection:bg-tertiary-container',
      'selection:text-tertiary-on-container',
    );
  });

  it('shows the field’s focus as an indicator, not as a shade', () => {
    const { container } = render(<LinkAnatomy />);

    // The tint alone was the whole indicator, and one step of the container
    // ladder is about 6% of lightness — visible, but nowhere near the 3:1 an
    // indicator owes its surroundings (WCAG 2.4.11).
    const row = container.querySelector('[class*="focus-within"]') as HTMLElement;
    expect(row).toHaveClass('focus-within:ring-2', 'focus-within:ring-inset', 'focus-within:ring-ring');
  });

  it('gives the field a hit area a finger can land on', () => {
    render(<LinkAnatomy />);

    expect(field()).toHaveClass('py-3');
  });

  it('animates nothing of its own: the band’s entrance carries it', () => {
    const { container } = render(<LinkAnatomy />);

    for (const row of rows(container)) {
      expect(row.style.transform).toBe('');
      expect(row.style.getPropertyValue('--from')).toBe('');
    }
    expect(container.querySelector('[class*="link-cut"]')).toBeNull();
  });
});
