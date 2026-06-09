// Thin localStorage wrapper — web only for now (native: swap to expo-secure-store).
// Stores user identity permanently + access token with expiry.
// Token expiry is ~1h (Google); expired token still lets user see their Library
// (Firestore reads don't need it) but blocks new generation until re-auth.

import { GoogleUser } from "../store/authStore";

const KEY = "lore_session_v1";

interface Stored {
  user: GoogleUser;
  accessToken: string;
  expiresAt: number; // ms epoch
}

function storage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; }
  catch { return null; }
}

export function persistSession(user: GoogleUser, accessToken: string) {
  const s = storage();
  if (!s) return;
  const payload: Stored = {
    user,
    accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 min (Google tokens live 60)
  };
  try { s.setItem(KEY, JSON.stringify(payload)); } catch {}
}

export function restoreSession(): { user: GoogleUser; accessToken: string | null } | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const p: Stored = JSON.parse(raw);
    if (!p?.user) return null;
    // Always return the user; only return the token if it's still fresh.
    return {
      user: p.user,
      accessToken: Date.now() < p.expiresAt ? p.accessToken : null,
    };
  } catch { return null; }
}

export function clearSession() {
  try { storage()?.removeItem(KEY); } catch {}
}
