import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    spacing: {
      0: "0px",
      1: "2px",
      2: "4px",
      3: "6px",
      4: "8px",
      5: "10px",
      6: "12px",
      8: "16px",
      10: "20px"
    },
    extend: {
      colors: {
        bg: "#0B0F14",
        surface: "#111827",
        surfaceAlt: "#0F172A",
        border: "#1F2937",
        textPrimary: "#E5E7EB",
        textSecondary: "#9CA3AF",
        textMuted: "#6B7280",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
        successBg: "rgba(16,185,129,0.08)",
        errorBg: "rgba(239,68,68,0.08)",
        warningBg: "rgba(245,158,11,0.08)",
        actionSurface: "#F6F0E3",
        actionBorder: "#E7D6B3",
        actionLabel: "#B45309",
        actionText: "#3F2E1C",
        actionAccent: "#8B4B19",
        ink: "#111827",
        steel: "#4b5563",
        line: "#d1d5db",
        surfaceLegacy: "#f8fafc",
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
