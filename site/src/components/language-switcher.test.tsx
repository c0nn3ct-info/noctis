import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from './language-switcher';
import { setLocale, t } from '../i18n';

function setPath(path: string) {
  window.history.replaceState({}, '', path);
}

// React's DOM commit phase reads `window` itself (window.HTMLIFrameElement,
// window.event), so the global can only disappear for the duration of a render
// pass. These sentinels sit either side of the switcher in the element list:
// the first drops `window` right before it renders, the second puts it back
// right after — before React commits anything.
const realWindow = globalThis.window;
const globalRef = globalThis as unknown as { window: Window | undefined };

function SetWindow({ value }: { value: Window | undefined }) {
  globalRef.window = value;
  return null;
}

function Ssr({ gone }: { gone: boolean }) {
  return (
    <>
      <SetWindow key="before" value={gone ? undefined : realWindow} />
      <LanguageSwitcher key="switcher" />
      <SetWindow key="after" value={realWindow} />
    </>
  );
}

// This jsdom build exposes a stub `localStorage`, so give the component a real
// Storage-shaped double it can write through.
let store: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setPath('/');
  store = new Map();
  setItem = vi.fn((k: string, v: string) => {
    store.set(k, v);
  });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem,
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  setLocale('en');
  globalRef.window = realWindow;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function open() {
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: t('nav.lang_switch_aria') });
  await user.click(trigger);
  return { user, trigger };
}

describe('LanguageSwitcher', () => {
  it('renders a closed trigger', () => {
    render(<LanguageSwitcher className="ms-1" />);
    const trigger = screen.getByRole('button', { name: t('nav.lang_switch_aria') });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.parentElement).toHaveClass('relative', 'ms-1');
  });

  it('opens a menu with one link per locale and marks the active one', async () => {
    setLocale('ru');
    setPath('/ru/install/');
    render(<LanguageSwitcher />);
    const { trigger } = await open();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(6);

    const russian = screen.getByRole('menuitem', { name: 'Русский' });
    expect(russian).toHaveAttribute('aria-current', 'true');
    expect(russian).toHaveClass('font-medium');
    expect(russian).toHaveAttribute('href', '/ru/install/');
    expect(russian).toHaveAttribute('hreflang', 'ru');

    const english = screen.getByRole('menuitem', { name: 'English' });
    expect(english).not.toHaveAttribute('aria-current');
    expect(english).toHaveAttribute('href', '/install/');
    expect(screen.getByRole('menuitem', { name: '中文' })).toHaveAttribute(
      'href',
      '/zh-CN/install/',
    );
  });

  it('toggles closed when the trigger is clicked again', async () => {
    render(<LanguageSwitcher />);
    const { user, trigger } = await open();
    await user.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on an outside click but stays open for inside clicks', async () => {
    render(<LanguageSwitcher />);
    const { user } = await open();

    await user.click(screen.getByRole('menuitem', { name: 'English' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and ignores other keys', async () => {
    render(<LanguageSwitcher />);
    const { user } = await open();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('removes its document listeners when it closes and when it unmounts', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const view = render(<LanguageSwitcher />);
    const { user, trigger } = await open();

    await user.click(trigger);
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));

    remove.mockClear();
    await user.click(trigger);
    view.unmount();
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('remembers the picked locale in localStorage', async () => {
    render(<LanguageSwitcher />);
    const { user } = await open();
    await user.click(screen.getByRole('menuitem', { name: 'فارسی' }));
    expect(store.get('noctis-locale')).toBe('fa');
  });

  it('ignores localStorage failures', async () => {
    setItem.mockImplementation(() => {
      throw new Error('denied');
    });
    render(<LanguageSwitcher />);
    const { user } = await open();
    await expect(
      user.click(screen.getByRole('menuitem', { name: 'العربية' })),
    ).resolves.toBeUndefined();
    expect(setItem).toHaveBeenCalledWith('noctis-locale', 'ar');
  });

  it('falls back to locale roots when there is no window (SSR)', async () => {
    setPath('/install/');
    const view = render(<Ssr gone={false} />);
    await open();
    expect(screen.getByRole('menuitem', { name: 'Русский' })).toHaveAttribute(
      'href',
      '/ru/install/',
    );

    view.rerender(<Ssr gone />);
    expect(globalRef.window).toBe(realWindow);
    expect(screen.getByRole('menuitem', { name: 'English' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('menuitem', { name: 'Русский' })).toHaveAttribute('href', '/ru/');
  });
});
