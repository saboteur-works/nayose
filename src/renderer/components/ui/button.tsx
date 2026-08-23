import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

/*
 * Structural treatment (radius, weight, mono label style, focus ring,
 * disabled opacity) mirrors saboteur-styles Examples/UI Primitives/Buttons
 * (BTN_BASE + Variants story):
 *   - font-mono, tracking-label, uppercase, radius-md, hairline border
 *   - default (primary): solid brand-red fill
 *   - secondary: transparent with an fg-tertiary hairline outline
 *   - ghost (tertiary): no chrome, fg-tertiary label only
 *   - destructive: solid brand-red fill (red is the only chromatic token,
 *     per docs/color-rules.md — destructive reuses it rather than adding
 *     a new one)
 *   - disabled: opacity 0.4, per docs/color-rules.md's disabled-state rule
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono text-[11px] uppercase tracking-label transition-[color,background-color,border-color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-[0.88] active:opacity-[0.72]',
        destructive:
          'bg-destructive text-destructive-foreground hover:opacity-[0.88] active:opacity-[0.72]',
        outline:
          'border border-fg-tertiary bg-transparent text-fg-primary hover:border-brand-mid hover:bg-surface-hover',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-brand-surface',
        ghost: 'bg-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary',
        link: 'bg-transparent text-fg-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-6',
        sm: 'h-8 px-4 text-[10px]',
        lg: 'h-12 px-8 text-xs',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
