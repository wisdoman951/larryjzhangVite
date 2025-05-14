// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // 掃描 HTML 檔案
    "./src/**/*.{js,ts,jsx,tsx}", // 掃描 src 目錄下所有 JS/TS/JSX/TSX 檔案
  ],
  theme: {
    extend: {
      // 在這裡可以擴展您的 Tailwind 主題，例如自訂顏色、字體等
      // 例如，為了您之前的 text-shadow 和 animate-pulse-slow：
      textShadow: { // 您可能需要一個 text-shadow 的 plugin，或者手動在 CSS 中定義
        'sm': '0 1px 2px var(--tw-shadow-color)',
        'md': '0 2px 4px var(--tw-shadow-color)',
        'lg': '0 4px 8px var(--tw-shadow-color)',
      },
      animation: {
        'pulse-slow': 'pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        }
      }
    },
  },
  plugins: [
    // 如果您想用 text-shadow utilities，可能需要 require('tailwindcss-textshadow') 並安裝它
    // require('tailwindcss-textshadow'), 
  ],
}