import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallPage } from './install';
import { WEBSTORE_EXT_ID, WEBSTORE_URL } from '../constants';
import { setLocale, t } from '../i18n';

const EXT = WEBSTORE_EXT_ID;

function commands() {
  return Array.from(document.querySelectorAll('pre code')).map((c) => c.textContent);
}

function coreTrigger() {
  return screen.getByRole('button', { name: /sing-box, xray, mihomo|sing-box|xray|mihomo/ });
}

async function toggle(user: ReturnType<typeof userEvent.setup>, core: string) {
  await user.click(coreTrigger());
  await user.click(await screen.findByRole('menuitemcheckbox', { name: core }));
  // The items stay put (onSelect is prevented), so close the menu explicitly.
  await user.keyboard('{Escape}');
}

/** Install a clipboard double; jsdom ships none. */
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(writeText) },
    configurable: true,
  });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  setLocale('en');
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('InstallPage', () => {
  it('walks through the three install steps', () => {
    render(<InstallPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('install.h1'));
    expect(screen.getByText(t('install.lede'))).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: t('install.before.title'), level: 2 }),
    ).toBeInTheDocument();
    for (const item of ['browser', 'disk', 'admin']) {
      expect(screen.getByText(t(`install.before.${item}`))).toBeInTheDocument();
    }

    for (const step of ['step1', 'step2', 'step3']) {
      expect(
        screen.getByRole('heading', { name: t(`install.${step}.title`), level: 2 }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(t('install.step1.body'))).toBeInTheDocument();
    expect(screen.getByText(t('install.step2.body1'))).toBeInTheDocument();
    expect(screen.getByText(t('install.step2.body2'))).toBeInTheDocument();
    expect(screen.getByText(t('install.step2.body3'))).toBeInTheDocument();
    expect(screen.getByText(t('install.step3.body'))).toBeInTheDocument();

    expect(screen.getByRole('link', { name: t('install.step1.cta') })).toHaveAttribute(
      'href',
      WEBSTORE_URL,
    );
    expect(screen.getByRole('link', { name: t('install.step2.helper_source') })).toHaveAttribute(
      'href',
      'https://github.com/c0nn3ct-info/noctis',
    );

    // Every command block says which platform its copy button belongs to.
    for (const platform of ['macOS', 'Linux', 'Windows (PowerShell)']) {
      expect(
        screen.getByRole('button', { name: `${t('install.copy')}: ${platform}` }),
      ).toBeInTheDocument();
    }
  });

  it('prints a bare one-liner per OS while every core is selected', () => {
    render(<InstallPage />);

    expect(coreTrigger()).toHaveTextContent('sing-box, xray, mihomo');
    expect(commands()).toEqual([
      `curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- ${EXT}`,
      `curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- ${EXT}`,
      `$env:NOCTIS_EXT_ID='${EXT}'; iwr -useb https://noctis.c0nn3ct.info/windows.ps1 | iex`,
    ]);
    expect(screen.getByText(t('install.step2.cores_label'))).toBeInTheDocument();
    expect(screen.getByText('macOS')).toBeInTheDocument();
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText('Windows (PowerShell)')).toBeInTheDocument();
  });

  it('appends a cores argument once the selection is narrowed', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InstallPage />);

    await toggle(user, 'xray');
    expect(coreTrigger()).toHaveTextContent('sing-box, mihomo');
    expect(commands()).toEqual([
      `curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- ${EXT} sing-box,mihomo`,
      `curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- ${EXT} sing-box,mihomo`,
      `$env:NOCTIS_CORES='sing-box,mihomo'; $env:NOCTIS_EXT_ID='${EXT}'; iwr -useb https://noctis.c0nn3ct.info/windows.ps1 | iex`,
    ]);

    // Re-adding restores the installer default (no argument), in canonical order.
    await toggle(user, 'xray');
    expect(coreTrigger()).toHaveTextContent('sing-box, xray, mihomo');
    expect(commands()[0]).toBe(
      `curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- ${EXT}`,
    );
  });

  it('refuses to deselect the last remaining core', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InstallPage />);

    await toggle(user, 'sing-box');
    await toggle(user, 'xray');
    expect(coreTrigger()).toHaveTextContent('mihomo');

    await toggle(user, 'mihomo');
    expect(coreTrigger()).toHaveTextContent('mihomo');
    expect(commands()[1]).toBe(
      `curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- ${EXT} mihomo`,
    );
  });

  it('marks the checked cores in the menu', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InstallPage />);

    await user.click(coreTrigger());
    const items = await screen.findAllByRole('menuitemcheckbox');
    expect(items.map((i) => i.textContent)).toEqual(['sing-box', 'xray', 'mihomo']);
    for (const item of items) expect(item).toHaveAttribute('data-state', 'checked');

    await user.click(items[1]);
    expect(screen.getByRole('menuitemcheckbox', { name: 'xray' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('copies a command and flips the button back after the confirmation window', async () => {
    vi.useFakeTimers();
    const writeText = stubClipboard(() => Promise.resolve());
    try {
      render(<InstallPage />);
      const macos = screen.getByRole('button', { name: `${t('install.copy')}: macOS` });
      expect(macos).toHaveAttribute('title', t('install.copy'));

      fireEvent.click(macos);
      await act(async () => {});

      expect(writeText).toHaveBeenCalledWith(
        `curl -fsSL https://noctis.c0nn3ct.info/macos.sh | bash -s -- ${EXT}`,
      );
      const copied = screen.getByRole('button', { name: `${t('install.copied')}: macOS` });
      expect(copied).toHaveAttribute('title', t('install.copied'));
      // Only the clicked block flips.
      expect(screen.getAllByRole('button', { name: new RegExp(`^${t('install.copy')}:`) })).toHaveLength(2);

      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(screen.getAllByRole('button', { name: new RegExp(`^${t('install.copy')}:`) })).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the clipboard is blocked instead of failing silently', async () => {
    const writeText = stubClipboard(() => Promise.reject(new Error('denied')));
    render(<InstallPage />);

    const linux = screen.getByRole('button', { name: `${t('install.copy')}: Linux` });
    fireEvent.click(linux);
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith(
      `curl -fsSL https://noctis.c0nn3ct.info/linux.sh | bash -s -- ${EXT}`,
    );
    expect(screen.queryByRole('button', { name: /Copied/ })).toBeNull();
    // Visible message plus a live region, so the dead end is announced too.
    // One live region per block, empty until its own copy succeeds or fails.
    const announced = screen.getAllByRole('status').map((n) => n.textContent);
    expect(announced).toContain(t('install.copy_failed'));
    expect(announced.filter(Boolean)).toHaveLength(1);
  });

  it('explains updating and uninstalling', () => {
    render(<InstallPage />);

    expect(
      screen.getByRole('heading', { name: t('install.updating.title'), level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText(t('install.updating.body'))).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: t('install.uninstalling.title'), level: 2 }),
    ).toBeInTheDocument();

    const steps = screen.getByText(t('install.uninstalling.step1')).closest('ol') as HTMLOListElement;
    expect(within(steps).getByText('~/.local/share/noctis')).toBeInTheDocument();
    expect(within(steps).getByText('%LOCALAPPDATA%\\Noctis')).toBeInTheDocument();
  });

  it('renders inside the shared layout and follows the active locale', () => {
    setLocale('ru');
    const { container } = render(<InstallPage />);
    const header = container.querySelector('header') as HTMLElement;
    expect(within(header).getByRole('link', { name: t('nav.home_aria') })).toHaveAttribute(
      'href',
      '/ru/',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('install.h1'));
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
