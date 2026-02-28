import * as React from 'react';
import { cn } from '@/lib/utils';

export const Button = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn('h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm hover:bg-zinc-700', className)}
    {...props}
  />
);
