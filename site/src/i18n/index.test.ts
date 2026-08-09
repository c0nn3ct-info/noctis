import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOCALES,
  RTL_LOCALES,
  getLocale,
  isLocale,
  isRtl,
  localePath,
  setLocale,
  stripLocale,
  t,
  withLocale,
} from './index';
import en from './en.json';
import ru from './ru.json';

afterEach(() => {
  setLocale('en');
  vi.restoreAllMocks();
});

describe('locale registry', () => {
  it('lists the supported locales', () => {
    expect(LOCALES).toEqual(['en', 'ru', 'es', 'zh-CN', 'fa', 'ar']);
    expect(RTL_LOCALES).toEqual(['fa', 'ar']);
  });

  it('detects RTL locales', () => {
    expect(isRtl('fa')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('validates locale strings', () => {
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('')).toBe(false);
  });

  it('stores and returns the current locale', () => {
    expect(getLocale()).toBe('en');
    setLocale('fa');
    expect(getLocale()).toBe('fa');
  });
});

describe('t', () => {
  it('translates keys in the current locale', () => {
    expect(t('nav.install')).toBe(en['nav.install']);
    setLocale('ru');
    expect(t('nav.install')).toBe(ru['nav.install']);
  });

  it('returns the key and warns for missing translations', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('nope.missing.key')).toBe('nope.missing.key');
    expect(warn).toHaveBeenCalledWith('[i18n] missing key: nope.missing.key (en)');
  });
});

describe('stripLocale', () => {
  it('strips bare locale roots with and without trailing slash', () => {
    expect(stripLocale('/ru')).toBe('/');
    expect(stripLocale('/ru/')).toBe('/');
    expect(stripLocale('/zh-CN/')).toBe('/');
  });

  it('strips locale prefixes from deeper paths', () => {
    expect(stripLocale('/ru/install/')).toBe('/install/');
    expect(stripLocale('/ar/privacy/')).toBe('/privacy/');
  });

  it('returns English/unknown paths untouched', () => {
    expect(stripLocale('/')).toBe('/');
    expect(stripLocale('/install/')).toBe('/install/');
    expect(stripLocale('/russia/')).toBe('/russia/');
  });
});

describe('withLocale', () => {
  it('keeps English at the root', () => {
    expect(withLocale('/', 'en')).toBe('/');
    expect(withLocale('/install/', 'en')).toBe('/install/');
  });

  it('prefixes non-English locales', () => {
    expect(withLocale('/', 'ru')).toBe('/ru/');
    expect(withLocale('/install/', 'zh-CN')).toBe('/zh-CN/install/');
  });
});

describe('localePath', () => {
  it('prefixes with the current locale', () => {
    expect(localePath('/install/')).toBe('/install/');
    setLocale('es');
    expect(localePath('/install/')).toBe('/es/install/');
    expect(localePath('/')).toBe('/es/');
  });
});
