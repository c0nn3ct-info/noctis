// Storybook-only Vite config.
//
// The app config (`vite.config.ts`) is a 24-input multi-page build: its `root`
// is `pages/`, its `rollupOptions.input` lists every locale x route HTML file,
// its `publicDir` copies `CNAME` and the installer scripts (`*.sh`, `*.ps1`)
// into the output, and its dev server pins port 5180 with `strictPort`. None of
// that belongs in a component workshop — `storybook-static/` must not carry the
// site's apex-domain CNAME or installer payloads, and Storybook's dev server
// must not fight the site's port. So Storybook loads this config instead
// (`framework.options.builder.viteConfigPath` in `.storybook/main.ts`).
//
// It carries only what stories need: React (`@storybook/react-vite` does not
// add `@vitejs/plugin-react` itself), the `@` alias, and Tailwind/autoprefixer
// wired explicitly. PostCSS is inlined here rather than read from
// `postcss.config.js` so the Tailwind `content` globs can differ: the shipped
// CSS excludes stories, this instance scans them.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwind from './tailwind.config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
  publicDir: false,
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          ...tailwind,
          content: ['./src/**/*.{ts,tsx}', './.storybook/**/*.{ts,tsx}'],
        }),
        autoprefixer(),
      ],
    },
  },
});
