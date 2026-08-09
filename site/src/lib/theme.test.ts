import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAccent, applyTheme, watchSystemTheme } from './theme';

type Listener = (ev: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_type: string, cb: Listener) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_type: string, cb: Listener) => {
      listeners.delete(cb);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };
  window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList);
  return {
    mql,
    fire() {
      for (const cb of [...listeners]) cb({ matches: mql.matches } as MediaQueryListEvent);
    },
    listenerCount: () => listeners.size,
  };
}

const originalMatchMedia = window.matchMedia;
const root = document.documentElement;

afterEach(() => {
  // Detach any watcher left over from a test, then restore the real matchMedia.
  watchSystemTheme('light');
  window.matchMedia = originalMatchMedia;
  root.classList.remove('light', 'dark');
  root.removeAttribute('data-theme');
  root.removeAttribute('data-accent');
  vi.restoreAllMocks();
});

describe('applyAccent', () => {
  it('sets data-accent for non-neutral accents', () => {
    applyAccent('storm');
    expect(root.getAttribute('data-accent')).toBe('storm');
    applyAccent('cyan');
    expect(root.getAttribute('data-accent')).toBe('cyan');
  });

  it('removes data-accent for the neutral accent', () => {
    applyAccent('purple');
    applyAccent('neutral');
    expect(root.hasAttribute('data-accent')).toBe(false);
  });
});

describe('applyTheme', () => {
  it('follows the system preference when dark', () => {
    installMatchMedia(true);
    applyTheme('system');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('follows the system preference when light', () => {
    installMatchMedia(false);
    applyTheme('system');
    expect(root.classList.contains('light')).toBe(true);
    expect(root.classList.contains('dark')).toBe(false);
  });

  it('pins an explicit theme via data-theme and class', () => {
    installMatchMedia(true);
    applyTheme('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.classList.contains('light')).toBe(true);

    applyTheme('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('light')).toBe(false);
  });
});

describe('watchSystemTheme', () => {
  it('subscribes on system, re-applies on change, resubscribes and detaches', () => {
    const media = installMatchMedia(false);

    // No previous watcher: subscribes.
    watchSystemTheme('system');
    expect(media.mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(media.listenerCount()).toBe(1);

    // The change listener re-applies the system theme.
    media.mql.matches = true;
    media.fire();
    expect(root.classList.contains('dark')).toBe(true);
    media.mql.matches = false;
    media.fire();
    expect(root.classList.contains('light')).toBe(true);

    // Watching again removes the old listener before re-subscribing.
    watchSystemTheme('system');
    expect(media.mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.mql.addEventListener).toHaveBeenCalledTimes(2);
    expect(media.listenerCount()).toBe(1);

    // A non-system theme detaches and does not resubscribe.
    watchSystemTheme('dark');
    expect(media.mql.removeEventListener).toHaveBeenCalledTimes(2);
    expect(media.listenerCount()).toBe(0);

    // With nothing attached, a non-system theme is a no-op.
    watchSystemTheme('light');
    expect(media.mql.removeEventListener).toHaveBeenCalledTimes(2);
    expect(media.mql.addEventListener).toHaveBeenCalledTimes(2);
  });
});
