// Token lifecycle for "connect once, sync forever".
//
// First connect: the Google auth CODE goes to the sidecar, which exchanges it
// (using the server-held client secret), stores the refresh token in
// Firestore, and returns the access token + user identity.
//
// Every later sync: ensureAccessToken() silently asks the sidecar to mint a
// fresh access token from the stored refresh token. No popup, no re-consent.

import { BACKEND_URL } from "./config";
import { useAuth, GoogleUser } from "../store/authStore";

interface ExchangeResult {
  accessToken: string;
  idToken: string | null;
  hasRefresh: boolean;
  user: GoogleUser;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<ExchangeResult> {
  const res = await fetch(`${BACKEND_URL}/auth/google/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
  });
  if (!res.ok) throw new Error(`exchange failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return {
    accessToken: j.access_token,
    idToken: j.id_token ?? null,
    hasRefresh: !!j.has_refresh,
    user: j.user,
  };
}

/** Fresh access token via the stored refresh token; null = must re-consent. */
export async function silentAccessToken(uid: string): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/google/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * The Sync entry point: returns a usable Gmail access token or null.
 * Order: current in-memory token → silent server-side refresh → null
 * (caller sends the user through the one-time consent screen).
 */
export async function ensureAccessToken(): Promise<string | null> {
  const { user, accessToken, setSession } = useAuth.getState();
  if (accessToken) return accessToken;
  if (!user) return null;
  const fresh = await silentAccessToken(user.sub);
  if (fresh) {
    setSession(user, fresh); // re-persists with a new 55-min expiry
    return fresh;
  }
  return null;
}
