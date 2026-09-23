import type { ReactNode } from 'react';
import {
  Download,
  FileText,
  Github,
  Home,
  Languages,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { NoctisLogo } from '@/components/noctis-logo';
import { CONTACT_MAILTO, GITHUB_URL, ORG_SITE } from '@/constants';
import { cn } from '@/lib/utils';
import { getLocale, withLocale, t, localePath } from './i18n';
import { LanguageSwitcher, LOCALE_OPTIONS } from './components/language-switcher';
import { GithubLink } from './components/github-link';

/* The band gutter, from `LandingSection`. Named here because `main` and the
 * footer take the same one as the landing's bands, and three copies of it drift
 * apart the moment one of them is touched. */
const GUTTER = 'px-5 sm:px-8 lg:px-10';

type PageKey = 'home' | 'install' | 'privacy' | 'license';

interface LayoutProps {
  current: PageKey;
  /**
   * Full-bleed main: the page lays its own sections out edge to edge instead of
   * living in the reading column every other page uses. The footer follows,
   * or its rule and its columns stop short of the content they close.
   */
  bleed?: boolean;
  children: ReactNode;
}

interface NavLink {
  key: PageKey;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  /**
   * Which footer column the link belongs to. The header shows every link that
   * is not `home` — the logo already is that link — regardless of section.
   */
  section: 'product' | 'resources';
}

// One list for the header's page nav and the footer's two link columns, so the
// three can never drift apart.
const NAV_LINKS: readonly NavLink[] = [
  { key: 'home', path: '/', labelKey: 'footer.home', icon: Home, section: 'product' },
  { key: 'install', path: '/install/', labelKey: 'nav.install', icon: Download, section: 'product' },
  {
    key: 'privacy',
    path: '/privacy/',
    labelKey: 'nav.privacy',
    icon: ShieldCheck,
    section: 'resources',
  },
  { key: 'license', path: '/license/', labelKey: 'nav.license', icon: FileText, section: 'resources' },
];

/**
 * The brand pairing: noctis.c0nn3ct.info is the product, c0nn3ct.info is who
 * made it. The header carries it so the org is reachable from every page, and
 * the footer echoes it in place of the old "by c0nn3ct.info" byline.
 *
 * Only the product half is a link to home; the org half leaves the site, so it
 * is a separate anchor rather than one link that would go two places.
 */
function BrandLockup({
  homeHref,
  logoClass,
  idSuffix,
  orgClass,
}: {
  homeHref: string;
  logoClass: string;
  /** Header and footer both draw the mark; its internal ids cannot collide. */
  idSuffix: string;
  /** Extra classes for the "× c0nn3ct.info" half; the header drops it on the narrowest phones. */
  orgClass?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <a
        href={homeHref}
        className="m3-state-layer inline-flex min-h-11 items-center gap-2 rounded-pill px-2 text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={t('nav.home_aria')}
      >
        <NoctisLogo idSuffix={idSuffix} className={cn(logoClass, 'text-primary')} />
        <span className="text-title-medium tracking-tight">Noctis</span>
      </a>
      <span aria-hidden="true" className={cn('text-title-medium text-on-surface-variant/50', orgClass)}>
        ×
      </span>
      <a
        href={ORG_SITE}
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          'inline-flex min-h-11 items-center rounded-sm px-1 text-label-large text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          orgClass,
        )}
      >
        c0nn3ct.info
      </a>
    </div>
  );
}

/** A footer column: its own landmark, with the visible label naming it. */
function FooterColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label}>
      {/* The nav element already carries the group name, so the visible label
          stays a label instead of adding a heading to every outline. */}
      <div className="mb-2 text-overline uppercase text-on-surface-variant">
        {label}
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </nav>
  );
}

interface FooterLinkProps {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  current?: boolean;
  external?: boolean;
}

