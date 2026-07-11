import en from './en.json';
import ru from './ru.json';
import es from './es.json';
import zhCN from './zh-CN.json';
import fa from './fa.json';
import ar from './ar.json';
import { LOCALES, withLocale, type Locale } from './index';

export type PageKey = 'home' | 'install' | 'privacy' | 'license';

const ORIGIN = 'https://noctis.c0nn3ct.info';
const WEBSTORE_URL =
  'https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn';
const GITHUB_ORG = 'https://github.com/c0nn3ct-info';
// Scrapers (Telegram etc.) cache the preview image by URL - bump when
// og-preview.jpg is redesigned so they re-fetch it.
const OG_IMAGE = `${ORIGIN}/og-preview.jpg?v=3`;

const DICT: Record<Locale, Record<string, string>> = {
  en,
  ru,
  es,
  'zh-CN': zhCN,
  fa,
  ar,
};

/** Open Graph locale codes (BCP-47-ish, underscore form). */
const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  es: 'es_ES',
  'zh-CN': 'zh_CN',
  fa: 'fa_IR',
  ar: 'ar_AR',
};

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
    localeAlternate: string[];
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
  return withLocale(PAGE_PATH[page], locale);
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
      ...LOCALES.map((l) => ({ lang: l, href: `${ORIGIN}${pathFor(page, l)}` })),
      { lang: 'x-default', href: `${ORIGIN}${pathFor(page, 'en')}` },
    ],
    og: {
      type: 'website',
      locale: OG_LOCALE[locale],
      localeAlternate: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      image: OG_IMAGE,
      url,
      title,
      description,
      siteName: 'Noctis',
    },
    twitter: {
      card: 'summary_large_image',
      image: OG_IMAGE,
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
    name: 'c0nn3ct.info',
    url: 'https://c0nn3ct.info',
    logo: `${ORIGIN}/favicon.svg`,
    sameAs: [
      GITHUB_ORG,
      'https://github.com/c0nn3ct-info/noctis',
    ],
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
      downloadUrl: WEBSTORE_URL,
      installUrl: WEBSTORE_URL,
      sameAs: [WEBSTORE_URL],
      inLanguage: [...LOCALES],
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
  const urls: string[] = [];

  for (const page of pages) {
    for (const locale of LOCALES) {
      const url = `${ORIGIN}${pathFor(page, locale)}`;
      const alts = LOCALES.map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathFor(page, l)}" />`,
      ).join('\n');
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
  const routes: { page: PageKey; locale: Locale; path: string }[] = [];
  for (const page of pages) {
    for (const locale of LOCALES) {
      routes.push({ page, locale, path: pathFor(page, locale) });
    }
  }
  return routes;
}
