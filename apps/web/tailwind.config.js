/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f7f3eb', terracotta: '#b85f42', maroon: '#632f35', turmeric: '#d4a642',
        leaf: '#47735c', ink: '#282622', muted: '#837d73', line: '#e8e1d6', surface: '#fffdf9',
      },
      boxShadow: { card: '0 8px 24px rgba(58, 42, 29, 0.06)' },
      fontFamily: { display: ['Lora', 'Noto Serif Tamil', 'serif'], sans: ['Inter', 'Noto Sans Tamil', 'sans-serif'] },
    },
  },
  plugins: [],
};
