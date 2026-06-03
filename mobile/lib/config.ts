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

// TTS backend. For local dev point at the Mac's LAN IP running the sidecar;
// in production set this to the Render URL.
export const BACKEND_URL = "http://192.168.0.6:8000";
