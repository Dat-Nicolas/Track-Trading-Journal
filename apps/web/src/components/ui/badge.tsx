import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'profit' | 'loss' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const styles: Record<NonNullable<BadgeProps['variant']>, string> = {
    default: 'bg-indigo-500/12 text-indigo-300 border-indigo-500/25',
    secondary: 'bg-white/[0.05] text-zinc-300 border-white/[0.08]',
    profit: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    loss: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    outline: 'bg-transparent text-zinc-300 border-white/[0.12]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