function FooterLink({ href, icon: Icon, children, current, external }: FooterLinkProps) {
  return (
    <li>
      <a
        // 24px minimum: at the footer's label size the rows would otherwise sit
        // closer together than a finger can pick them apart.
        className="inline-flex min-h-[24px] items-center gap-2 py-1 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={href}
        aria-current={current ? 'page' : undefined}
        {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {children}
      </a>
    </li>
  );
}

export function Layout({ current, bleed = false, children }: LayoutProps) {
  const homeHref = localePath('/');
  const locale = getLocale();
  // Locale-less path of the page being rendered, so every language link points at
  // this page's translation rather than at the six home pages.
  const currentPath = NAV_LINKS.find((l) => l.key === current)!.path;
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
        {/* Under 360px the lockup and the two 44px buttons need 9px more than
            the bar has, so the org half goes; the footer still carries it. */}
        <BrandLockup
          homeHref={homeHref}
          logoClass="h-6 w-6"
          idSuffix="header"
          orgClass="max-[359px]:hidden"
        />
        {/* Below md the footer carries the same four links, so the header drops
            them rather than crowding the bar. At sm they fit in English and
            not in Russian: "Установка · Приватность · Лицензия" took the bar
            31px past a 640px window and the language menu with it. */}
        <nav aria-label={t('nav.aria')} className="ms-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.filter((l) => l.key !== 'home').map((l) => (
            <a
              key={l.key}
              href={localePath(l.path)}
              aria-current={current === l.key ? 'page' : undefined}
              className={cn(
                'm3-state-layer inline-flex min-h-11 items-center rounded-pill px-3 text-label-large focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                current === l.key ? 'text-on-surface' : 'text-on-surface-variant',
              )}
            >
              {t(l.labelKey)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <GithubLink />
          <LanguageSwitcher />
        </div>
      </header>

      {/* A reading page stands in the landing's own column - same 1160, same
          gutter - so its content starts where a band's does at every width.
          Matching only the padding was not enough: the column used to be
          capped at 768 below `lg`, which put a page of prose far further in
          than the band above it.

          The measure is kept by an inner block, and that block is centred in
          the column. Left-aligned inside it, the whole of the column's slack
          piles up on the end side - 141px of gutter on one edge against 168 on
          the other at 1305 - which reads as broken padding rather than as a
          measure. */}
      <main
        id="main"
        className={
          bleed ? 'w-full flex-1' : cn('mx-auto w-full max-w-[1160px] flex-1 py-10 sm:py-12', GUTTER)
        }
      >
        {bleed ? children : <div className="mx-auto w-full max-w-5xl">{children}</div>}
      </main>

      {/* One column and one gutter for every page, the same ones `main` takes:
          the footer's rule closes the content above it, so a footer on a
          narrower column than the page ends short of what it is closing. The
          measure is again the inner block's, centred, so a page of prose and
          its footer sit on the same two edges. */}
      <footer
        className={cn('mx-auto w-full max-w-[1160px] py-8 text-label-medium text-on-surface-variant', GUTTER)}
      >
        <div
          className={cn(
            'mx-auto flex w-full flex-wrap items-start gap-x-12 gap-y-6 border-t border-outline-variant pt-6',
            // A bleeding page lays its own bands out edge to edge, so the rule
            // closes the whole band rather than a reading measure inside it.
            !bleed && 'max-w-5xl',
          )}
        >
          <div className="flex max-w-[280px] flex-col gap-3">
            <BrandLockup homeHref={homeHref} logoClass="h-5 w-5" idSuffix="footer" />
            <p className="text-body-small text-on-surface-variant">{t('home.description')}</p>
          </div>
          <FooterColumn label={t('footer.product')}>
            {NAV_LINKS.filter((l) => l.section === 'product').map((l) => (
              <FooterLink
                key={l.key}
                href={localePath(l.path)}
                icon={l.icon}
                current={current === l.key}
              >
                {t(l.labelKey)}
              </FooterLink>
            ))}
          </FooterColumn>
          <FooterColumn label={t('footer.resources')}>
            {NAV_LINKS.filter((l) => l.section === 'resources').map((l) => (
              <FooterLink
                key={l.key}
                href={localePath(l.path)}
                icon={l.icon}
                current={current === l.key}
              >
                {t(l.labelKey)}
              </FooterLink>
            ))}
          </FooterColumn>
          {/* Both halves of the product live in one repository since the
              consolidation, so one link reaches the site and the helper alike. */}
          <FooterColumn label={t('footer.contacts')}>
            <FooterLink href={GITHUB_URL} icon={Github} external>
              GitHub
            </FooterLink>
            <FooterLink href={CONTACT_MAILTO} icon={Mail}>
              help@c0nn3ct.info
            </FooterLink>
          </FooterColumn>
        </div>
        {/* The header switcher builds its menu on click, so the prerendered HTML
            carries no link between the locales at all - only hreflang. These are the
            same six URLs as plain markup. One wrapped row rather than a fifth
            column: six stacked items made the footer twice as tall and broke the
            column layout below 900px. */}
        <nav
          aria-label={t('footer.languages')}
          className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-outline-variant pt-4 text-label-medium"
        >
          {/* The icon carries the row; the group name lives on the nav's
              aria-label, so screen readers still announce it. */}
          <Languages className="me-1 h-3.5 w-3.5 shrink-0" aria-hidden />
          {LOCALE_OPTIONS.map((l, i) => (
            <span key={l.code} className="inline-flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-outline-variant">
                  ·
                </span>
              )}
              <a
                className="inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={withLocale(currentPath, l.code)}
                hrefLang={l.code}
                lang={l.code}
                aria-current={l.code === locale ? 'true' : undefined}
              >
                {l.label}
              </a>
            </span>
          ))}
        </nav>
      </footer>
    </div>
  );
}
