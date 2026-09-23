/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        medical: {
          bg:      '#0a0f1e',
          surface: '#0d1530',
          card:    '#111b3a',
          border:  '#1e3a6e',
          accent:  '#00d4ff',
          pulse:   '#00ff9d',
          warn:    '#ffb800',
          danger:  '#ff3d5a',
          stable:  '#00d4a0',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
        'fade-in':    'fade-in 0.5s ease-out',
        'slide-up':   'slide-up 0.4s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(0.95)', opacity: '1' },
          '50%':  { transform: 'scale(1.05)', opacity: '0.7' },
          '100%': { transform: 'scale(0.95)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
