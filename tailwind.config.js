/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        surface:  'var(--bg-surface)',
        inset:    'var(--bg-muted)',
        lift:     'var(--bg-subtle)',
        hairline: 'var(--border-soft)',
      },
    },
  },
  plugins: [],
}
