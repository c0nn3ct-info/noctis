import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-lg text-on-surface transition-shadow duration-med ease-emph', {
  variants: {
    variant: {
      elevated: 'bg-surface-container-low shadow-e1',
      filled: 'bg-surface-container-high',
      // outline, not outline-variant: the fill is the page background, so the
      // border is the only thing that makes this a container, and the variant
      // tone measured 1.5:1 against it in light mode.
      outlined: 'bg-surface border border-outline',
      tonal: 'bg-primary-container text-primary-on-container',
      accent: 'bg-dir-container text-dir-on-container',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
  },
  defaultVariants: { variant: 'elevated', padding: 'md' },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Element to render as. A card that titles a real section of the page should
   * pass the heading level that fits its outline; the default div is for cards
   * whose title only labels the card itself.
   */
  as?: 'div' | 'h2' | 'h3' | 'h4' | 'h5';
}

export const CardTitle = React.forwardRef<HTMLElement, CardTitleProps>(
  ({ className, as: Comp = 'div', ...props }, ref) => (
    <Comp
      ref={ref as React.Ref<never>}
      className={cn('text-title-medium leading-tight tracking-tight', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm text-on-surface-variant', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 flex items-center gap-2', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { cardVariants };
