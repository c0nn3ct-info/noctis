import { ArrowRight, Chrome, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WEBSTORE_URL } from '@/constants';
import { localePath, t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * The page's one call to action, used in the hero and again under the FAQ.
 *
 * Built the way the aria2t hero builds its pair: a filled pill with an arrow
 * for the step you want the visitor to take, and an outlined one beside it
 * carrying the Chrome mark and an external-link arrow for the store. `size="s"`
 * with `h-12 px-7` — the M3 `s` tier is 40px, which is right in a reading
 * column and slight under a 72px headline.
 *
 * Install goes to the guide, not the store. The extension opens, finds no
 * helper and hands you a one-liner, so the guide is the page that makes the
 * install work; the store is where you get the extension itself, and it is one
 * click either way.
 *
 * No "soon" badge on the store button, unlike aria2t's — that one is disabled
 * because their listing is not live yet. This one is.
 */
/**
 * The step the page wants taken. `block` runs it across its column, for a
 * place where it is the only thing being offered rather than one of two.
 */
export function InstallButton({ block, className }: { block?: boolean; className?: string }) {
  return (
    <Button
      asChild
      variant="filled"
      size="s"
      className={cn('h-12 px-7 text-title-dense', block && 'w-full', className)}
    >
      <a href={localePath('/install/')}>
        {t('home.cta.install')}
        <ArrowRight className="rtl:-scale-x-100" />
      </a>
    </Button>
  );
}

/**
 * Where the extension itself comes from. Leaves the page, and says so twice.
 *
 * It carries a ground of its own, which an outlined button does not normally
 * need: in the hero it stands on the planet, and an outline with nothing
 * inside it reads as a hole cut in the figure rather than as a button. aria2t
 * gives its own hero pair the same treatment for the same reason. Off the
 * scene — under the FAQ — a faint container fill is an ordinary M3 outlined
 * button and costs nothing.
 */
export function StoreButton({ className }: { className?: string }) {
  return (
    <Button
      asChild
      variant="outlined"
      size="s"
      className={cn(
        'h-12 border-outline-variant bg-surface-container-low/80 px-5 text-title-dense backdrop-blur-sm',
        className,
      )}
    >
      <a href={WEBSTORE_URL} target="_blank" rel="noreferrer noopener">
        <Chrome />
        {t('home.cta.webstore')}
        <ExternalLink />
      </a>
    </Button>
  );
}

export function CtaPair({ className }: { className?: string }) {
  return (
    // aria2t's own pair, class for class: full width while they stack, their
    // own width once they sit in a row. Wrapped instead, the two came out at
    // different widths on separate lines, which reads as a layout that ran out
    // of room rather than as a choice between two things.
    <div
      className={cn(
        'flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <InstallButton />
      <StoreButton />
    </div>
  );
}
