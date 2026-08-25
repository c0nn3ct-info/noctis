import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSitemap,
  getAllRoutes,
  getJsonLd,
  getMeta,
  NOINDEX_PAGES,
  pathFor,
  type PageKey,
} from './seo';
import { LOCALES } from './index';
import en from './en.json';
import ru from './ru.json';
import ogImage from './og-image.json';

const ORIGIN = 'https://noctis.c0nn3ct.info';
const PAGES: PageKey[] = ['home', 'install', 'privacy', 'license'];

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./en.json');
});

describe('pathFor', () => {
  it('maps pages to English root paths', () => {
    expect(pathFor('home', 'en')).toBe('/');
    expect(pathFor('install', 'en')).toBe('/install/');
    expect(pathFor('privacy', 'en')).toBe('/privacy/');
    expect(pathFor('license', 'en')).toBe('/license/');
  });

  it('prefixes non-English locales', () => {
    expect(pathFor('home', 'ru')).toBe('/ru/');
    expect(pathFor('license', 'zh-CN')).toBe('/zh-CN/license/');
  });
});

describe('getMeta', () => {
  it('builds canonical, hreflang and og/twitter payloads', () => {
    const meta = getMeta('install', 'ru');
    expect(meta.title).toBe(ru['install.title']);
    expect(meta.description).toBe(ru['install.description']);
    expect(meta.canonical).toBe(`${ORIGIN}/ru/install/`);
    expect(meta.htmlLang).toBe('ru');
    expect(meta.noindex).toBe(false);

    expect(meta.hreflang).toEqual([
      { lang: 'en', href: `${ORIGIN}/install/` },
      { lang: 'ru', href: `${ORIGIN}/ru/install/` },
      { lang: 'es', href: `${ORIGIN}/es/install/` },
      { lang: 'zh-CN', href: `${ORIGIN}/zh-CN/install/` },
      { lang: 'fa', href: `${ORIGIN}/fa/install/` },
      { lang: 'ar', href: `${ORIGIN}/ar/install/` },
      { lang: 'x-default', href: `${ORIGIN}/install/` },
    ]);

    expect(meta.og).toEqual({
      type: 'website',
      locale: 'ru_RU',
      localeAlternate: ['en_US', 'es_ES', 'zh_CN', 'fa_IR', 'ar_AR'],
      image: `${ORIGIN}/og-preview.jpg?v=${ogImage.version}`,
      url: `${ORIGIN}/ru/install/`,
      title: ru['install.title'],
      description: ru['install.description'],
      siteName: 'Noctis',
    });

    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      image: `${ORIGIN}/og-preview.jpg?v=${ogImage.version}`,
      title: ru['install.title'],
      description: ru['install.description'],
    });
  });

  it('uses the English dictionary and root canonical for en', () => {
    const meta = getMeta('home', 'en');
    expect(meta.title).toBe(en['home.title']);
    expect(meta.canonical).toBe(`${ORIGIN}/`);
    expect(meta.og.locale).toBe('en_US');
    expect(meta.og.localeAlternate).not.toContain('en_US');
  });

  it('falls back to defaults when the dictionary lacks the keys', async () => {
    vi.resetModules();
    vi.doMock('./en.json', () => ({ default: {} }));
    const seo = await import('./seo');
    const meta = seo.getMeta('home', 'en');
    expect(meta.title).toBe('Noctis');
    expect(meta.description).toBe('');
  });
});

describe('getJsonLd', () => {
  it('emits organization + software + FAQ blocks on the home page', () => {
    const { blocks } = getJsonLd('home', 'en', '1.2.3');
    expect(blocks).toHaveLength(3);

    const [org, app, faq] = blocks;
    expect(org['@type']).toBe('Organization');
    expect(org.url).toBe('https://c0nn3ct.info');

    expect(app['@type']).toBe('SoftwareApplication');
    expect(app.softwareVersion).toBe('1.2.3');
    expect(app.url).toBe(`${ORIGIN}/`);
    expect(app.description).toBe(en['home.description']);
    expect(app.publisher).toBe(org);
    expect(app.inLanguage).toEqual([...LOCALES]);
    expect(app.featureList).toContain('VLESS Reality');

    expect(faq['@type']).toBe('FAQPage');
    const entities = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities).toHaveLength(10);
    expect(entities[0]).toEqual({
      '@type': 'Question',
      name: en['home.faq.what.q'],
      acceptedAnswer: { '@type': 'Answer', text: en['home.faq.what.a'] },
    });
  });

  it('emits a breadcrumb for inner pages', () => {
    const { blocks } = getJsonLd('privacy', 'ru', '9.9.9');
    expect(blocks).toHaveLength(2);
    const crumb = blocks[1];
    expect(crumb['@type']).toBe('BreadcrumbList');
    expect(crumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Noctis', item: `${ORIGIN}/ru/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: ru['privacy.h1'],
        item: `${ORIGIN}/ru/privacy/`,
      },
    ]);
  });

  it('falls back to the page key when the breadcrumb heading is missing', async () => {
    vi.resetModules();
    vi.doMock('./en.json', () => ({ default: {} }));
    const seo = await import('./seo');
    const { blocks } = seo.getJsonLd('license', 'en', '0.0.1');
    const crumb = blocks[1].itemListElement as { name: string }[];
    expect(crumb[1].name).toBe('license');
  });
});

describe('buildSitemap', () => {
  const xml = buildSitemap();
  const indexable = PAGES.filter((p) => !NOINDEX_PAGES.includes(p));

  it('is a well-formed urlset covering only the indexable pages', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    expect(xml.match(/<url>/g)).toHaveLength(indexable.length * LOCALES.length);
    // A lastmod stamped at build time claimed every page changed on every deploy.
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
  });

  it('leaves the noindexed pages out entirely', () => {
    for (const page of NOINDEX_PAGES) {
      expect(xml).not.toContain(`${ORIGIN}/${page}/`);
      expect(xml).not.toContain(`${ORIGIN}/ru/${page}/`);
    }
  });

  it('carries per-page priorities and hreflang alternates', () => {
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<priority>0.8</priority>');
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="zh-CN" href="${ORIGIN}/zh-CN/install/" />`,
    );
    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(indexable.length * LOCALES.length);
  });
});

describe('noindexed pages', () => {
  it('marks the legal pages noindex in every locale, and nothing else', () => {
    for (const locale of LOCALES) {
      for (const page of PAGES) {
        expect(getMeta(page, locale).noindex).toBe(NOINDEX_PAGES.includes(page));
      }
    }
  });
});

describe('getAllRoutes', () => {
  it('returns every page/locale pair with its path', () => {
    const routes = getAllRoutes();
    expect(routes).toHaveLength(PAGES.length * LOCALES.length);
    expect(routes[0]).toEqual({ page: 'home', locale: 'en', path: '/' });
    expect(routes).toContainEqual({ page: 'license', locale: 'ar', path: '/ar/license/' });
    expect(new Set(routes.map((r) => r.path)).size).toBe(routes.length);
  });
});
