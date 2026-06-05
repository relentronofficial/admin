import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)"],
        rajdhani: ["var(--font-rajdhani)"],
      },
      colors: {
        primary: {
          DEFAULT: "#e02020", // TBT Red from HTML
          foreground: "#ffffff",
          50: "#fff1f1",
          100: "#ffe1e1",
          200: "#ffc7c7",
          300: "#ffa0a0",
          400: "#ff6969",
          500: "#f83b3b",
          600: "#e61b1b",
          700: "#e02020",
          800: "#a30404",
          900: "#870a0a",
          950: "#4a0000",
        },
        dark: {
          DEFAULT: "#0f0f0f",
          foreground: "#f0f0f0",
          card: "#181818",
          border: "#2a2a2a",
          input: "#1f1f1f",
        }
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
