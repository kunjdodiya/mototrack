/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        moto: {
          orange: '#ff4d00',
          ember: '#ff7a1a',
          magenta: '#ff2d87',
          violet: '#7c3aed',
          cyan: '#22d3ee',
          ink: '#07070a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ff4d00 0%, #ff2d87 55%, #7c3aed 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(255,77,0,0.85) 0%, rgba(255,45,135,0.8) 55%, rgba(124,58,237,0.85) 100%)',
        'moto-mesh':
          'radial-gradient(65% 45% at 15% 0%, rgba(255,77,0,0.28) 0%, transparent 70%), radial-gradient(60% 40% at 85% 10%, rgba(124,58,237,0.25) 0%, transparent 70%), radial-gradient(70% 60% at 50% 100%, rgba(255,45,135,0.2) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-orange': '0 10px 40px -10px rgba(255,77,0,0.55)',
        'glow-violet': '0 10px 40px -10px rgba(124,58,237,0.55)',
        'tab-active': '0 6px 24px -8px rgba(255,77,0,0.75)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.92)', opacity: '0.7' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'gradient-shift': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out both',
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'shimmer': 'shimmer 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
