// Picks which interface the popup band demonstrates, ported from the aria2t
// site's `SurfaceSwitch`. Nothing it renders controls a tabpanel in the ARIA
// sense — it swaps a mock, not a panel — so it is a group of toggle buttons
// with `aria-pressed`, matching the extension's own Segmented control rather
// than a tablist.
import { Puzzle, TerminalSquare } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

export type Surface = 'extension' | 'terminal';

// Extension first: it is the surface that exists, and a group of toggle buttons
// should lead with the one that is pressed.
export const SURFACES: readonly Surface[] = ['extension', 'terminal'];

const ICON = { extension: Puzzle, terminal: TerminalSquare } as const;

/* The terminal client is real and in progress — `host/cmd/noctis` is the CLI
 * and TUI, and `host/internal/ui/` is the interface — but it has not shipped,
 * so the switch shows it rather than offering it. When it does ship, this set
 * empties and the band grows a second mock. */
const SOON: ReadonlySet<Surface> = new Set(['terminal']);

interface Props {
  value: Surface;
  /** Omitted while only one surface exists: there is nothing to switch to. */
  onChange?: (s: Surface) => void;
  className?: string;
}

export function SurfaceSwitch({ value, onChange, className }: Props) {
  return (
    <div
      role="group"
      aria-label={t('home.popup.surface_aria')}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border border-outline-variant bg-surface-container-low p-1',
        className,
      )}
    >
      {SURFACES.map((s) => {
        const Icon = ICON[s];
        const active = s === value;
        const soon = SOON.has(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            // `aria-disabled` rather than `disabled`: a disabled button drops
            // out of the tab order, and then the one thing worth knowing about
            // it — that it is coming — cannot be reached with a keyboard.
            aria-disabled={soon || undefined}
            onClick={soon ? undefined : () => onChange?.(s)}
            className={cn(
              // 44px tall: anything under it is below every touch-target floor.
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-pill px-4 text-label-medium transition-colors duration-short ease-emph',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active && 'bg-secondary-container text-secondary-on-container',
              !active && !soon && 'text-on-surface-variant hover:bg-surface-container-high',
              // Not dimmed: the /70 alpha put the label at 3.35:1 in the light
              // theme, and the badge beside it already says "not yet" — the
              // fade was doing that work a second time, illegibly.
              soon && 'cursor-default text-on-surface-variant',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t(`home.popup.surface_${s}`)}
            {soon && (
              /* Part of the label rather than beside it: "Terminal" alone would
                 announce as a surface you could pick. */
              <span className="rounded-pill bg-surface-container-high px-1.5 py-0.5 text-label-medium uppercase tracking-[0.1em]">
                {t('home.popup.surface_soon')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
