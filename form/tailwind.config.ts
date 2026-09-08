import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          500: "#3f6cf5",
          600: "#2e57de",
          700: "#2244b8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
