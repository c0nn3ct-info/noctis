import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-short ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-disabled active:scale-[0.97] [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        filled:
          'bg-primary text-primary-foreground hover:shadow-e1',
        'filled-tonal':
          'bg-secondary-container text-secondary-on-container hover:shadow-e1',
        outlined:
          'border border-outline bg-transparent text-primary hover:bg-primary/[0.08]',
        text:
          'bg-transparent text-primary hover:bg-primary/[0.08]',
        elevated:
          'bg-surface-container-low text-primary shadow-e1 hover:shadow-e2',
        destructive:
          'bg-error text-error-foreground hover:shadow-e1',
        ghost:
          'bg-transparent text-on-surface-variant hover:bg-on-surface/[0.08]',
      },
      size: {
        xs: 'h-8 px-4 text-label-dense rounded-pill [&_svg]:size-4',
        s: 'h-10 px-6 text-sm rounded-pill [&_svg]:size-[18px]',
        m: 'h-14 px-8 text-base rounded-pill [&_svg]:size-6',
        l: 'h-24 px-12 text-xl rounded-xl [&_svg]:size-8',
        xl: 'h-[136px] px-16 text-2xl rounded-2xl [&_svg]:size-10',
      },
      shape: {
        round: '',
        square: '',
      },
    },
    compoundVariants: [
      { variant: 'text', size: 'xs', className: 'px-3' },
      { variant: 'text', size: 's', className: 'px-4' },
      { variant: 'text', size: 'm', className: 'px-6' },
      { shape: 'square', size: 'xs', className: '!rounded-md' },
      { shape: 'square', size: 's', className: '!rounded-md' },
      { shape: 'square', size: 'm', className: '!rounded-lg' },
      { shape: 'square', size: 'l', className: '!rounded-2xl' },
      { shape: 'square', size: 'xl', className: '!rounded-3xl' },
    ],
    defaultVariants: { variant: 'filled', size: 's', shape: 'round' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, shape }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
