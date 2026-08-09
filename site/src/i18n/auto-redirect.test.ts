import { describe, expect, it, vi } from 'vitest';
import { AUTO_REDIRECT_SCRIPT } from './auto-redirect';

interface FakeStorage {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
}

interface FakeLocation {
  pathname: string;
  search: string;
  hash: string;
  replace: (url: string) => void;
}

// The redirect snippet ships as an inline <script> string, so exercise it by
// evaluating it with `localStorage` / `navigator` / `location` shadowed by
// locals — no globals are touched.
function run(opts: {
  stored?: string | null;
  language?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  throwOnGet?: boolean;
}) {
  const store = new Map<string, string>();
  if (opts.stored) store.set('noctis-locale', opts.stored);
  const localStorage: FakeStorage = {
    getItem: (k) => {
      if (opts.throwOnGet) throw new Error('storage blocked');
      return store.get(k) ?? null;
    },
    setItem: (k, v) => {
      store.set(k, v);
    },
  };
  const replace = vi.fn();
  const location: FakeLocation = {
    pathname: opts.pathname ?? '/',
    search: opts.search ?? '',
    hash: opts.hash ?? '',
    replace,
  };
  const navigator = { language: opts.language };
  const fn = new Function('localStorage', 'navigator', 'location', AUTO_REDIRECT_SCRIPT);
  fn(localStorage, navigator, location);
  return { replace, stored: store.get('noctis-locale') };
}

describe('AUTO_REDIRECT_SCRIPT', () => {
  it('is a self-invoking snippet keyed on noctis-locale', () => {
    expect(AUTO_REDIRECT_SCRIPT).toMatch(/^\(function\(\)\{/);
    expect(AUTO_REDIRECT_SCRIPT).toContain('noctis-locale');
    expect(AUTO_REDIRECT_SCRIPT.endsWith('})();')).toBe(true);
  });

  it('does nothing when a locale was already stored', () => {
    const { replace } = run({ stored: 'ru', language: 'es-ES' });
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['ru-RU', 'ru'],
    ['es-419', 'es'],
    ['zh-Hans-CN', 'zh-CN'],
    ['fa-IR', 'fa'],
    ['pe', 'fa'],
    ['ar-EG', 'ar'],
  ])('maps %s to /%s/', (language, locale) => {
    const { replace, stored } = run({ language });
    expect(stored).toBe(locale);
    expect(replace).toHaveBeenCalledWith(`/${locale}/`);
  });

  it('stores en and stays put for English and unknown languages', () => {
    for (const language of ['en-US', 'de-DE', undefined]) {
      const { replace, stored } = run({ language });
      expect(stored).toBe('en');
      expect(replace).not.toHaveBeenCalled();
    }
  });

  it('keeps the current path, query and hash when redirecting', () => {
    const { replace } = run({
      language: 'ru',
      pathname: '/install/',
      search: '?a=1',
      hash: '#top',
    });
    expect(replace).toHaveBeenCalledWith('/ru/install/?a=1#top');
  });

  it('swallows storage failures', () => {
    expect(() => run({ language: 'ru', throwOnGet: true })).not.toThrow();
  });
});
