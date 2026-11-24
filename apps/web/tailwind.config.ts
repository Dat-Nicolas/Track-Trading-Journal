import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: '#09090B',
        surface: '#111216',
        elevated: '#16181D',
        background: '#09090B',
        foreground: '#F4F4F5',
        card: {
          DEFAULT: '#111216',
          foreground: '#F4F4F5',
        },
        popover: {
          DEFAULT: '#16181D',
          foreground: '#F4F4F5',
        },
        primary: {
          DEFAULT: '#6366F1',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#16181D',
          foreground: '#E4E4E7',
        },
        muted: {
          DEFAULT: '#1A1C23',
          foreground: '#94949E',
        },
        accent: {
          DEFAULT: '#1C1F27',
          foreground: '#F4F4F5',
        },
        destructive: {
          DEFAULT: '#F43F5E',
          foreground: '#FFFFFF',
        },
        border: 'rgba(255, 255, 255, 0.08)',
        input: 'rgba(255, 255, 255, 0.09)',
        ring: '#6366F1',
        profit: '#10B981',
        loss: '#F43F5E',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
