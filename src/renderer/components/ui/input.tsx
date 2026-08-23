import * as React from 'react';

import { cn } from './utils';

/*
 * Mirrors saboteur-styles Examples/UI Primitives/Inputs: transparent
 * background, hairline brand-dim border, radius-md, sans body text,
 * brand-red border on focus (no glow/shadow), fg-faint placeholder,
 * opacity-0.4 disabled state.
 */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-transparent px-4 font-sans text-sm text-fg-primary outline-none transition-[border-color,color] duration-150 ease-out placeholder:text-fg-faint hover:border-brand-mid focus:border-interactive focus-visible:outline-2 focus-visible:outline-interactive focus-visible:-outline-offset-1 disabled:cursor-not-allowed disabled:bg-brand-surface disabled:text-fg-tertiary disabled:opacity-40',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
