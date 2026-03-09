import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        steel: "#4b5563",
        line: "#d1d5db",
        surface: "#f8fafc",
        accent: "#b91c1c",
        accentSoft: "#fee2e2"
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      }
    }
  },
  plugins: []
};

export default config;
