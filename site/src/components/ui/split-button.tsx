import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type Variant = 'elevated' | 'filled' | 'filled-tonal' | 'outlined';
type Size = 'xs' | 's' | 'm';

const containerVariants = cva('inline-flex items-stretch gap-px', {
  variants: {
    size: {
      xs: 'h-8',
      s: 'h-10',
      m: 'h-14',
    },
  },
  defaultVariants: { size: 's' },
});

const segmentBase =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-short ease-spring focus-visible:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-disabled active:scale-[0.97] [&_svg]:shrink-0 select-none';

const segmentVariants = cva(segmentBase, {
  variants: {
    variant: {
      elevated:
        'bg-surface-container-low text-primary shadow-e1 hover:shadow-e2',
      filled: 'bg-primary text-primary-foreground hover:shadow-e1',
      'filled-tonal':
        'bg-secondary-container text-secondary-on-container hover:shadow-e1',
      outlined:
        'border border-outline bg-transparent text-primary hover:bg-primary/[0.08]',
    },
    size: {
      xs: 'text-label-dense [&_svg]:size-4',
      s: 'text-sm [&_svg]:size-[18px]',
      m: 'text-base [&_svg]:size-6',
    },
    role: {
      action: '',
      caret: '',
    },
  },
  compoundVariants: [
    { role: 'action', size: 'xs', className: 'px-3 rounded-l-pill rounded-r-md' },
    { role: 'action', size: 's', className: 'px-5 rounded-l-pill rounded-r-md' },
    { role: 'action', size: 'm', className: 'px-7 rounded-l-pill rounded-r-lg' },
    { role: 'caret', size: 'xs', className: 'w-8 rounded-r-pill rounded-l-md' },
    { role: 'caret', size: 's', className: 'w-10 rounded-r-pill rounded-l-md' },
    { role: 'caret', size: 'm', className: 'w-14 rounded-r-pill rounded-l-lg' },
  ],
  defaultVariants: { variant: 'filled', size: 's', role: 'action' },
});

interface CtxValue {
  variant: Variant;
  size: Size;
}
const Ctx = React.createContext<CtxValue>({ variant: 'filled', size: 's' });

export interface SplitButtonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  variant?: Variant;
}

const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
  ({ className, variant = 'filled', size = 's', ...props }, ref) => (
    <Ctx.Provider value={{ variant, size: size ?? 's' }}>
      <div
        ref={ref}
        role="group"
        className={cn(containerVariants({ size }), className)}
        {...props}
      />
    </Ctx.Provider>
  ),
);
SplitButton.displayName = 'SplitButton';

export interface SplitButtonActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SplitButtonAction = React.forwardRef<HTMLButtonElement, SplitButtonActionProps>(
  ({ className, type = 'button', ...props }, ref) => {
    const { variant, size } = React.useContext(Ctx);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(segmentVariants({ variant, size, role: 'action' }), className)}
        {...props}
      />
    );
  },
);
SplitButtonAction.displayName = 'SplitButtonAction';

export interface SplitButtonCaretProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SplitButtonCaret = React.forwardRef<HTMLButtonElement, SplitButtonCaretProps>(
  ({ className, type = 'button', children, ...props }, ref) => {
    const { variant, size } = React.useContext(Ctx);
    return (
      <button
        ref={ref}
        type={type}
        className={cn(segmentVariants({ variant, size, role: 'caret' }), className)}
        {...props}
      >
        {children ?? <ChevronDown />}
      </button>
    );
  },
);
SplitButtonCaret.displayName = 'SplitButtonCaret';

export { SplitButton, SplitButtonAction, SplitButtonCaret };
