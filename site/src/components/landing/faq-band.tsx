import { Github, Mail } from 'lucide-react';
import { FaqList } from '@/components/faq-section';
import { CONTACT_MAILTO, GITHUB_URL } from '@/constants';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { InstallButton } from './cta-pair';

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
      <div data-enter="soft">
        <h2 className="text-balance text-[clamp(28px,3.6vw,40px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          {t('home.faq.h2')}
        </h2>
        <p className="mt-4 text-pretty text-body-large leading-[1.7] text-on-surface-variant">
          {t('home.faq.lede')}
        </p>

        <div className="mt-7 flex flex-col gap-3 border-t border-outline-variant pt-6">
          <span className="text-label-small uppercase tracking-[0.14em] text-on-surface-variant">
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

        {/* One button, across the column. The store is already reachable from
            the header, the footer and the hero, so a second button here turned
            the column's last row into a choice instead of a next step. */}
        <InstallButton block className="mt-8" />
      </div>

      {/* Wrapped, and as one object rather than a stagger: `FaqList` is the
          live home page's list too, and the entrance rules are global, so an
          attribute inside it would animate a page that never asked. */}
      <div data-enter="soft">
        <FaqList variant="flush" openFirst />
      </div>
    </div>
  );
}
