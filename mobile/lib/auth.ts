// v6 has no exports map; the providers live under build/.
import * as Google from "expo-auth-session/build/providers/Google";
import * as WebBrowser from "expo-web-browser";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, GOOGLE_SCOPES } from "./config";
import { GoogleUser } from "../store/authStore";

// Required so the auth popup can hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

// Hook: returns [request, response, promptAsync]. The Google provider uses the
// implicit flow → response.authentication.accessToken (valid ~1h, enough for an
// on-device inbox scan). NOTE: real Google OAuth needs a DEV BUILD
// (`npx expo run:ios`), not Expo Go — Expo Go can't honor the iOS redirect.
export function useGoogleAuth() {
  return Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: GOOGLE_SCOPES,
  });
}

// Resolve the signed-in user's identity from an access token.
export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  const j = await res.json();
  return { sub: j.sub, email: j.email, name: j.name ?? j.email, picture: j.picture };
}
