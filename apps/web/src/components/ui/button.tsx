'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:pointer-events-none disabled:opacity-45 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-indigo-500 text-white shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-indigo-400 active:scale-[0.99]',
        secondary:
          'bg-[#16181D] text-zinc-200 border border-white/[0.08] hover:border-white/[0.15] hover:bg-[#1C1F27] hover:text-white',
        outline:
          'border border-white/[0.09] bg-transparent text-zinc-300 hover:border-white/[0.18] hover:bg-white/[0.04] hover:text-white',
        ghost: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
        destructive:
          'bg-rose-500/12 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300',
      },
      size: {
        default: 'h-9 px-3.5 text-[13px]',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-lg px-5 text-sm',
        icon: 'h-8 w-8 rounded-lg',
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
