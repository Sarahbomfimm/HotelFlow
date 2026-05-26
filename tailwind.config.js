/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hotel: {
          blue: '#0A3D62',
          'blue-md': '#1a5276',
          'blue-lg': '#2471a3',
          'blue-dark': '#062135',
          gold: '#C49A6C',
          'gold-lt': '#d4aa7c',
          'gold-dk': '#a07c50',
          light: '#F5F7FA',
          gray: '#E8ECF0',
          'gray-md': '#9EA8B3',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'Montserrat', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(10, 61, 98, 0.08)',
        'card-hover': '0 6px 24px rgba(10, 61, 98, 0.14)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease-out forwards',
      },
    },
  },
  plugins: [],
}

