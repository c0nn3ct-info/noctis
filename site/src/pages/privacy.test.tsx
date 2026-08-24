import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PrivacyPage } from './privacy';
import { setLocale, t } from '../i18n';

afterEach(() => setLocale('en'));

describe('PrivacyPage', () => {
  it('opens with the headline, revision date and lede', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('privacy.h1'));
    expect(screen.getByText(t('privacy.last_updated'))).toBeInTheDocument();
    expect(screen.getByText(t('privacy.lede'))).toBeInTheDocument();
  });

  it('lists what is stored, what goes over the wire and what never happens', () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole('heading', { name: t('privacy.stores.h2'), level: 2 }),
    ).toBeInTheDocument();
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByText(t(`privacy.stores.item${n}`))).toBeInTheDocument();
      expect(screen.getByText(t(`privacy.nothing.item${n}`))).toBeInTheDocument();
    }
    expect(screen.getByText(t('privacy.stores.outro'))).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: t('privacy.network.h2'), level: 2 }),
    ).toBeInTheDocument();
    for (const kind of ['proxied', 'sub', 'ip']) {
      expect(screen.getByText(t(`privacy.network.${kind}.b`))).toBeInTheDocument();
      // The string leads with the dash separator, and every locale but zh-CN
      // spaces it; getByText compares a raw matcher against normalized DOM
      // text, so trim the query rather than the data.
      expect(screen.getByText(t(`privacy.network.${kind}.body`).trim())).toBeInTheDocument();
    }
    expect(screen.getByText(t('privacy.network.outro'))).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: t('privacy.nothing.h2'), level: 2 }),
    ).toBeInTheDocument();
  });

  it('discloses what the website itself measures', () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole('heading', { name: t('privacy.website.h2'), level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('privacy.website.intro'))).toBeInTheDocument();
    for (const n of [1, 2, 3, 4]) {
      expect(screen.getByText(t(`privacy.website.item${n}`))).toBeInTheDocument();
    }
    expect(screen.getByText(t('privacy.website.outro'))).toBeInTheDocument();
  });

  it('tabulates every requested permission with its rationale', () => {
    const { container } = render(<PrivacyPage />);

    // The section header carries the permission count.
    const heading = screen.getByRole('heading', { name: t('privacy.permissions.h2'), level: 2 });
    expect(heading.parentElement).toHaveTextContent('8');

    const table = container.querySelector('table') as HTMLTableElement;
    expect(within(table).getByText(t('privacy.permissions.col1'))).toBeInTheDocument();
    expect(within(table).getByText(t('privacy.permissions.col2'))).toBeInTheDocument();

    const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.cells[0].textContent)).toEqual([
      'proxy',
      'storage',
      'nativeMessaging',
      'privacy',
      'alarms',
      'tabs',
      'declarativeNetRequestWithHostAccess',
      'host_permissions: <all_urls>',
    ]);
    expect(rows.map((r) => r.cells[1].textContent)).toEqual([
      t('privacy.perm.proxy'),
      t('privacy.perm.storage'),
      t('privacy.perm.nativeMessaging'),
      t('privacy.perm.privacy'),
      t('privacy.perm.alarms'),
      t('privacy.perm.tabs'),
      t('privacy.perm.dnr'),
      t('privacy.perm.hosts'),
    ]);
    // Zebra striping alternates, starting with the un-striped tone.
    expect(rows[0]).toHaveClass('bg-surface-container');
    expect(rows[1]).toHaveClass('bg-surface-container-low');
  });

  it('closes with the children, contact and changes notes', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(t('privacy.children.h3'))).toBeInTheDocument();
    expect(screen.getByText(t('privacy.children.body'))).toBeInTheDocument();

    expect(screen.getByText(t('privacy.contact.h3'))).toBeInTheDocument();
    const mail = screen.getByRole('link', { name: 'help@c0nn3ct.info' });
    expect(mail).toHaveAttribute('href', 'mailto:help@c0nn3ct.info');
    expect(mail.parentElement).toHaveTextContent(
      `${t('privacy.contact.body_before')}help@c0nn3ct.info${t('privacy.contact.body_after')}`,
    );

    expect(
      screen.getByRole('heading', { name: t('privacy.changes.h2'), level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('privacy.changes.body'))).toBeInTheDocument();
  });

  it('renders inside the shared layout and follows the active locale', () => {
    setLocale('ar');
    const { container } = render(<PrivacyPage />);
    const header = container.querySelector('header') as HTMLElement;
    expect(within(header).getByRole('link', { name: t('nav.home_aria') })).toHaveAttribute(
      'href',
      '/ar/',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('privacy.h1'));
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
