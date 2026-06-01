import en from './en.json';
import ru from './ru.json';
import type { Locale } from './index';

export type PageKey = 'home' | 'install' | 'privacy' | 'license';

const ORIGIN = 'https://noctis.c0nn3ct.xyz';

const DICT: Record<Locale, Record<string, string>> = { en, ru };

const PAGE_PATH: Record<PageKey, string> = {
  home: '/',
  install: '/install/',
  privacy: '/privacy/',
  license: '/license/',
};

const PRIORITY: Record<PageKey, string> = {
  home: '1.0',
  install: '0.8',
  privacy: '0.5',
  license: '0.5',
};

export interface MetaPayload {
  title: string;
  description: string;
  canonical: string;
  hreflang: { lang: string; href: string }[];
  og: {
    type: string;
    locale: string;
    localeAlternate: string;
    image: string;
    url: string;
    title: string;
    description: string;
    siteName: string;
  };
  twitter: {
    card: string;
    image: string;
    title: string;
    description: string;
  };
  htmlLang: string;
}

export function pathFor(page: PageKey, locale: Locale): string {
  const base = PAGE_PATH[page];
  if (locale === 'en') return base;
  if (base === '/') return '/ru/';
  return `/ru${base}`;
}

export function getMeta(page: PageKey, locale: Locale): MetaPayload {
  const dict = DICT[locale];
  const path = pathFor(page, locale);
  const url = `${ORIGIN}${path}`;
  const title = dict[`${page}.title`] ?? 'Noctis';
  const description = dict[`${page}.description`] ?? '';

  return {
    title,
    description,
    canonical: url,
    hreflang: [
      { lang: 'en', href: `${ORIGIN}${pathFor(page, 'en')}` },
      { lang: 'ru', href: `${ORIGIN}${pathFor(page, 'ru')}` },
      { lang: 'x-default', href: `${ORIGIN}${pathFor(page, 'en')}` },
    ],
    og: {
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'ru_RU',
      localeAlternate: locale === 'en' ? 'ru_RU' : 'en_US',
      image: `${ORIGIN}/og-preview.jpg`,
      url,
      title,
      description,
      siteName: 'Noctis',
    },
    twitter: {
      card: 'summary_large_image',
      image: `${ORIGIN}/og-preview.jpg`,
      title,
      description,
    },
    htmlLang: locale,
  };
}

export interface JsonLdPayload {
  blocks: Record<string, unknown>[];
}

export function getJsonLd(page: PageKey, locale: Locale, version: string): JsonLdPayload {
  const dict = DICT[locale];
  const url = `${ORIGIN}${pathFor(page, locale)}`;
  const blocks: Record<string, unknown>[] = [];

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'c0nn3ct.xyz',
    url: 'https://c0nn3ct.xyz',
    logo: `${ORIGIN}/favicon.svg`,
    sameAs: ['https://github.com/c0nn3ct-xyz/noctis-host'],
  };
  blocks.push(organization);

  if (page === 'home') {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Noctis',
      applicationCategory: 'BrowserApplication',
      applicationSubCategory: 'Proxy',
      operatingSystem: 'Windows, macOS, Linux',
      description: dict['home.description'],
      url,
      inLanguage: ['en', 'ru'],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: organization,
      softwareVersion: version,
      featureList: [
        'VLESS',
        'VLESS Reality',
        'VMess',
        'Trojan',
        'Shadowsocks',
        'Hysteria2',
        'TUIC',
        'WireGuard',
        'AnyTLS',
        'ShadowTLS',
      ],
    });

    const faqKeys = [
      'what',
      'vpn',
      'reality',
      'protocols',
      'safe',
      'platforms',
      'subscription',
      'bypass',
      'webrtc',
      'cost',
    ];
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqKeys.map((k) => ({
        '@type': 'Question',
        name: dict[`home.faq.${k}.q`],
        acceptedAnswer: {
          '@type': 'Answer',
          text: dict[`home.faq.${k}.a`],
        },
      })),
    });
  } else {
    const homePath = pathFor('home', locale);
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Noctis',
          item: `${ORIGIN}${homePath}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: dict[`${page}.h1`] ?? page,
          item: url,
        },
      ],
    });
  }

  return { blocks };
}

export function buildSitemap(lastmod: string): string {
  const pages: PageKey[] = ['home', 'install', 'privacy', 'license'];
  const locales: Locale[] = ['en', 'ru'];
  const urls: string[] = [];

  for (const page of pages) {
    for (const locale of locales) {
      const url = `${ORIGIN}${pathFor(page, locale)}`;
      const alts = locales
        .map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathFor(page, l)}" />`,
        )
        .join('\n');
      urls.push(
        `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${PRIORITY[page]}</priority>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${pathFor(page, 'en')}" />
  </url>`,
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

export function getAllRoutes(): { page: PageKey; locale: Locale; path: string }[] {
  const pages: PageKey[] = ['home', 'install', 'privacy', 'license'];
  const locales: Locale[] = ['en', 'ru'];
  const routes: { page: PageKey; locale: Locale; path: string }[] = [];
  for (const page of pages) {
    for (const locale of locales) {
      routes.push({ page, locale, path: pathFor(page, locale) });
    }
  }
  return routes;
}
