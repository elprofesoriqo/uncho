import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#070c18",
        surface: "#0d1424",
        "surface-2": "#111928",
        "surface-3": "#16213a",
        border: "#1a2538",
        "border-2": "#253347",
        accent: "#3b82f6",
        "accent-dim": "#1d4ed8",
        sky: "#0ea5e9",
        text: "#e2e8f0",
        muted: "#94a3b8",
        faint: "#475569",
        severe: "#dc2626",
        high: "#ea580c",
        medium: "#ca8a04",
        adequate: "#65a30d",
        covered: "#16a34a",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "count-up": "countUp 1s ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideIn: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
