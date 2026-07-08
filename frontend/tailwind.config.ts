import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#3b6fed",
          600: "#2f5bd1",
          700: "#274aad",
        },
      },
    },
  },
  plugins: [],
};

export default config;
