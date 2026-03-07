/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        '3xl': '0 10px 40px -5px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}

