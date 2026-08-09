import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HomePage } from './home';
import { WEBSTORE_URL } from '../constants';
import { setLocale, t } from '../i18n';

const PROTOCOLS = [
  'VLESS',
  'VLESS Reality',
  'VMess',
  'Trojan',
  'Shadowsocks',
  'Hysteria/2',
  'TUIC',
  'WireGuard',
  'AnyTLS',
  'ShadowTLS',
];

const FEATURES = [
  'engine',
  'servers',
  'routing',
  'modes',
  'health',
  'pinned',
  'logs',
  'webrtc',
  'adblock',
];

/** Page content only - the shared layout footer repeats some of these labels. */
function main() {
  return within(screen.getByRole('main'));
}

beforeEach(() => {
  // The popup mock runs a 1s traffic ticker; keep it frozen and deterministic.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setLocale('en');
});

describe('HomePage', () => {
  it('renders the hero with both calls to action', () => {
    render(<HomePage />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(t('home.hero.h1'));
    expect(h1).toHaveTextContent(t('home.hero.h1_sub'));
    expect(screen.getByText(t('home.hero.lede'))).toBeInTheDocument();

    const install = main().getByRole('link', { name: t('home.hero.cta_install') });
    expect(install).toHaveAttribute('href', '/install/');

    const store = main().getByRole('link', { name: t('home.hero.cta_webstore') });
    expect(store).toHaveAttribute('href', WEBSTORE_URL);
    expect(store).toHaveAttribute('target', '_blank');
    expect(store).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('shows the popup mock twice - inline on mobile, framed in a browser on desktop', () => {
    render(<HomePage />);
    const popups = screen
      .getAllByRole('heading', { name: 'You are protected' })
      .map((h) => h.closest('[dir="ltr"]') as HTMLElement);
    expect(popups).toHaveLength(2);

    // The mobile copy is a bare popup constrained to the phone width…
    expect(popups[0]).toHaveClass('max-w-[380px]');
    expect(popups[0].closest('.lg\\:hidden')).not.toBeNull();
    // …the desktop copy sits inside the browser chrome.
    expect(popups[1].closest('.lg\\:block')).not.toBeNull();
    expect(screen.getAllByText('your-favorite-site.com')).toHaveLength(1);
  });

  it('lists the supported protocols as badges', () => {
    render(<HomePage />);
    expect(screen.getByText(t('home.works_with'))).toBeInTheDocument();

    const badges = PROTOCOLS.map((p) => screen.getByText(p));
    for (const badge of badges) expect(badge).toHaveClass('font-mono');
    expect(badges).toHaveLength(10);
  });

  it('counts and renders every feature bullet', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', { name: t('home.what_you_get'), level: 3 });
    expect(heading.parentElement).toHaveTextContent('9');

    for (const key of FEATURES) {
      const title = screen.getByText(t(`home.feat.${key}.title`));
      expect(within(title.parentElement as HTMLElement).getByText(t(`home.feat.${key}.body`))).
        toBeInTheDocument();
    }
  });

  it('renders the protocols, architecture and engine sections with their anchors', () => {
    const { container } = render(<HomePage />);

    expect(container.querySelector('#protocols')).not.toBeNull();
    expect(container.querySelector('#why-three-parts')).not.toBeNull();
    expect(container.querySelector('#engine')).not.toBeNull();
    expect(container.querySelector('#faq')).not.toBeNull();

    expect(
      screen.getByRole('heading', { name: t('home.protocols.h2'), level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('home.protocols.body'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('home.why.h2'), level: 2 })).toBeInTheDocument();
    expect(screen.getByText(t('home.why.body'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('home.engine.h2'), level: 2 })).toBeInTheDocument();
    expect(screen.getByText(t('home.engine.body'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('home.faq.h2'), level: 2 })).toBeInTheDocument();
  });

  it('closes with a second install call to action', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: t('home.start.h2'), level: 2 })).toBeInTheDocument();
    expect(screen.getByText(t('home.start.body'))).toBeInTheDocument();
    expect(main().getByRole('link', { name: t('home.start.cta') })).toHaveAttribute(
      'href',
      '/install/',
    );
  });

  it('follows the active locale for copy and internal links', () => {
    setLocale('fa');
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('home.hero.h1'));
    expect(main().getByRole('link', { name: t('home.hero.cta_install') })).toHaveAttribute(
      'href',
      '/fa/install/',
    );
    expect(main().getByRole('link', { name: t('home.start.cta') })).toHaveAttribute(
      'href',
      '/fa/install/',
    );
  });
});
