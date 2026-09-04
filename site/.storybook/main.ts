import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {
      strictMode: true,
      // Storybook-only Vite config; see its header for why the app config
      // (24 HTML inputs, publicDir with CNAME + installers, port 5180) is not
      // reused here. Vite resolves this against the working directory, which
      // for every `npm run` in this package is `site/`.
      builder: { viteConfigPath: 'vite.storybook.config.ts' },
    },
  },
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  core: { disableTelemetry: true },
  typescript: {
    // react-docgen-typescript turns the cva `VariantProps` unions into real
    // select controls; the default `react-docgen` reports them as `unknown`.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // Components only. The plugin's default `**/*.tsx` is matched with `glob`,
      // which skips dot-directories, so `.storybook/preview.tsx` came out as a
      // "not included in the active TypeScript project" warning on every build.
      include: ['src/**/*.tsx'],
      shouldExtractLiteralValuesFromEnum: true,
      // Drop props inherited from dependencies (every DOM attribute of
      // React.ButtonHTMLAttributes, all of Radix) so the controls panel shows
      // the component's own API.
      propFilter: (prop) => !prop.parent || !prop.parent.fileName.includes('node_modules'),
    },
  },
};

export default config;
