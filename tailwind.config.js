/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F9F7',
          100: '#CCF3EF',
          200: '#99E7DF',
          300: '#66DBCF',
          400: '#4ECDC4', // Main Primary
          500: '#3DB5AC',
          600: '#319088',
          700: '#256C66',
          800: '#194844',
          900: '#0C2422',
        },
        secondary: {
          50: '#F0F1F2',
          100: '#E1E3E5',
          200: '#C3C7CB',
          300: '#A5ABB1',
          400: '#878F97',
          500: '#556270', // Main Secondary
          600: '#444E5A',
          700: '#333B43',
          800: '#22272D',
          900: '#111416',
        },
        accent: {
          main: '#A3E5C3',
          dark: '#5BCF93',
        },
        arctic: {
          light: {
            background: '#F7FFFE',
            foreground: '#2C3539',
            card: '#FFFFFF',
            border: '#E1E3E5',
            muted: '#F0FEFD',
          },
          dark: {
            background: '#1A2023',
            foreground: '#F7FFFE',
            card: '#232A2E',
            border: '#333B43',
            muted: '#333B43',
          },
        },
        surface: {
          light: '#F7FFFE',
          dark: '#1A2023',
        },
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
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}


