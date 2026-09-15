/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        // Cairo carries both Latin and Arabic, so one family covers the whole
        // app and nothing re-flows when the language is switched.
        sans: ['Cairo', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Base is 16px, not the usual 14px: this app is built for people who
        // find small text hard to read.
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4rem' }],
        base: ['1rem', { lineHeight: '1.6rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.3125rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.625rem', { lineHeight: '2.2rem' }],
        '3xl': ['2rem', { lineHeight: '2.5rem' }],
        '4xl': ['2.5rem', { lineHeight: '3rem' }],
      },
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdaff', 300: '#8ec2ff',
          400: '#599fff', 500: '#337bf6', 600: '#1f5ceb', 700: '#1a48d8',
          800: '#1c3caf', 900: '#1c378a', 950: '#152354',
        },
        ink: {
          50: '#f7f8fa', 100: '#eef0f4', 200: '#d9dde5', 300: '#b8c0ce',
          400: '#8f9bb0', 500: '#6d7b94', 600: '#57647b', 700: '#475264',
          800: '#3d4654', 900: '#363d48', 950: '#23272f',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      minHeight: {
        // Every interactive control is at least this tall (design rule 5).
        touch: '2.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        lift: '0 4px 12px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
}
