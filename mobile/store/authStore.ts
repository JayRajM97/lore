import { create } from "zustand";
import { persistSession, restoreSession, restoreSessionSync, clearSession } from "../lib/session";

export interface GoogleUser {
  sub: string; // stable Google user id
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  restore: () => Promise<boolean>;
  setSession: (user: GoogleUser, accessToken: string) => void;
  clear: () => void;
}

// Web: localStorage is synchronous, so hydrate before the first render.
// Native: starts null; index.tsx awaits restore() (Keychain) before routing.
const _initial = restoreSessionSync();

export const useAuth = create<AuthState>((set) => ({
  user: _initial?.user ?? null,
  accessToken: _initial?.accessToken ?? null,
  restore: async () => {
    const s = await restoreSession();
    if (!s) return false;
    set({ user: s.user, accessToken: s.accessToken });
    return true;
  },
  setSession: (user, accessToken) => {
    persistSession(user, accessToken);
    set({ user, accessToken });
  },
  clear: () => {
    clearSession();
    set({ user: null, accessToken: null });
  },
}));
