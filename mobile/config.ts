// TTS sidecar. Production: Cloud Run. For local dev against a Mac-hosted
// sidecar, set EXPO_PUBLIC_BACKEND_URL (see lib/config.ts).
export const SIDECAR_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://lore-sidecar-skm7v5elgq-uc.a.run.app";
