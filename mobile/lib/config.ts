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

// TTS backend (Kokoro sidecar). On web the browser runs on the same machine as
// the sidecar → localhost. On a physical phone, localhost is the phone itself,
// so it must hit the Mac's LAN IP. Update LAN_IP to `ipconfig getifaddr en0`.
import { Platform } from "react-native";

const LAN_IP = "192.168.0.4"; // Mac's current LAN IP (changes between networks)
export const BACKEND_URL =
  Platform.OS === "web" ? "http://localhost:8000" : `http://${LAN_IP}:8000`;
