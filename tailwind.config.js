/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'instrument-sans': [
          'Instrument Sans',
          'Arial',
          'Helvetica',
          'sans-serif',
        ],
        'chivo-mono': [
          'Chivo Mono',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
