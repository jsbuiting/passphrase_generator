/** @type {import('tailwindcss').Config} */
module.exports = {
  // logic.js / app.js build class names in strings (e.g. bg-red-600), so scan them too.
  content: ['./index.html', './js/**/*.js'],
  theme: { extend: {} },
  plugins: [],
};
