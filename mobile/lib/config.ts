// Public configuration — these IDs are NOT secret (client IDs ship in the app
// binary by design). The web client SECRET lives only in the backend .env.

// Google OAuth client IDs (from Google Cloud Console / Firebase).
export const GOOGLE_IOS_CLIENT_ID =
  "331040043777-ef75f5ot1po0029u1kjv3gao23khmv8j.apps.googleusercontent.com";
export const GOOGLE_WEB_CLIENT_ID =
  "331040043777-k2fl6kmhe241v6luslejee8lfvcptg2i.apps.googleusercontent.com";

// iOS reversed client id — the URL scheme Google redirects back to.
export const GOOGLE_IOS_REVERSED =
  "com.googleusercontent.apps.331040043777-ef75f5ot1po0029u1kjv3gao23khmv8j";

// Gmail read-only + identity scopes.
export const GOOGLE_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// TTS backend. Production: Cloud Run (ElevenLabs mode). Local dev: set
// EXPO_PUBLIC_BACKEND_URL=http://localhost:8000 (web) or http://<Mac LAN IP>:8000
// (physical phone) before `expo start`.
const CLOUD_RUN_URL = "https://lore-sidecar-skm7v5elgq-uc.a.run.app";
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || CLOUD_RUN_URL;
