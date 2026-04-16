/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neonCyan: '#00f5ff',
        neonPurple: '#9d00ff',
        neonPink: '#ff007f',
        neonGreen: '#39ff14',
        neonRed: '#ff1744',
        cyberDark: '#05050a',
        cyberBase: '#0a0a0f',
        cyberPanel: '#12121a'
      },
      fontFamily: {
        rajdhani: ['Rajdhani', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        exo: ['"Exo 2"', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      animation: {
        'scan-beam': 'scanBeam 2s linear infinite',
        'glitch': 'glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'neon-flicker': 'flicker 3s linear infinite',
        'grid-move': 'gridMove 20s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'typing': 'typing 3.5s steps(40, end), blink-caret .75s step-end infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 10s linear infinite',
      },
      keyframes: {
        scanBeam: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        gridMove: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        flicker: {
          '0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100%': { 
             opacity: 1, textShadow: '0 0 5px #00f5ff, 0 0 15px #00f5ff, 0 0 30px #00f5ff' 
          },
          '20%, 21.999%, 63%, 63.999%, 65%, 69.999%': { 
             opacity: 0.4, textShadow: 'none' 
          }
        },
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.5, boxShadow: '0 0 5px #00f5ff, 0 0 10px #00f5ff' },
          '50%': { opacity: 1, boxShadow: '0 0 15px #00f5ff, 0 0 30px #00f5ff' },
        },
        rotateSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        'blink-caret': {
          'from, to': { borderColor: 'transparent' },
          '50%': { borderColor: '#00f5ff' },
        }
      }
    },
  },
  plugins: [],
}
