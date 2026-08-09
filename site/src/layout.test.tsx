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
    expect(within(footer()).getByText(t('footer.by'))).toBeInTheDocument();
  });

  it('links every page and both source repos from the footer', () => {
    render(<Layout current="install">x</Layout>);
    const links = within(footer()).getAllByRole('link');

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/install/',
      '/privacy/',
      '/license/',
      'https://github.com/c0nn3ct-info/noctis',
      'https://github.com/c0nn3ct-info/noctis',
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      t('footer.home'),
      t('nav.install'),
      t('nav.privacy'),
      t('nav.license'),
      t('footer.site'),
      t('footer.helper'),
    ]);
    for (const external of links.slice(4)) {
      expect(external).toHaveAttribute('target', '_blank');
      expect(external).toHaveAttribute('rel', 'noreferrer noopener');
    }
  });

  it('prefixes every internal link with the active locale', () => {
    setLocale('ru');
    render(<Layout current="privacy">x</Layout>);

    expect(screen.getByRole('link', { name: t('nav.home_aria') })).toHaveAttribute('href', '/ru/');
    expect(
      within(footer())
        .getAllByRole('link')
        .slice(0, 4)
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/ru/', '/ru/install/', '/ru/privacy/', '/ru/license/']);
    expect(within(footer()).getByText(t('footer.pages'))).toBeInTheDocument();
    expect(within(footer()).getByText(t('footer.sources'))).toBeInTheDocument();
  });
});
