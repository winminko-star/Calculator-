/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",          // root HTML
    "./src/**/*.{js,jsx,ts,tsx}" // src အတွင်း JS/JSX/TS/TSX files အကုန် scan
  ],
  theme: {
    extend: {}, // custom theme extensions (optional)
  },
  plugins: [], // Tailwind plugins (optional)
}
