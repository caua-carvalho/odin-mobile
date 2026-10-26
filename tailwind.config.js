/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        odin: {
          black: '#0a0a0a',
          graphite: {
            50: '#f0f0f0',
            100: '#e0e0e0',
            200: '#c8c8c8',
            300: '#a8a8a8',
            400: '#888888',
            500: '#686868',
            600: '#505050',
            700: '#383838',
            800: '#282828',
            900: '#181818',
            950: '#0f0f0f',
          },
          orange: {
            50: '#fff4ed',
            100: '#ffe8d1',
            200: '#ffd1a3',
            300: '#ffae6b',
            400: '#ff8c38',
            500: '#ff6b00',
            600: '#e05600',
            700: '#b84200',
            800: '#903300',
            900: '#732a00',
            950: '#3d1500',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}