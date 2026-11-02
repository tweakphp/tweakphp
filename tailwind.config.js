const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  safelist: [
    {
      pattern:
        /text-(red|green|blue|yellow|indigo|purple|pink|gray|white|black|orange|lime|emerald|teal|cyan|sky|violet|rose|fuchsia|amber|slate|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900)/,
      variants: [], // Ensure dark mode variants are also included
    },
    {
      pattern:
        /bg-(red|green|blue|yellow|indigo|purple|pink|gray|white|black|orange|lime|emerald|teal|cyan|sky|violet|rose|fuchsia|amber|slate|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900)/,
      variants: [],
    },
  ],
  theme: {
    extend: {
      colors: {
        gray: colors.neutral,
        primary: {
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
