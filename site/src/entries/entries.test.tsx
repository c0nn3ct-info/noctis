import type { ComponentType } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';

// The entry modules are bootstrap scripts: they read the prerendered <html lang>,
// pin the runtime locale and hand their page to mountPage. Stub the mount so no
// page is ever rendered, and spy on setLocale while keeping the real i18n module.
const { mountPage, setLocale } = vi.hoisted(() => ({ mountPage: vi.fn(), setLocale: vi.fn() }));

vi.mock('../main', () => ({ mountPage }));
vi.mock('../i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../i18n')>()),
  setLocale,
}));

const ENTRIES = [
  {
    name: 'home',
    boot: () => import('./home'),
    page: async (): Promise<ComponentType> => (await import('../pages/home')).HomePage,
  },
  {
    name: 'install',
    boot: () => import('./install'),
    page: async (): Promise<ComponentType> => (await import('../pages/install')).InstallPage,
  },
  {
    name: 'license',
    boot: () => import('./license'),
    page: async (): Promise<ComponentType> => (await import('../pages/license')).LicensePage,
  },
  {
    name: 'privacy',
    boot: () => import('./privacy'),
    page: async (): Promise<ComponentType> => (await import('../pages/privacy')).PrivacyPage,
  },
];

const originalLang = document.documentElement.lang;

afterAll(() => {
  document.documentElement.lang = originalLang;
});

for (const { name, boot, page } of ENTRIES) {
  describe(`${name} entry`, () => {
    async function run(lang: string) {
      // Fresh module graph per run — an entry only does its work on first import.
      vi.resetModules();
      mountPage.mockClear();
      setLocale.mockClear();
      document.documentElement.lang = lang;
      await boot();
    }

    it('adopts the prerendered document locale and mounts its page', async () => {
      await run('zh-CN');
      expect(setLocale).toHaveBeenCalledWith('zh-CN');
      expect(mountPage).toHaveBeenCalledTimes(1);
      // Resolved after boot(), so it is the same module instance the entry used.
      expect(mountPage.mock.calls[0][0].type).toBe(await page());
    });

    it('falls back to English when the document lang is not a supported locale', async () => {
      await run('de-AT');
      expect(setLocale).toHaveBeenCalledWith('en');
      expect(mountPage).toHaveBeenCalledTimes(1);
    });
  });
}
