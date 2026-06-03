// Firestore data layer (real). Test-mode rules for now — see SECURITY note in
// the run docs; tighten before any public release.
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  deleteDoc,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { Newsletter } from "./types";

// users/{userId}/follows/{newsletterId}
function followsCol(userId: string) {
  return collection(db, "users", userId, "follows");
}

export async function saveFollows(userId: string, newsletters: Newsletter[]) {
  await Promise.all(
    newsletters.map((nl) =>
      setDoc(doc(followsCol(userId), nl.id), {
        sender_email: nl.sender_email,
        sender_name: nl.sender_name,
        sender_logo_url: nl.sender_logo_url ?? null,
        frequency: nl.frequency,
        last_received_at: nl.last_received_at,
        episode_count: nl.episode_count ?? 0,
        followed_at: serverTimestamp(),
      })
    )
  );
}

export async function getFollows(userId: string): Promise<Newsletter[]> {
  const snap = await getDocs(followsCol(userId));
  return snap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id,
    is_following: true,
    ...(d.data() as Omit<Newsletter, "id">),
  }));
}

export async function unfollow(userId: string, newsletterId: string) {
  await deleteDoc(doc(followsCol(userId), newsletterId));
}
