import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  header: string;
  icon: LucideIcon;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Which heading element the header renders as. The section is a document-level
   * heading on the site's long-form pages (h2 under the page h1) and a panel
   * subsection inside the extension (h3), so the level belongs to the caller —
   * hard-coding one produced a skipped level on every page that used it.
   */
  headingLevel?: 2 | 3 | 4;
}

export function Section({
  header,
  icon: Icon,
  count,
  action,
  children,
  headingLevel = 3,
}: Props) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  // A document-level section (h2) also carries document-level weight: the site's
  // pages jumped 32px -> 16px with nothing between. Panel subsections (h3/h4)
  // keep the compact size the extension is built around.
  const headingSize = headingLevel === 2 ? 'text-title-large' : 'text-title-medium';
  // A panel subsection lives in a fixed-width row and truncates. A document
  // heading has to be readable in full: at 390px these lost their tail in every
  // locale, and the license EULA heading lost most of its title in Russian.
  const headingFlow = headingLevel === 2 ? 'text-balance' : 'truncate';
  // A wrapping heading leaves the icon centred against three lines of text, so
  // the document level aligns the row to the top instead. Panel rows are always
  // one line, where the two are indistinguishable.
  const headerAlign = headingLevel === 2 ? 'items-start' : 'items-center';
  return (
    <section className="overflow-hidden rounded-xl bg-surface-container-low">
      <header className={cn('flex gap-3 px-4 pb-3 pt-4', headerAlign)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Heading className={cn('tracking-tight', headingFlow, headingSize)}>{header}</Heading>
          {typeof count === 'number' && (
            <span className="inline-flex items-center rounded-pill bg-surface-container-highest px-2 py-0.5 text-label-medium text-on-surface-variant">
              {count}
            </span>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="space-y-1 px-2 pb-2 pt-1">{children}</div>
    </section>
  );
}

interface SectionLinkProps {
  title: string;
  icon: LucideIcon;
  supporting?: string;
  onClick: () => void;
  className?: string;
}

export function SectionLink({ title, icon: Icon, supporting, onClick, className }: SectionLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'm3-state-layer flex w-full items-center gap-3 overflow-hidden rounded-xl bg-surface-container-low px-4 py-4 text-start transition-colors duration-short ease-emph',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        className,
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary-container text-secondary-on-container">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-title-medium tracking-tight">{title}</span>
        {supporting && (
          <span className="truncate text-label-small text-on-surface-variant">{supporting}</span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-on-surface-variant rtl:-scale-x-100" />
    </button>
  );
}
