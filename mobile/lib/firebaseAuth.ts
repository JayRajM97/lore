import { signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { auth } from "./firebase";

/**
 * Sign into Firebase using the Google tokens returned by expo-auth-session.
 * Firebase Auth state persists in localStorage (web) so subsequent Storage
 * and Firestore calls will have request.auth populated in security rules.
 *
 * idToken: present when `openid` scope is included (it is in GOOGLE_SCOPES).
 * accessToken: always present after Google OAuth success.
 * Both can be passed; Firebase will accept whichever is valid.
 */
export async function signIntoFirebase(
  idToken: string | null | undefined,
  accessToken: string
): Promise<void> {
  try {
    const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken);
    await signInWithCredential(auth, credential);
  } catch (e) {
    // Non-fatal — Firestore reads still work; Storage uploads will fail and
    // fall back to sidecar URL. User can try re-connecting Gmail to fix.
    console.warn("Firebase sign-in failed:", e);
  }
}
