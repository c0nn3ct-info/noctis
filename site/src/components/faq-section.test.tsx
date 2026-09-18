import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FAQ_KEYS, FaqList, FaqSection } from './faq-section';
import { setLocale, t } from '../i18n';
import en from '../i18n/en.json';

afterEach(() => setLocale('en'));

describe('FaqList', () => {
  it('boxes the rows by default, the way the home page has always shown them', () => {
    const { container } = render(<FaqList />);

    const list = container.firstElementChild as HTMLElement;
    expect(list).toHaveClass('border', 'border-outline-variant', 'bg-surface-container-low');
    expect(container.querySelectorAll('details')).toHaveLength(FAQ_KEYS.length);
  });

  it('drops the box for a page that frames the rows itself', () => {
    const { container } = render(<FaqList variant="flush" />);

    const list = container.firstElementChild as HTMLElement;
    expect(list).toHaveClass('divide-y');
    expect(list).not.toHaveClass('border-outline-variant');
    // Hover only: the press and focus fills linger on a bare background and
    // read as a selected band.
    expect(container.querySelector('summary')).toHaveClass('m3-hover-layer');
    expect(container.querySelector('summary')).not.toHaveClass('m3-state-layer');
    // Without the state layer's focus fill the row would fall back to the
    // browser's own blue outline, which is the one focus ring on the page that
    // is not the site's.
    expect(container.querySelector('summary')).toHaveClass('focus-visible:ring-ring');
  });

  it('leaves every row closed unless asked to open the first', () => {
    const closed = render(<FaqList />).container.querySelectorAll('details');
    for (const d of closed) expect(d.open).toBe(false);

    const opened = render(<FaqList openFirst />).container.querySelectorAll('details');
    expect(opened[0].open).toBe(true);
    for (const d of Array.from(opened).slice(1)) expect(d.open).toBe(false);
  });
});

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
