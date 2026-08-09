import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FaqSection } from './faq-section';
import { setLocale, t } from '../i18n';
import en from '../i18n/en.json';

afterEach(() => setLocale('en'));

describe('FaqSection', () => {
  it('renders one collapsed <details> per FAQ entry', () => {
    const { container } = render(<FaqSection />);
    expect(screen.getByRole('heading', { name: en['home.faq.h2'], level: 2 })).toBeInTheDocument();

    const items = container.querySelectorAll('details');
    expect(items).toHaveLength(10);
    for (const item of items) expect(item.open).toBe(false);

    expect(screen.getByText(en['home.faq.what.q'])).toBeInTheDocument();
    expect(screen.getByText(en['home.faq.cost.a'])).toBeInTheDocument();
  });

  it('is anchored for in-page links', () => {
    const { container } = render(<FaqSection />);
    expect(container.querySelector('section')).toHaveAttribute('id', 'faq');
  });

  it('follows the active locale', () => {
    setLocale('ru');
    render(<FaqSection />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(t('home.faq.h2'));
  });
});
