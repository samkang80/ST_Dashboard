import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 text-sm text-zinc-100', className)}
    {...props}
  />
));
Input.displayName = 'Input';
