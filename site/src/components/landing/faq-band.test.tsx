import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaqBand, mailtoAddress, repoLabel } from './faq-band';
import { FAQ_KEYS } from '@/components/faq-section';
import { CONTACT_MAILTO, GITHUB_URL } from '@/constants';
import { t } from '@/i18n';

describe('mailtoAddress', () => {
  it('strips the scheme, so the label is the address', () => {
    expect(mailtoAddress('mailto:help@c0nn3ct.info')).toBe('help@c0nn3ct.info');
    expect(mailtoAddress('help@c0nn3ct.info')).toBe('help@c0nn3ct.info');
  });
});

describe('repoLabel', () => {
  it('strips the scheme and any trailing slash', () => {
    expect(repoLabel('https://github.com/c0nn3ct-info/noctis')).toBe('github.com/c0nn3ct-info/noctis');
    expect(repoLabel('http://github.com/c0nn3ct-info/noctis/')).toBe('github.com/c0nn3ct-info/noctis');
  });
});

describe('FaqBand', () => {
  it('sets the questions beside the two ways to ask a new one', () => {
    render(<FaqBand />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(t('home.faq.h2'));
    expect(screen.getByText(t('home.faq.lede'))).toBeInTheDocument();
    expect(screen.getByText(t('home.faq.no_answer'))).toBeInTheDocument();
  });

  it('shows the questions as flush rows rather than a boxed card', () => {
    const { container } = render(<FaqBand />);

    expect(container.querySelectorAll('details')).toHaveLength(FAQ_KEYS.length);
    expect(container.querySelector('summary')).toHaveClass('m3-hover-layer');
  });

  it('opens the first answer', () => {
    const { container } = render(<FaqBand />);
    const rows = container.querySelectorAll('details');

    expect(rows[0].open).toBe(true);
    expect(rows[1].open).toBe(false);
  });

  it('reaches the repository and the mailbox, labelled by where they go', () => {
    render(<FaqBand />);

    const repo = screen.getByRole('link', { name: repoLabel(GITHUB_URL) });
    expect(repo).toHaveAttribute('href', GITHUB_URL);
    expect(repo).toHaveAttribute('target', '_blank');
    expect(repo).toHaveAttribute('rel', 'noreferrer noopener');

    expect(screen.getByRole('link', { name: mailtoAddress(CONTACT_MAILTO) })).toHaveAttribute(
      'href',
      CONTACT_MAILTO,
    );
  });

  it('closes on one Install button, run across the column', () => {
    render(<FaqBand />);

    const install = screen.getByRole('link', { name: t('home.cta.install') });
    expect(install).toHaveAttribute('href', '/install/');
    expect(install).toHaveClass('w-full');

    // The store link is already in the header, the footer and the hero; a
    // second button here made the column's last row a choice rather than a
    // next step.
    expect(screen.queryByRole('link', { name: t('home.cta.webstore') })).toBeNull();
  });

  it('keeps the address and the repo path left-to-right in an RTL locale', () => {
    const { container } = render(<FaqBand />);
    const ltr = Array.from(container.querySelectorAll('[dir="ltr"]')).map((n) => n.textContent);

    expect(ltr).toEqual([repoLabel(GITHUB_URL), mailtoAddress(CONTACT_MAILTO)]);
  });
});
