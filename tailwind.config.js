/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        '3xl': '0 20px 60px -5px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}

