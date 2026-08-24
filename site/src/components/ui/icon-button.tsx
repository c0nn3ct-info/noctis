import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-short ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-disabled active:scale-[0.94] [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        filled: 'bg-primary text-primary-foreground hover:shadow-e1',
        'filled-tonal':
          'bg-secondary-container text-secondary-on-container hover:shadow-e1',
        outlined:
          'border border-outline bg-transparent text-on-surface-variant hover:bg-on-surface/[0.08]',
        standard:
          'bg-transparent text-on-surface-variant hover:bg-on-surface/[0.08]',
      },
      size: {
        xs: 'h-8 w-8 [&_svg]:size-4',
        s: 'h-10 w-10 [&_svg]:size-5',
        m: 'h-14 w-14 [&_svg]:size-6',
        l: 'h-24 w-24 [&_svg]:size-8',
        xl: 'h-[136px] w-[136px] [&_svg]:size-10',
      },
      shape: {
        round: 'rounded-pill',
        square: '',
      },
    },
    compoundVariants: [
      { shape: 'square', size: 'xs', className: 'rounded-md' },
      { shape: 'square', size: 's', className: 'rounded-md' },
      { shape: 'square', size: 'm', className: 'rounded-lg' },
      { shape: 'square', size: 'l', className: 'rounded-2xl' },
      { shape: 'square', size: 'xl', className: 'rounded-3xl' },
    ],
    defaultVariants: { variant: 'standard', size: 's', shape: 'round' },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(iconButtonVariants({ variant, size, shape }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
