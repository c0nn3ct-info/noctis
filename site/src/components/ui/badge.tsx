import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-label-small leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-secondary-container text-secondary-on-container',
        primary: 'bg-primary-container text-primary-on-container',
        outline: 'border border-outline-variant text-on-surface-variant',
        success: 'bg-success-container text-success-on-container',
        info: 'bg-info-container text-info-on-container',
        warning: 'bg-warning-container text-warning-on-container',
        destructive: 'bg-error-container text-error-on-container',
        mono: 'bg-surface-container-highest text-on-surface-variant font-mono tracking-tight',
      },
      size: {
        sm: 'h-5 px-2 text-label-small',
        md: 'h-6 px-2.5 text-label-small',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
