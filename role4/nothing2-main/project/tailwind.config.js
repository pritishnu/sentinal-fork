/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05050F',
        'void-light': '#0A0A18',
        panel: '#0F0F1A',
        'panel-light': '#15152A',
        plasma: '#7C3AED',
        cyan: {
          DEFAULT: '#06B6D4',
          glow: '#22D3EE',
        },
        ghost: '#F0EEF8',
        slate: {
          400: '#8B8BA7',
          600: '#4A4A68',
        },
        // Severity colors for report modal
        critical: '#DC2626',
        high: '#F59E0B',
        medium: '#EAB308',
        low: '#3B82F6',
        info: '#6B7280',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        serif: ['"Instrument Serif"', 'serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      animation: {
        scroll: 'scroll 30s linear infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
};
