/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          50: '#f0f4ff',
          100: '#dde7ff',
          200: '#c2d3ff',
          300: '#97b4ff',
          400: '#6488f8',
          500: 'var(--primary)',
          600: 'var(--primary)', // Fallback to primary
          700: 'var(--primary)',
          800: 'var(--primary)',
          900: 'var(--primary)',
          950: '#151651',
        },
        surface: {
          900: 'var(--surface-900)',
          800: 'var(--surface-800)',
          700: 'var(--surface-700)',
          600: 'var(--surface-600)',
          500: 'var(--surface-500)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(67,97,238,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(67,97,238,0.6)' },
        },
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
