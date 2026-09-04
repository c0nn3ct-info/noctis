import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Layout } from './layout';
import { setLocale, t } from './i18n';

afterEach(() => setLocale('en'));

function footer() {
  return screen.getByRole('contentinfo');
}

describe('Layout', () => {
  it('frames the page with a branded header, the children and a footer', () => {
    render(
      <Layout current="home">
        <p data-testid="page">Page body</p>
      </Layout>,
    );

    const header = screen.getByRole('banner');
    const home = within(header).getByRole('link', { name: t('nav.home_aria') });
    expect(home).toHaveAttribute('href', '/');
    expect(home.querySelector('svg')).not.toBeNull();
    expect(within(header).getByText('Noctis')).toBeInTheDocument();

    // Header actions: the GitHub link and the language switcher.
    expect(within(header).getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(
      within(header).getByRole('button', { name: t('nav.lang_switch_aria') }),
    ).toBeInTheDocument();

    expect(within(screen.getByRole('main')).getByTestId('page')).toBeInTheDocument();
    const by = within(footer()).getByRole('link', { name: 'c0nn3ct.info' });
    expect(by).toHaveAttribute('href', 'https://c0nn3ct.info');
    expect(by.parentElement).toHaveTextContent(`${t('footer.by')} c0nn3ct.info`);
  });

  it('links every page and both source repos from the footer', () => {
    render(<Layout current="install">x</Layout>);
    const links = within(footer()).getAllByRole('link');

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      // The by-line: the org that made Noctis, not the product site.
      'https://c0nn3ct.info',
      '/',
      '/install/',
      '/privacy/',
      '/license/',
      // Two labels, two destinations: they used to resolve to the same page.
      'https://github.com/c0nn3ct-info/noctis/tree/main/site',
      'https://github.com/c0nn3ct-info/noctis/tree/main/host',
      // Every locale of *this* page, as markup a crawler can follow.
      '/install/',
      '/ru/install/',
      '/es/install/',
      '/zh-CN/install/',
      '/fa/install/',
      '/ar/install/',
    ]);
    expect(links.slice(1, 7).map((a) => a.textContent)).toEqual([
      t('footer.home'),
      t('nav.install'),
      t('nav.privacy'),
      t('nav.license'),
      t('footer.site'),
      t('footer.helper'),
    ]);
    expect(links.slice(7).map((a) => a.getAttribute('hreflang'))).toEqual([
      'en',
      'ru',
      'es',
      'zh-CN',
      'fa',
      'ar',
    ]);
    for (const external of links.slice(5, 7)) {
      expect(external).toHaveAttribute('target', '_blank');
      expect(external).toHaveAttribute('rel', 'noreferrer noopener');
    }
  });

  it('marks the current page and offers a skip link', () => {
    render(<Layout current="privacy">x</Layout>);

    // Footer and header agree on which page is current.
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current.length).toBeGreaterThanOrEqual(1);
    for (const link of current) expect(link).toHaveAttribute('href', '/privacy/');

    const skip = screen.getByRole('link', { name: t('nav.skip') });
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('prefixes every internal link with the active locale', () => {
    setLocale('ru');
    render(<Layout current="privacy">x</Layout>);

    expect(screen.getByRole('link', { name: t('nav.home_aria') })).toHaveAttribute('href', '/ru/');
    expect(
      within(footer())
        .getAllByRole('link')
        .slice(1, 5)
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/ru/', '/ru/install/', '/ru/privacy/', '/ru/license/']);
    expect(within(footer()).getByText(t('footer.pages'))).toBeInTheDocument();
    expect(within(footer()).getByText(t('footer.sources'))).toBeInTheDocument();
    expect(
      within(footer()).getByRole('navigation', { name: t('footer.languages') }),
    ).toBeInTheDocument();
    // The language links leave the active locale for the target one.
    expect(
      within(footer())
        .getAllByRole('link')
        .slice(7)
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/privacy/', '/ru/privacy/', '/es/privacy/', '/zh-CN/privacy/', '/fa/privacy/', '/ar/privacy/']);
  });
});
