/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cursor: {
          primary: '#f54e00',
          'primary-active': '#d04200',
          ink: '#26251e',
          body: '#5a5852',
          muted: '#807d72',
          'muted-soft': '#a09c92',
          hairline: '#e6e5e0',
          'hairline-soft': '#efeee8',
          'hairline-strong': '#cfcdc4',
          canvas: '#f7f7f4',
          'canvas-soft': '#fafaf7',
          card: '#ffffff',
          error: '#cf2d56',
          success: '#1f8a65',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        soft: 'none',
        'soft-lg': 'none',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
