// Session persistence — belt AND suspenders on native, after a round of
// silent-failure bugs:
//   web:    localStorage (synchronous, hydrates at module load)
//   native: iOS Keychain (expo-secure-store) PLUS an App Group UserDefaults
//           backup (ExtensionStorage — same store the widget uses). Restore
//           tries keychain first, falls back to the backup, and repairs the
//           keychain from the backup when they disagree.
// Every failure is logged, and getSessionDiagnostics() exposes what happened
// so the Profile screen can show it.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { GoogleUser } from "../store/authStore";

const KEY = "lore_session_v1";
const GROUP = "group.com.jayraj.lore";

interface Stored {
  user: GoogleUser;
  accessToken: string;
  expiresAt: number; // ms epoch
}

// ── diagnostics (shown on Profile for debugging stickiness) ─────────────────
let diag = { source: "unrestored", errors: [] as string[] };
export function getSessionDiagnostics() {
  return { ...diag, errors: [...diag.errors] };
}
function logErr(stage: string, e: unknown) {
  const msg = `${stage}: ${String((e as any)?.message ?? e).slice(0, 80)}`;
  diag.errors.push(msg);
  console.warn(`[session] ${msg}`);
}

function webStorage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; }
  catch { return null; }
}

function backupStore() {
  // Same App Group store the widget uses — proven working on this device.
  const { ExtensionStorage } = require("@bacons/apple-targets");
  return new ExtensionStorage(GROUP);
}

function encode(user: GoogleUser, accessToken: string): string {
  const payload: Stored = {
    user,
    accessToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 min (Google tokens live 60)
  };
  return JSON.stringify(payload);
}

function decode(raw: string | null | undefined): { user: GoogleUser; accessToken: string | null } | null {
  try {
    if (!raw) return null;
    const p: Stored = JSON.parse(raw);
    if (!p?.user?.sub) return null;
    // Always return the user; only return the token if it's still fresh.
    return { user: p.user, accessToken: Date.now() < p.expiresAt ? p.accessToken : null };
  } catch { return null; }
}

export function persistSession(user: GoogleUser, accessToken: string) {
  const raw = encode(user, accessToken);
  if (Platform.OS === "web") {
    try { webStorage()?.setItem(KEY, raw); } catch (e) { logErr("web write", e); }
    return;
  }
  SecureStore.setItemAsync(KEY, raw).catch((e) => logErr("keychain write", e));
  try {
    backupStore().set(KEY, raw);
  } catch (e) {
    logErr("backup write", e);
  }
}

/** Async restore — keychain first, App Group backup second (with repair). */
export async function restoreSession(): Promise<{ user: GoogleUser; accessToken: string | null } | null> {
  if (Platform.OS === "web") {
    const s = decode(webStorage()?.getItem(KEY) ?? null);
    diag.source = s ? "localStorage" : "none";
    return s;
  }

  let keychainRaw: string | null = null;
  try {
    keychainRaw = await SecureStore.getItemAsync(KEY);
  } catch (e) {
    logErr("keychain read", e);
  }
  const fromKeychain = decode(keychainRaw);
  if (fromKeychain) {
    diag.source = "keychain";
    return fromKeychain;
  }

  let backupRaw: string | null = null;
  try {
    backupRaw = backupStore().get(KEY) ?? null;
  } catch (e) {
    logErr("backup read", e);
  }
  const fromBackup = decode(backupRaw);
  if (fromBackup) {
    diag.source = "backup";
    // Repair the keychain so next launch takes the fast path.
    if (backupRaw) SecureStore.setItemAsync(KEY, backupRaw).catch((e) => logErr("keychain repair", e));
    return fromBackup;
  }

  diag.source = "none";
  return null;
}

/** Sync restore for module-load hydration — web only (null on native). */
export function restoreSessionSync(): { user: GoogleUser; accessToken: string | null } | null {
  if (Platform.OS !== "web") return null;
  return decode(webStorage()?.getItem(KEY) ?? null);
}

export function clearSession() {
  if (Platform.OS === "web") {
    try { webStorage()?.removeItem(KEY); } catch {}
    return;
  }
  SecureStore.deleteItemAsync(KEY).catch(() => {});
  try {
    const { ExtensionStorage } = require("@bacons/apple-targets");
    ExtensionStorage.remove?.(KEY, GROUP);
    // Fallback: overwrite with empty if remove isn't exposed on this version.
    backupStore().set(KEY, "");
  } catch {}
}
