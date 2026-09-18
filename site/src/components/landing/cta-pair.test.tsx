import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CtaPair } from './cta-pair';
import { WEBSTORE_URL } from '@/constants';
import { setLocale, t } from '@/i18n';

afterEach(() => {
  setLocale('en');
  vi.restoreAllMocks();
});

describe('CtaPair', () => {

  it('stacks the pair at one width on a phone, the way aria2t’s hero does', () => {
    const { container } = render(<CtaPair />);

    // Wrapped, the two came out at different widths on separate lines, which
    // reads as a layout that ran out of room rather than as a choice between
    // two things. Stretched, they are one block until there is room for a row.
    expect(container.firstElementChild).toHaveClass(
      'flex-col',
      'items-stretch',
      'sm:flex-row',
      'sm:items-center',
    );
  });
  it('sends Install to the guide and the second button to the store', () => {
    render(<CtaPair />);

    const [install, store] = screen.getAllByRole('link');
    expect(install).toHaveTextContent(t('home.cta.install'));
    expect(install).toHaveAttribute('href', '/install/');
    expect(store).toHaveTextContent(t('home.cta.webstore'));
    expect(store).toHaveAttribute('href', WEBSTORE_URL);
  });

  it('names the store and marks it as leaving the page', () => {
    const { container } = render(<CtaPair />);
    const store = screen.getAllByRole('link')[1];

    // The Chrome mark and the external-link arrow, the way the aria2t hero
    // draws it: the icon says where it goes, the arrow says it leaves.
    expect(store).toHaveAttribute('target', '_blank');
    expect(store).toHaveAttribute('rel', 'noreferrer noopener');
    expect(store.querySelectorAll('svg')).toHaveLength(2);
    expect(container.querySelector('.lucide-chrome')).not.toBeNull();
    expect(container.querySelector('.lucide-external-link')).not.toBeNull();
  });

  it('stands both buttons at the same height', () => {
    render(<CtaPair />);

    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('h-12');
  });

  it('keeps the guide inside the reader’s own locale', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLocale('ru');
    render(<CtaPair />);

    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/ru/install/');
  });

  it('turns the arrow around for a right-to-left reader', () => {
    const { container } = render(<CtaPair />);

    expect(container.querySelector('.rtl\\:-scale-x-100')).toBeInTheDocument();
  });

  it('carries no "soon" badge — the listing is live', () => {
    render(<CtaPair />);

    expect(screen.queryByText(/soon/i)).toBeNull();
  });
});
