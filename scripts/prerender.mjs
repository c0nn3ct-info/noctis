#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import handler from 'serve-handler';
import puppeteer from 'puppeteer';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const distDir = resolve(root, 'dist');
const require = createRequire(import.meta.url);
const pkg = require(resolve(root, 'package.json'));

const ORIGIN = 'https://noctis.c0nn3ct.xyz';
const WEBSTORE_URL =
  'https://chromewebstore.google.com/detail/noctis/nmhobajopepdpihahepaddpdifdcenpn';
const GITHUB_ORG = 'https://github.com/c0nn3ct-xyz';

const PAGE_PATH = {
  home: '/',
  install: '/install/',
  privacy: '/privacy/',
  license: '/license/',
};

const PRIORITY = { home: '1.0', install: '0.8', privacy: '0.5', license: '0.5' };

const LOCALES = ['en', 'ru', 'es', 'zh-CN', 'fa', 'ar'];

const OG_LOCALE = {
  en: 'en_US',
  ru: 'ru_RU',
  es: 'es_ES',
  'zh-CN': 'zh_CN',
  fa: 'fa_IR',
  ar: 'ar_AR',
};

const OG_IMAGE_ALT = {
  en: 'Noctis — VLESS browser extension',
  ru: 'Noctis — браузерное расширение VLESS',
  es: 'Noctis — extensión de navegador VLESS',
  'zh-CN': 'Noctis — VLESS 浏览器扩展',
  fa: 'Noctis — افزونه مرورگر VLESS',
  ar: 'Noctis — إضافة متصفح VLESS',
};

const DICT = Object.fromEntries(
  await Promise.all(
    LOCALES.map(async (l) => [
      l,
      JSON.parse(await readFile(resolve(root, `src/i18n/${l}.json`), 'utf8')),
    ]),
  ),
);

function pathFor(page, locale) {
  const base = PAGE_PATH[page];
  if (locale === 'en') return base;
  if (base === '/') return `/${locale}/`;
  return `/${locale}${base}`;
}

function diskPath(page, locale) {
  const p = pathFor(page, locale);
  if (p === '/') return resolve(distDir, 'index.html');
  return resolve(distDir, p.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
}

function getMeta(page, locale) {
  const dict = DICT[locale];
  const path = pathFor(page, locale);
  const url = `${ORIGIN}${path}`;
  return {
    title: dict[`${page}.title`] ?? 'Noctis',
    description: dict[`${page}.description`] ?? '',
    canonical: url,
    hreflang: [
      ...LOCALES.map((l) => ({ lang: l, href: `${ORIGIN}${pathFor(page, l)}` })),
      { lang: 'x-default', href: `${ORIGIN}${pathFor(page, 'en')}` },
    ],
    og: {
      type: 'website',
      locale: OG_LOCALE[locale],
      localeAlternate: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      image: `${ORIGIN}/og-preview.jpg`,
      url,
      siteName: 'Noctis',
    },
    twitter: {
      card: 'summary_large_image',
      image: `${ORIGIN}/og-preview.jpg`,
    },
  };
}

function jsonLdBlocks(page, locale, version) {
  const dict = DICT[locale];
  const url = `${ORIGIN}${pathFor(page, locale)}`;
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'c0nn3ct.xyz',
    url: 'https://c0nn3ct.xyz',
    logo: `${ORIGIN}/favicon.svg`,
    sameAs: [
      GITHUB_ORG,
      'https://github.com/c0nn3ct-xyz/noctis-host',
      'https://github.com/c0nn3ct-xyz/noctis-site',
    ],
  };
  const blocks = [organization];

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
        acceptedAnswer: { '@type': 'Answer', text: dict[`home.faq.${k}.a`] },
      })),
    });
  } else {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Noctis',
          item: `${ORIGIN}${pathFor('home', locale)}`,
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

  return blocks;
}

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtmlText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHeadInjection(page, locale, version) {
  const meta = getMeta(page, locale);
  const blocks = jsonLdBlocks(page, locale, version);
  const ogImageAlt = OG_IMAGE_ALT[locale] ?? OG_IMAGE_ALT.en;
  const lines = [];
  lines.push(`<link rel="canonical" href="${escapeHtmlAttr(meta.canonical)}" />`);
  for (const h of meta.hreflang) {
    lines.push(
      `<link rel="alternate" hreflang="${h.lang}" href="${escapeHtmlAttr(h.href)}" />`,
    );
  }
  lines.push(`<meta property="og:type" content="${meta.og.type}" />`);
  lines.push(`<meta property="og:site_name" content="${escapeHtmlAttr(meta.og.siteName)}" />`);
  lines.push(`<meta property="og:locale" content="${meta.og.locale}" />`);
  for (const alt of meta.og.localeAlternate) {
    lines.push(`<meta property="og:locale:alternate" content="${alt}" />`);
  }
  lines.push(`<meta property="og:url" content="${escapeHtmlAttr(meta.og.url)}" />`);
  lines.push(`<meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />`);
  lines.push(
    `<meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />`,
  );
  lines.push(`<meta property="og:image" content="${escapeHtmlAttr(meta.og.image)}" />`);
  lines.push(`<meta property="og:image:secure_url" content="${escapeHtmlAttr(meta.og.image)}" />`);
  lines.push(`<meta property="og:image:type" content="image/jpeg" />`);
  lines.push(`<meta property="og:image:width" content="1200" />`);
  lines.push(`<meta property="og:image:height" content="630" />`);
  lines.push(`<meta property="og:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />`);
  lines.push(`<meta name="twitter:card" content="${meta.twitter.card}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />`);
  lines.push(
    `<meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />`,
  );
  lines.push(`<meta name="twitter:image" content="${escapeHtmlAttr(meta.twitter.image)}" />`);
  lines.push(`<meta name="twitter:image:alt" content="${escapeHtmlAttr(ogImageAlt)}" />`);
  for (const b of blocks) {
    lines.push(
      `<script type="application/ld+json">${JSON.stringify(b)}</script>`,
    );
  }
  return lines.join('\n    ');
}

