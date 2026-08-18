// v6 has no exports map; the providers live under build/.
import * as Google from "expo-auth-session/build/providers/Google";
import { ResponseType, makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_REVERSED, GOOGLE_SCOPES } from "./config";
import { GoogleUser } from "../store/authStore";

// Required so the auth popup can hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

// Must EXACTLY match an authorized redirect URI on the Google web client
// (https://lore-app-lake.vercel.app in prod, http://localhost:8081 in dev).
export const WEB_REDIRECT_URI =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : makeRedirectUri();

// Web: AUTHORIZATION-CODE flow. The code is exchanged by the sidecar (which
// holds the client secret) for an access token + a long-lived REFRESH token,
// so after the first consent the user never sees a Google popup again —
// "Sync" silently mints fresh tokens server-side.
// access_type=offline + prompt=consent is what makes Google issue the refresh
// token. Native keeps the implicit flow until the dev-build work lands.
export function useGoogleAuth() {
  return Google.useAuthRequest(
    Platform.OS === "web"
      ? {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          scopes: GOOGLE_SCOPES,
          responseType: ResponseType.Code,
          shouldAutoExchangeCode: false,
          redirectUri: WEB_REDIRECT_URI,
          extraParams: { access_type: "offline", prompt: "consent" },
        }
      : {
          iosClientId: GOOGLE_IOS_CLIENT_ID,
          webClientId: GOOGLE_WEB_CLIENT_ID,
          scopes: GOOGLE_SCOPES,
          // auth-session v7 defaults to the app scheme (lore:/...), which
          // Google's iOS client rejects; it only accepts its reversed-id scheme.
          redirectUri: `${GOOGLE_IOS_REVERSED}:/oauth2redirect`,
        }
  );
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
