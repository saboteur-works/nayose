import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from './utils';

/*
 * Mirrors saboteur-styles Examples/UI Primitives/Badges: mono 10px,
 * tracking-label, uppercase, radius-sm. "Live"/"Canonical" (red) are
 * reserved per docs/color-rules.md ("Live and Canonical are the only
 * badges that may use Signal red") — default/destructive variants here
 * carry that red; secondary/outline stay in the grey palette.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-2 py-1 font-mono text-[10px] uppercase leading-none tracking-label transition-[color,background-color,border-color] duration-150 ease-out',
  {
    variants: {
      variant: {
        default: 'border border-transparent bg-brand-red text-fg-primary',
        secondary: 'border border-transparent bg-brand-surface2 text-fg-tertiary',
        outline: 'border border-brand-red bg-transparent text-brand-red',
        muted: 'border border-brand-dim bg-transparent text-fg-tertiary',
        destructive: 'border border-transparent bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
