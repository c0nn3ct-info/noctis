import { Github, Mail } from 'lucide-react';
import { FaqList } from '@/components/faq-section';
import { CONTACT_MAILTO, GITHUB_URL } from '@/constants';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { InstallButton } from './cta-pair';
import { SECTION_TITLE } from './shell';

/** `mailto:help@c0nn3ct.info` → `help@c0nn3ct.info`, for the visible label. */
export function mailtoAddress(mailto: string): string {
  return mailto.replace(/^mailto:/, '');
}

/** `https://github.com/c0nn3ct-info/noctis` → `github.com/c0nn3ct-info/noctis`. */
export function repoLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * The closing band, built the way the aria2t landing page builds its own: the
 * ten questions this site already answers, set beside the two ways to ask an
 * eleventh.
 *
 * The rows are `FaqList` in its `flush` frame — the same component and the same
 * strings the live home page shows in its boxed one, so the two pages cannot
 * drift apart. Native `<details>`, so every answer is in the prerendered HTML
 * whether or not it is open, and opening one costs no JavaScript.
 *
 * It also carries the page's second call to action, as a single full-width
 * Install. The band is the last thing on the page now that the three-step
 * closer is gone, and a landing page whose final screen offers no way to
 * install is a page that stops rather than ends.
 */
export function FaqBand({ className }: { className?: string }) {
  return (
    <div className={cn('grid gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-20', className)}>
      {/* The heading, its sentence, the two contacts and the button arrive
          one after another rather than as one column. */}
      <div data-enter-stagger="soft">
        <h2 className={SECTION_TITLE}>
          {t('home.faq.h2')}
        </h2>
        <p className="mt-4 text-pretty text-body-large leading-[1.7] text-on-surface-variant">
          {t('home.faq.lede')}
        </p>

        <div className="mt-7 flex flex-col gap-3 border-t border-outline-variant pt-6">
          <span className="text-overline uppercase text-on-surface-variant">
            {t('home.faq.no_answer')}
          </span>
          {/* Labelled by where they go rather than "GitHub" and "Email": the
              destination is the useful half, and both stay `dir="ltr"` so an
              address is not reordered around its @ in Arabic or Farsi. */}
          <a
            className="inline-flex min-h-[44px] items-center gap-2.5 text-body-medium font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Github className="h-4 w-4 shrink-0" aria-hidden />
            <span dir="ltr" className="min-w-0 truncate">
              {repoLabel(GITHUB_URL)}
            </span>
          </a>
          <a
            className="inline-flex min-h-[44px] items-center gap-2.5 text-body-medium font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={CONTACT_MAILTO}
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span dir="ltr" className="min-w-0 truncate">
              {mailtoAddress(CONTACT_MAILTO)}
            </span>
          </a>
        </div>

        {/* One button, across the column. The store is already a button in the
            hero and on the install page, so a second button here turned
            the column's last row into a choice instead of a next step. */}
        <InstallButton block className="mt-8" />
      </div>

      {/* Each question arrives by its own position. `FaqList` is shared, so
          the stagger is its opt-in prop rather than an attribute reached into
          it from here. */}
      <FaqList variant="flush" openFirst stagger="soft" />
    </div>
  );
}
