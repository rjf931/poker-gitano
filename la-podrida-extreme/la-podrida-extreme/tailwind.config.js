/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'felt-green': '#1f4e3d',
        'felt-green-light': '#2a6a52',
        'felt-green-dark': '#0d251c',
      }
    },
  },
  plugins: [],
}
