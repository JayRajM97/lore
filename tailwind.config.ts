import type { Config } from "tailwindcss";

// Locked Readio / Lore palette — reference tokens, never raw hexes in components.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF8",
        surface: "#F1EFE8",
        border: "#D3D1C7",
        ink: "#2C2C2A",
        muted: "#5F5E5A",
        teal: "#0F6E56",
        teal50: "#E1F5EE",
        indigo: "#534AB7",
        coral: "#D85A30",
        coral50: "#FAECE7",
        amber: "#BA7517",
        amber50: "#FAEEDA",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "12px",
        pill: "100px",
        btn: "8px",
      },
      keyframes: {
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-6px)" },
          "40%,80%": { transform: "translateX(6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        wave: {
          "0%,100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        shake: "shake 0.4s ease-in-out",
        shimmer: "shimmer 1.4s ease-in-out infinite",
        wave: "wave 0.9s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 1px 3px rgba(44,44,42,0.06), 0 1px 2px rgba(44,44,42,0.04)",
        play: "0 6px 16px rgba(15,110,86,0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
