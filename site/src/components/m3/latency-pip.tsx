import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  ms?: number | null;
  pending?: boolean;
  failed?: boolean;
  className?: string;
  /** Localized word for a failed probe. Defaults to the English 'fail'. */
  failLabel?: string;
}

export function LatencyPip({ ms, pending, failed, className, failLabel = 'fail' }: Props) {
  let tone = 'bg-surface-container-high text-on-surface-variant';
  let dot = 'bg-outline';
  let label: React.ReactNode = '—';

  if (pending) {
    label = <Loader2 className="h-3 w-3 animate-spin" />;
  } else if (failed) {
    tone = 'bg-error-container text-error-on-container';
    dot = 'bg-error';
    label = failLabel;
  } else if (typeof ms === 'number') {
    label = `${ms}ms`;
    if (ms < 1000) {
      tone = 'bg-success-container text-success-on-container';
      dot = 'bg-success';
    } else if (ms < 2000) {
      tone = 'bg-warning-container text-warning-on-container';
      dot = 'bg-warning';
    } else {
      tone = 'bg-error-container text-error-on-container';
      dot = 'bg-error';
    }
  }

  // Decorative: the value is carried by the accessible name of the control this
  // pip sits in, so announcing it twice would only add noise.
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-pill px-2 text-label-small tabular-nums',
        tone,
        className,
      )}
    >
      {!pending && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
    </span>
  );
}
