import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LicensePage } from './license';
import { setLocale, t } from '../i18n';

afterEach(() => setLocale('en'));

describe('LicensePage', () => {
  it('leads with the three licenses Noctis ships under', () => {
    render(<LicensePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('license.h1'));
    expect(screen.getByText(t('license.last_updated'))).toBeInTheDocument();
    expect(screen.getByText(t('license.intro'))).toBeInTheDocument();

    const summary = screen.getAllByRole('listitem').slice(0, 3);
    expect(summary.map((li) => li.textContent)).toEqual([
      `${t('license.item1.b')}${t('license.item1.body')}`,
      `${t('license.item2.b')}${t('license.item2.body')}`,
      `${t('license.item3.b')}${t('license.item3.body')}`,
    ]);
  });

  it('spells out every clause of the extension EULA', () => {
    render(<LicensePage />);

    expect(screen.getByRole('heading', { name: t('license.eula.h2'), level: 3 })).toBeInTheDocument();
    expect(screen.getByText(t('license.eula.copyright'))).toBeInTheDocument();
    expect(screen.getByText(t('license.eula.preamble'))).toBeInTheDocument();

    for (const clause of ['grant', 'restrictions', 'warranty', 'liability', 'termination', 'law']) {
      expect(
        screen.getByRole('heading', { name: t(`license.eula.${clause}.h3`), level: 3 }),
      ).toBeInTheDocument();
    }
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByText(t(`license.eula.restrictions.item${n}`))).toBeInTheDocument();
    }
  });

  it('credits the MIT helper and the upstream engine licenses', () => {
    render(<LicensePage />);

    expect(screen.getByText(t('license.helper.h3'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('license.helper.body_link') })).toHaveAttribute(
      'href',
      'https://github.com/c0nn3ct-info/noctis',
    );

    expect(screen.getByText(t('license.engines.h3'))).toBeInTheDocument();
    expect(screen.getByText(t('license.engines.intro'))).toBeInTheDocument();

    const engines: [string, string, string][] = [
      ['sing-box', 'https://github.com/SagerNet/sing-box', 'sing-box — GPL-3.0'],
      ['xray-core', 'https://github.com/XTLS/Xray-core', 'xray-core — MPL-2.0'],
      ['mihomo', 'https://github.com/MetaCubeX/mihomo', 'mihomo — GPL-3.0'],
    ];
    for (const [name, href, row] of engines) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link.closest('li')).toHaveTextContent(row);
    }
  });

  it('renders inside the shared layout and follows the active locale', () => {
    setLocale('es');
    const { container } = render(<LicensePage />);
    const header = container.querySelector('header') as HTMLElement;
    expect(within(header).getByRole('link', { name: t('nav.home_aria') })).toHaveAttribute(
      'href',
      '/es/',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('license.h1'));
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
