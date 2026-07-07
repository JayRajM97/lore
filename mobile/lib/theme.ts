import { Platform } from "react-native";

// Locked Readio / Lore palette — single source for all screens.
export const C = {
  bg: "#FAFAF8",
  surface: "#F1EFE8",
  border: "#D3D1C7",
  ink: "#2C2C2A",
  muted: "#5F5E5A",
  teal: "#0F6E56",
  teal50: "#E1F5EE",
  tealDark: "#0A3D2B", // lyrics bg
  indigo: "#534AB7",
  coral: "#D85A30",
  coral50: "#FAECE7",
  amber: "#BA7517",
  amber50: "#FAEEDA",
  white: "#FFFFFF",
};

// Dark immersive player palette (Spotify-mode). Shared by player, lyrics,
// and mini-player accents so the "listening" surfaces feel like one place.
export const P = {
  bg: "#0B0F0D",          // near-black with a green undertone
  bgDeep: "#070A08",
  card: "#151A17",
  accent: "#2FD076",      // vibrant play-green (brand teal's bright sibling)
  accentDim: "rgba(47,208,118,0.14)",
  txt: "#FFFFFF",
  txtMid: "rgba(255,255,255,0.55)",
  txtDim: "rgba(255,255,255,0.28)",
  muted: "rgba(255,255,255,0.4)",
  surface: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.12)",
};

// Curved, friendly edges everywhere (was 12/100/8).
export const RADIUS = { xl: 28, card: 20, btn: 14, chip: 12, pill: 100 };

// Soft elevation. Use SHADOW.card on white cards instead of hairline borders
// alone; SHADOW.float for things hovering above content (mini player, FABs).
export const SHADOW = {
  card: Platform.select({
    web: { boxShadow: "0 1px 2px rgba(44,44,42,0.05), 0 4px 16px rgba(44,44,42,0.07)" } as any,
    default: {
      shadowColor: "#2C2C2A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }),
  float: Platform.select({
    web: { boxShadow: "0 4px 12px rgba(44,44,42,0.12), 0 12px 32px rgba(44,44,42,0.14)" } as any,
    default: {
      shadowColor: "#2C2C2A",
      shadowOpacity: 0.16,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
  }),
  glow: (color: string) =>
    Platform.select({
      web: { boxShadow: `0 6px 24px ${color}66` } as any,
      default: {
        shadowColor: color,
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 5 },
        elevation: 10,
      },
    }),
};

// Substack-style editorial serif for display headlines only; UI text stays sans.
export const SERIF = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia, 'Times New Roman', serif",
});

export const SPEEDS = [0.75, 1, 1.5, 2] as const;
