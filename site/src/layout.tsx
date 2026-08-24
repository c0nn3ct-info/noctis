import type { ReactNode } from 'react';
import { Download, FileText, Github, Home, ShieldCheck } from 'lucide-react';
import { NoctisLogo } from '@/components/noctis-logo';
import { cn } from '@/lib/utils';
import { localePath, t } from './i18n';
import { LanguageSwitcher } from './components/language-switcher';
import { GithubLink } from './components/github-link';

type PageKey = 'home' | 'install' | 'privacy' | 'license';

interface LayoutProps {
  current: PageKey;
  children: ReactNode;
}

const REPO = 'https://github.com/c0nn3ct-info/noctis';

// One list, used by the header on wide screens and the footer everywhere, so the
// two can never drift apart.
const PAGES: ReadonlyArray<{ key: PageKey; path: string; labelKey: string; icon: typeof Home }> = [
  { key: 'home', path: '/', labelKey: 'footer.home', icon: Home },
  { key: 'install', path: '/install/', labelKey: 'nav.install', icon: Download },
  { key: 'privacy', path: '/privacy/', labelKey: 'nav.privacy', icon: ShieldCheck },
  { key: 'license', path: '/license/', labelKey: 'nav.license', icon: FileText },
];

export function Layout({ current, children }: LayoutProps) {
  const homeHref = localePath('/');
  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface">
      {/* First stop for a keyboard user: the header repeats on every page and
          the legal pages are long. Off-screen until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-inverse-surface focus:px-4 focus:py-2 focus:text-label-large focus:text-on-inverse-surface"
      >
        {t('nav.skip')}
      </a>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-outline-variant bg-surface-container-low/95 px-4 backdrop-blur-md sm:px-6">
        <a
          href={homeHref}
          className="m3-state-layer inline-flex items-center gap-2 rounded-pill px-2 py-1 text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t('nav.home_aria')}
        >
          <NoctisLogo className="h-6 w-6 text-primary" />
          <span className="text-title-medium tracking-tight">Noctis</span>
        </a>
        {/* Below sm the footer carries the same four links, so the header drops
            them rather than crowding the bar. */}
        <nav aria-label={t('nav.aria')} className="ms-4 hidden items-center gap-1 sm:flex">
          {PAGES.filter((p) => p.key !== 'home').map((p) => (
            <a
              key={p.key}
              href={localePath(p.path)}
              aria-current={current === p.key ? 'page' : undefined}
              className={cn(
                'm3-state-layer rounded-pill px-3 py-2 text-label-large focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                current === p.key ? 'text-on-surface' : 'text-on-surface-variant',
              )}
            >
              {t(p.labelKey)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <GithubLink />
          <LanguageSwitcher />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:max-w-5xl">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 py-8 text-label-medium text-on-surface-variant sm:px-6 lg:max-w-5xl">
        <div className="border-t border-outline-variant pt-6 flex flex-wrap items-start gap-x-12 gap-y-6">
          <div className="text-label-small">{t('footer.by')}</div>
          {/* The nav element already carries the group name, so the visible
              label stays a label instead of adding a heading to every outline. */}
          <nav aria-label={t('footer.pages')}>
            <div className="mb-2 text-label-small uppercase tracking-[0.12em]">
              {t('footer.pages')}
            </div>
            <ul className="space-y-0.5">
              {PAGES.map((p) => (
                <li key={p.key}>
                  <a
                    className="inline-flex items-center gap-2 py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={localePath(p.path)}
                    aria-current={current === p.key ? 'page' : undefined}
                  >
                    <p.icon className="h-3.5 w-3.5" aria-hidden />
                    {t(p.labelKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t('footer.sources')}>
            <div className="mb-2 text-label-small uppercase tracking-[0.12em]">
              {t('footer.sources')}
            </div>
            {/* Both halves live in one repository since the consolidation, so
                these point at their own subtrees — two labels that resolved to
                the same page read as a broken link. */}
            <ul className="space-y-0.5">
              <li>
                <a
                  className="inline-flex items-center gap-2 py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`${REPO}/tree/master/site`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="h-3.5 w-3.5" aria-hidden />
                  {t('footer.site')}
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2 py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={`${REPO}/tree/master/host`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="h-3.5 w-3.5" aria-hidden />
                  {t('footer.helper')}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
