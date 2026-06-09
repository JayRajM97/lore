import { create } from "zustand";
import { persistSession, restoreSession, clearSession } from "../lib/session";

export interface GoogleUser {
  sub: string; // stable Google user id
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  // Kept for index.tsx routing logic (returns true if session found).
  restore: () => boolean;
  setSession: (user: GoogleUser, accessToken: string) => void;
  clear: () => void;
}

// Restore synchronously at module load — localStorage is synchronous, so the
// store is pre-populated before any component renders. This means refreshing
// at /home, /library, or any deep URL still has the user object immediately.
const _initial = restoreSession();

export const useAuth = create<AuthState>((set) => ({
  user: _initial?.user ?? null,
  accessToken: _initial?.accessToken ?? null,
  restore: () => {
    const s = restoreSession();
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
