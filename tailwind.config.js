/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FEF3E8',
          100: '#FCDDB8',
          200: '#FABF80',
          300: '#F7A048',
          400: '#F08828',
          500: '#E87722',
          600: '#D06015',
          700: '#A84D10',
          800: '#7D3A0C',
          DEFAULT: '#E87722',
        },
        secondary: {
          50: '#E8F4EF',
          100: '#C2DDD3',
          200: '#8FBDAA',
          300: '#5E9D84',
          400: '#3D8065',
          500: '#2D6A4F',
          600: '#235640',
          700: '#1A4130',
          DEFAULT: '#2D6A4F',
        },
        accent: {
          50: '#FEF9E9',
          100: '#FCEFC0',
          200: '#F9DF85',
          300: '#F7CF4A',
          400: '#F5BA28',
          500: '#F4A61D',
          DEFAULT: '#F4A61D',
        },
        surface: '#FAFAFA',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
