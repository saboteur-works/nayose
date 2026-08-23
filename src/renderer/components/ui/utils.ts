import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard shadcn/ui class-merge helper. Combines conditional class
 * names (clsx) and resolves Tailwind utility conflicts (tailwind-merge).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
