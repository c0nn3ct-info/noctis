import type { ReactNode } from 'react';
import { Lock, Puzzle, RotateCw } from 'lucide-react';
import { NoctisLogo } from '@/components/noctis-logo';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
}

export function BrowserMock({ children, className }: Props) {
  return (
    <div dir="ltr" className={cn('relative isolate', className)}>
      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low shadow-e4">
        <div className="flex items-center gap-3 border-b border-outline-variant bg-surface-container px-3 py-2">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="ml-1 flex items-center gap-1 text-on-surface-variant">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="flex h-7 flex-1 items-center gap-2 rounded-pill bg-surface-container-highest px-3 text-label-small text-on-surface-variant">
            <Lock className="h-3 w-3" aria-hidden />
            <span className="truncate font-mono">your-favorite-site.com</span>
          </div>
          <div className="flex items-center gap-1.5 pl-1 text-on-surface-variant">
            <Puzzle className="h-4 w-4" aria-hidden />
            <span
              className="relative grid h-7 w-7 place-items-center rounded-md bg-primary-container text-primary-on-container ring-2 ring-primary/40"
              aria-hidden
            >
              <NoctisLogo idSuffix="tab" className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-success ring-2 ring-surface-container" />
            </span>
          </div>
        </div>

        <div className="relative h-[620px] overflow-hidden bg-surface-container-lowest">
          <div
            className="absolute inset-0 opacity-60"
            aria-hidden
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 0%, color-mix(in srgb, hsl(var(--primary)) 18%, transparent), transparent 55%), radial-gradient(circle at 90% 70%, color-mix(in srgb, hsl(var(--tertiary)) 14%, transparent), transparent 60%)',
            }}
          />
          <div className="absolute left-8 top-12 max-w-[55%] space-y-3" aria-hidden>
            <div className="h-3 w-32 rounded bg-outline-variant" />
            <div className="space-y-2">
              <div className="h-2 w-full rounded bg-outline-variant/60" />
              <div className="h-2 w-11/12 rounded bg-outline-variant/60" />
              <div className="h-2 w-9/12 rounded bg-outline-variant/60" />
            </div>
            <div className="h-2 w-1/2 rounded bg-outline-variant/40" />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute right-2 top-[44px] z-10">
        <span
          aria-hidden
          className="absolute -top-1.5 right-[10px] h-3 w-3 rotate-45 border-l border-t border-outline-variant bg-surface-container-low"
        />
        <div className="origin-top-right">{children}</div>
      </div>
    </div>
  );
}
