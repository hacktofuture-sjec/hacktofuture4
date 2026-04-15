/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0D0E15',
        surface: '#1A1C28',
        primary: '#6366F1',
        secondary: '#EC4899',
        tertiary: '#8B5CF6',
        textMain: '#F8FAFC',
        textMuted: '#94A3B8'
      }
    },
  },
  plugins: [],
}
