import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        jakarta: ['var(--font-jakarta)', 'sans-serif'],
      },
      colors: {
        mint: {
          light: '#E4F2EB',
          DEFAULT: '#8BBF9F',
          dark: '#6AAF8A',
          deeper: '#4A9F7A',
        },
        cream: '#FAF8F2',
        charcoal: '#1C2B2B',
      },
      animation: {
        'ticker': 'ticker 30s linear infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'draw-line': 'drawLine 1.2s ease-out forwards',
        'count-badge': 'countBadge 0.4s ease-out forwards',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 191, 159, 0)' },
          '50%': { boxShadow: '0 0 0 10px rgba(139, 191, 159, 0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        drawLine: {
          '0%': { strokeDashoffset: '200' },
          '100%': { strokeDashoffset: '0' },
        },
        countBadge: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
