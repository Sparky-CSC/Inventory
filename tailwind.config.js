/** @type {import('tailwindcss').Config} */

// Every colour comes from a CSS variable (see src/index.css) so the theme can
// be changed in one place. `withAlpha` lets classes like `bg-primary/10` work.
const withAlpha = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // --- App theme (the names the pages use) ---
        'base-100': withAlpha('base-100'),
        'base-200': withAlpha('base-200'),
        'base-300': withAlpha('base-300'),
        'base-content': withAlpha('base-content'),
        'base-content-secondary': withAlpha('base-content-secondary'),
        primary: {
          DEFAULT: withAlpha('primary'),
          focus: withAlpha('primary-focus'),
          content: withAlpha('primary-content'),
          foreground: withAlpha('primary-content'),
        },
        secondary: {
          DEFAULT: withAlpha('secondary'),
          focus: withAlpha('secondary-focus'),
          content: withAlpha('secondary-content'),
          foreground: withAlpha('secondary-content'),
        },
        info: {
          DEFAULT: withAlpha('info'),
          focus: withAlpha('info-focus'),
          content: withAlpha('info-content'),
        },
        success: {
          DEFAULT: withAlpha('success'),
          focus: withAlpha('success-focus'),
          content: withAlpha('success-content'),
        },
        warning: {
          DEFAULT: withAlpha('warning'),
          focus: withAlpha('warning-focus'),
          content: withAlpha('warning-content'),
        },
        error: {
          DEFAULT: withAlpha('error'),
          focus: withAlpha('error-focus'),
          content: withAlpha('error-content'),
        },

        // --- Names used by the shared UI components (buttons, dialogs …) ---
        background: withAlpha('base-100'),
        foreground: withAlpha('base-content'),
        card: {
          DEFAULT: withAlpha('base-100'),
          foreground: withAlpha('base-content'),
        },
        popover: {
          DEFAULT: withAlpha('base-100'),
          foreground: withAlpha('base-content'),
        },
        muted: {
          DEFAULT: withAlpha('base-200'),
          foreground: withAlpha('base-content-secondary'),
        },
        accent: {
          DEFAULT: withAlpha('base-300'),
          foreground: withAlpha('base-content'),
        },
        destructive: {
          DEFAULT: withAlpha('error'),
          foreground: withAlpha('error-content'),
        },
        border: withAlpha('border'),
        input: withAlpha('border'),
        ring: withAlpha('primary'),
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: withAlpha('base-200'),
          foreground: withAlpha('base-content'),
          primary: withAlpha('primary'),
          'primary-foreground': withAlpha('primary-content'),
          accent: withAlpha('base-300'),
          'accent-foreground': withAlpha('base-content'),
          border: withAlpha('border'),
          ring: withAlpha('primary'),
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
