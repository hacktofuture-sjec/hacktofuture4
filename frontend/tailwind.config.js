/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0f16',
        primary: '#34d399',
        alert: '#f43f5e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        md: '12px',
      },
      keyframes: {
        slideUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        glitch: {
          '0%, 100%': { transform: 'none' },
          '33%': { transform: 'translateX(-2px) skewX(1deg)' },
          '66%': { transform: 'translateX(2px) skewX(-1deg)' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.4s ease both',
        'fade-in': 'fadeIn 0.3s ease both',
        'glitch': 'glitch 0.4s ease infinite',
      },
    },
  },
  plugins: [],
}
