import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Layout } from './layout';
import { CONTACT_MAILTO, GITHUB_URL, ORG_SITE } from './constants';
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

    // The lockup: the product, then the org that made it.
    const org = within(header).getByRole('link', { name: 'c0nn3ct.info' });
    expect(org).toHaveAttribute('href', ORG_SITE);
    expect(org).toHaveAttribute('target', '_blank');

    // Header actions: the GitHub link and the language switcher.
    expect(within(header).getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
    expect(
      within(header).getByRole('button', { name: t('nav.lang_switch_aria') }),
    ).toBeInTheDocument();

    expect(within(screen.getByRole('main')).getByTestId('page')).toBeInTheDocument();
    // The footer echoes the lockup in place of the old "by c0nn3ct.info" byline.
    expect(within(footer()).getByRole('link', { name: 'c0nn3ct.info' })).toHaveAttribute(
      'href',
      ORG_SITE,
    );
    expect(within(footer()).getByText(t('home.description'))).toBeInTheDocument();
  });

  it('lays the footer out as a brand block and three link columns', () => {
    render(<Layout current="install">x</Layout>);
    const links = within(footer()).getAllByRole('link');

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      // Brand block: the product, then the org that made it.
      '/',
      ORG_SITE,
      // Product.
      '/',
      '/install/',
      // Resources.
      '/privacy/',
      '/license/',
      // Contacts. One repository holds both halves of the product, so one link
      // reaches the site and the helper alike.
      GITHUB_URL,
      CONTACT_MAILTO,
      // Every locale of *this* page, as markup a crawler can follow.
      '/install/',
      '/ru/install/',
      '/es/install/',
      '/zh-CN/install/',
      '/fa/install/',
      '/ar/install/',
    ]);
    expect(links.slice(2, 8).map((a) => a.textContent)).toEqual([
      t('footer.home'),
      t('nav.install'),
      t('nav.privacy'),
      t('nav.license'),
      'GitHub',
      'help@c0nn3ct.info',
    ]);
    expect(links.slice(8).map((a) => a.getAttribute('hreflang'))).toEqual([
      'en',
      'ru',
      'es',
      'zh-CN',
      'fa',
      'ar',
    ]);
    for (const external of [links[1], links[6]]) {
      expect(external).toHaveAttribute('target', '_blank');
      expect(external).toHaveAttribute('rel', 'noreferrer noopener');
    }
    // A mail link opens a client, not a tab.
    expect(links[7]).not.toHaveAttribute('target');

    for (const column of ['footer.product', 'footer.resources', 'footer.contacts']) {
      expect(within(footer()).getByRole('navigation', { name: t(column) })).toBeInTheDocument();
      expect(within(footer()).getByText(t(column))).toBeInTheDocument();
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

    // Two lockups, header and footer, both pointing at the localised home.
    for (const home of screen.getAllByRole('link', { name: t('nav.home_aria') })) {
      expect(home).toHaveAttribute('href', '/ru/');
    }
    expect(
      within(footer())
        .getAllByRole('link')
        .slice(2, 6)
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/ru/', '/ru/install/', '/ru/privacy/', '/ru/license/']);
    expect(
      within(footer()).getByRole('navigation', { name: t('footer.languages') }),
    ).toBeInTheDocument();
    // The language links leave the active locale for the target one.
    expect(
      within(footer())
        .getAllByRole('link')
        .slice(8)
        .map((a) => a.getAttribute('href')),
    ).toEqual([
      '/privacy/',
      '/ru/privacy/',
      '/es/privacy/',
      '/zh-CN/privacy/',
      '/fa/privacy/',
      '/ar/privacy/',
    ]);
  });

  it('hands the page its own width when the page bleeds', () => {
    const { rerender } = render(<Layout current="home">x</Layout>);
    // A reading page stands in the band column and keeps its measure in a
    // centred block inside it, so both gutters are the column's own.
    const main = () => screen.getByRole('main');
    expect(main().className).toContain('max-w-[1160px]');
    expect(main().firstElementChild!.className).toContain('mx-auto');
    expect(main().firstElementChild!.className).toContain('max-w-5xl');
    // and the footer closes exactly that measure
    expect(footer().className).toContain('max-w-[1160px]');
    expect(footer().firstElementChild!.className).toContain('max-w-5xl');

    rerender(
      <Layout current="home" bleed>
        x
      </Layout>,
    );
    // A bleeding page lays itself out; the footer keeps the band width either
    // way, and drops the reading measure so its rule closes the whole band.
    expect(main().className).not.toContain('max-w-[1160px]');
    expect(main().firstElementChild).toBeNull();
    expect(footer().className).toContain('max-w-[1160px]');
    expect(footer().firstElementChild!.className).not.toContain('max-w-5xl');
  });
});
