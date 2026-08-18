// Session persistence — platform-aware:
//   web:    localStorage (synchronous, also read at module load for instant hydration)
//   native: expo-secure-store (Keychain on iOS — survives app restarts)
// Stores user identity permanently + access token with a 55-min expiry.
// Long-term auth comes from the sidecar-held refresh token (lib/tokens.ts).

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { GoogleUser } from "../store/authStore";

const KEY = "lore_session_v1";
// SecureStore keys must be alphanumeric/._- only.
const NATIVE_KEY = "lore_session_v1";

interface Stored {
  user: GoogleUser;
  accessToken: string;
  expiresAt: number; // ms epoch
}

function webStorage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; }
  catch { return null; }
}

function encode(user: GoogleUser, accessToken: string): string {
  const payload: Stored = {
    user,
    accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 min (Google tokens live 60)
  };
  return JSON.stringify(payload);
}

function decode(raw: string | null): { user: GoogleUser; accessToken: string | null } | null {
  try {
    if (!raw) return null;
    const p: Stored = JSON.parse(raw);
    if (!p?.user) return null;
    // Always return the user; only return the token if it's still fresh.
    return { user: p.user, accessToken: Date.now() < p.expiresAt ? p.accessToken : null };
  } catch { return null; }
}

export function persistSession(user: GoogleUser, accessToken: string) {
  const raw = encode(user, accessToken);
  if (Platform.OS === "web") {
    try { webStorage()?.setItem(KEY, raw); } catch {}
  } else {
    SecureStore.setItemAsync(NATIVE_KEY, raw).catch(() => {});
  }
}

/** Async restore — works on every platform. */
export async function restoreSession(): Promise<{ user: GoogleUser; accessToken: string | null } | null> {
  if (Platform.OS === "web") {
    return decode(webStorage()?.getItem(KEY) ?? null);
  }
  try {
    return decode(await SecureStore.getItemAsync(NATIVE_KEY));
  } catch { return null; }
}

/** Sync restore for module-load hydration — web only (returns null on native). */
export function restoreSessionSync(): { user: GoogleUser; accessToken: string | null } | null {
  if (Platform.OS !== "web") return null;
  return decode(webStorage()?.getItem(KEY) ?? null);
}

export function clearSession() {
  if (Platform.OS === "web") {
    try { webStorage()?.removeItem(KEY); } catch {}
  } else {
    SecureStore.deleteItemAsync(NATIVE_KEY).catch(() => {});
  }
}
