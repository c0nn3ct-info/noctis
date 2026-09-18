import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.resolve(here, 'pages');

// Keep in sync with LOCALES in src/i18n/index.ts (config is plain, can't import the .ts type list).
const LOCALES = ['en', 'ru', 'es', 'zh-CN', 'fa', 'ar'] as const;
const PAGES: Record<string, string> = {
  home: 'index.html',
  install: 'install/index.html',
  privacy: 'privacy/index.html',
  license: 'license/index.html',
};

// Route HTML live under pages/ (the Vite root); output mirrors them into dist/ at the same URLs.
const input: Record<string, string> = {};
for (const locale of LOCALES) {
  for (const [page, rel] of Object.entries(PAGES)) {
    const key = locale === 'en' ? page : `${locale}-${page}`;
    const file = locale === 'en' ? rel : `${locale}/${rel}`;
    input[key] = path.resolve(pagesDir, file);
  }
}

export default defineConfig({
  base: '/',
  root: pagesDir,
  publicDir: path.resolve(here, 'public'),
  plugins: [react()],
  resolve: {
    /* Array form, because one of these is a regex.
     *
     * The route HTML load their entry as `../src/entries/<page>.tsx`, and the
     * two halves of Vite disagree about what that means. Rollup resolves it
     * against the file on disk — `pages/../src` is `site/src`, so the build
     * has always worked. The dev server resolves it against the URL: from `/`
     * it becomes `/src/entries/home.tsx`, which under `root: pages` is
     * `pages/src/entries/home.tsx` and does not exist, so every route answered
     * with "Failed to load url /src/entries/<page>.tsx" and rendered nothing.
     *
     * Mapping that URL-shaped path back to the real directory fixes the dev
     * server and leaves the build alone, which never produces it. */
    alias: [
      { find: /^\/src\//, replacement: `${path.resolve(here, 'src')}/` },
      { find: '@', replacement: path.resolve(here, 'src') },
    ],
  },
  build: {
    outDir: path.resolve(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input },
  },
  server: {
    port: 5180,
    strictPort: true,
    // Route HTML reference the sibling ../src via relative module scripts.
    fs: { allow: [here] },
  },
});
