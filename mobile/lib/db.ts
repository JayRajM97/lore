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
import { Newsletter, Episode } from "./types";

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

// ── generated episodes ──────────────────────────────────────────────────────
// users/{userId}/episodes/{episodeId}
//
// words[] is NOT stored inline — a 2500-word newsletter produces ~2500 timestamp
// objects (~100KB), which approaches Firestore's 1MB doc limit and is wasteful.
// Words are kept in-memory (globalThis.__lore_episodes) for the current session;
// lyrics fall back to linear interpolation on reload, which is acceptable.
function episodesCol(userId: string) {
  return collection(db, "users", userId, "episodes");
}

export async function saveEpisodes(userId: string, episodes: Episode[]) {
  const results = await Promise.allSettled(
    episodes.map((e) =>
      setDoc(doc(episodesCol(userId), e.id), {
        newsletter_id: e.newsletter_id,
        sender_name: e.sender_name,
        sender_logo_url: e.sender_logo_url ?? null,
        subject: e.subject,
        raw_text: e.raw_text ?? null,
        tts_script: e.tts_script ?? null,
        blocks: e.blocks ?? null,
        gmail_message_id: e.gmail_message_id ?? null,
        audio_url: e.audio_url,
        audio_duration_s: e.audio_duration_s,
        received_at: e.received_at,
        word_count: e.word_count ?? null,
        generation_time_ms: e.generation_time_ms ?? null,
        created_at: serverTimestamp(),
        // words excluded — too large for inline doc; session-only. blocks are
        // small (text + image URLs) so the rich reader survives reloads.
      })
    )
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(`saveEpisodes: ${failed.length} failed`, failed);
    throw new Error(`Firestore: ${failed.length}/${episodes.length} episode saves failed`);
  }
}

export async function getEpisodes(userId: string): Promise<Episode[]> {
  const snap = await getDocs(episodesCol(userId));
  const eps = snap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id,
    ...(d.data() as Omit<Episode, "id">),
  }));
  // newest first
  return eps.sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at));
}
