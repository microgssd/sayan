import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        heading: v('heading'),
        ink: v('ink'),
        subtle: v('subtle'),
        muted: v('muted'),
        line: v('line'),
        accent: v('accent'),
        'accent-fg': v('accent-fg'),
        'accent-ink': v('accent-ink'),
        brass: v('brass'),
        danger: v('danger'),
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        orbit: 'spin 80s linear infinite',
        'orbit-rev': 'spin 80s linear infinite reverse',
        'orbit-slow-rev': 'spin 140s linear infinite reverse',
      },
    },
  },
  plugins: [],
} satisfies Config;
