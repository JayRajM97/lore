import { create } from "zustand";

export interface GoogleUser {
  sub: string; // stable Google user id
  email: string;
  name: string;
  picture?: string;
}

interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  setSession: (user: GoogleUser, accessToken: string) => void;
  clear: () => void;
}

// In-memory session for the MVP (re-auth on app restart). Add expo-secure-store
// persistence when you want sessions to survive relaunch.
export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ user, accessToken }),
  clear: () => set({ user: null, accessToken: null }),
}));