function injectIntoHead(html, injection, newTitle, newDescription) {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlText(newTitle)}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtmlAttr(newDescription)}" />`,
  );
  out = out.replace('</head>', `    ${injection}\n  </head>`);
  return out;
}

function startServer(port) {
  const server = createServer((req, res) => handler(req, res, { public: distDir }));
  return new Promise((resolveP) => server.listen(port, () => resolveP(server)));
}

function buildSitemap(lastmod) {
  const pages = ['home', 'install', 'privacy', 'license'];
  const locales = LOCALES;
  const urls = [];
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

// A sitemap index is not strictly needed at this scale (<50k URLs / <50MB), but search
// consoles accept it and it future-proofs splitting the sitemap later.
function buildSitemapIndex(lastmod) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${ORIGIN}/sitemap.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${ORIGIN}/site.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

function findSystemChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
        ]
      : process.platform === 'linux'
        ? ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
        : ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  return candidates.find((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

async function main() {
  const port = 4321 + Math.floor(Math.random() * 1000);
  const server = await startServer(port);
  const executablePath = findSystemChrome();
  const launchOpts = { headless: true };
  if (executablePath) {
    launchOpts.executablePath = executablePath;
    console.log(`using system Chrome: ${executablePath}`);
  }
  const browser = await puppeteer.launch(launchOpts);

  try {
    const pages = ['home', 'install', 'privacy', 'license'];
    const locales = LOCALES;

    for (const page of pages) {
      for (const locale of locales) {
        const url = `http://localhost:${port}${pathFor(page, locale)}`;
        const target = diskPath(page, locale);
        const p = await browser.newPage();
        await p.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await p.waitForFunction(
          () => {
            const r = document.getElementById('root');
            return r && r.children.length > 0;
          },
          { timeout: 10000 },
        );
        const html = await p.evaluate(() => '<!doctype html>\n' + document.documentElement.outerHTML);
        await p.close();

        const injection = buildHeadInjection(page, locale, pkg.version);
        const meta = getMeta(page, locale);
        const final = injectIntoHead(html, injection, meta.title, meta.description);
        await writeFile(target, final, 'utf8');
        console.log(`✓ prerendered ${pathFor(page, locale)} → ${target.replace(distDir, '')}`);
      }
    }

    const lastmod = new Date().toISOString().slice(0, 10);
    const sitemap = buildSitemap(lastmod);
    await writeFile(resolve(distDir, 'sitemap.xml'), sitemap, 'utf8');
    console.log(`✓ wrote sitemap.xml (lastmod=${lastmod})`);
    // site.xml is an alias of sitemap.xml (identical content) served at a second path.
    await writeFile(resolve(distDir, 'site.xml'), sitemap, 'utf8');
    console.log(`✓ wrote site.xml (lastmod=${lastmod})`);
    await writeFile(resolve(distDir, 'sitemap_index.xml'), buildSitemapIndex(lastmod), 'utf8');
    console.log(`✓ wrote sitemap_index.xml (lastmod=${lastmod})`);
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
