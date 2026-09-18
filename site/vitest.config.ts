import { coverageConfigDefaults, defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // `scripts/` carries the build-time generators; the missing-story gate is
    // pure given a file system, so it is unit-tested like anything else.
    // Coverage stays scoped to `src/**` — the prerender generator has no tests
    // yet, and a 100% threshold over `scripts/**` would fail on it.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/test/**',
        'src/**/*.stories.tsx',
        'src/storybook/**',
      ],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
