// Public Discovery Layer — client side.
//
// All GLOBAL writes (follower_count, episodes, play_count) go through the
// sidecar's Firebase Admin SDK (see /follow, /episode, /play). The client only:
//   - READS global_newsletters / global_episodes
//   - WRITES its own users/{uid}/feed pointers + `following` array
//
// uid = the FIREBASE AUTH uid (auth.currentUser.uid), NOT the Google `sub`.
// Security rules key user data on request.auth.uid, so every per-user write must
// use this. (Legacy db.ts still uses Google sub — migrate it before enabling the
// strict rules everywhere.)
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { BACKEND_URL } from "./config";
import { newsletterHash } from "./hash";
import { query, orderBy, limit } from "firebase/firestore";
import { GlobalNewsletter, GlobalEpisode, Newsletter, FetchedEmailLite, Episode } from "./types";

export function currentUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── catalog reads ────────────────────────────────────────────────────────────

/** Whole public catalog. Sections (popular/trending/new) are derived from this
 *  one read by client-side sort — avoids composite Firestore indexes at MVP
 *  scale. Swap to paged server queries when the catalog grows large. */
export async function fetchCatalog(following: string[] = []): Promise<GlobalNewsletter[]> {
  const snap = await getDocs(collection(db, "global_newsletters"));
  const follow = new Set(following);
  return snap.docs.map((d) => {
    const data = d.data() as GlobalNewsletter;
    return { ...data, sender_hash: d.id, is_following: follow.has(d.id) };
  });
}

export function sortPopular(items: GlobalNewsletter[]): GlobalNewsletter[] {
  return [...items].sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0));
}
export function sortTrending(items: GlobalNewsletter[]): GlobalNewsletter[] {
  return [...items]
    .filter((n) => n.last_episode_at)
    .sort((a, b) => +new Date(b.last_episode_at!) - +new Date(a.last_episode_at!));
}
export function sortNew(items: GlobalNewsletter[]): GlobalNewsletter[] {
  return [...items].sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0));
}

/** The signed-in user's `following` array (sender_hashes). */
export async function getFollowing(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.following as string[]) ?? [];
}

// ── feed pointer writes (client-owned) ───────────────────────────────────────

async function addFeedPointers(uid: string, episodeHashes: string[]) {
  if (!episodeHashes.length) return;
  const batch = writeBatch(db);
  for (const h of episodeHashes) {
    batch.set(
      doc(db, "users", uid, "feed", h),
      { episode_hash: h, added_at: serverTimestamp(), is_played: false, playback_position_s: 0 },
      { merge: true }
    );
  }
  await batch.commit();
}

// ── follow / unfollow ────────────────────────────────────────────────────────

/** Follow a newsletter that already exists in the catalog. Instant: episodes are
 *  pre-generated (Shared Audio Nodes), so this only bumps the global follower
 *  count (server) and adds feed pointers + `following` (client). No TTS. */
export async function followCatalogNewsletter(uid: string, newsletterId: string): Promise<void> {
  const { episode_hashes } = await post("/follow", { uid, newsletter_id: newsletterId, delta: 1 });
  await addFeedPointers(uid, episode_hashes ?? []);
  await setDoc(doc(db, "users", uid), { following: arrayUnion(newsletterId) }, { merge: true });
}

/** Unfollow: decrement the global count (server), remove feed pointers + the
 *  `following` entry (client). Global episodes are left untouched. */
export async function unfollowNewsletter(
  uid: string,
  newsletterId: string,
  episodeHashes: string[]
): Promise<void> {
  await post("/follow", { uid, newsletter_id: newsletterId, delta: -1 });
  const batch = writeBatch(db);
  for (const h of episodeHashes) batch.delete(doc(db, "users", uid, "feed", h));
  batch.set(doc(db, "users", uid), { following: arrayRemove(newsletterId) }, { merge: true });
  await batch.commit();
}

/** Episode hashes currently in the user's feed for one newsletter — needed to
 *  know which feed pointers to remove on unfollow. */
export async function feedEpisodeHashesFor(uid: string, newsletterId: string): Promise<string[]> {
  const eps = await getDocs(collection(db, "global_episodes"));
  const hashes = eps.docs
    .filter((d) => (d.data() as GlobalEpisode).newsletter_id === newsletterId)
    .map((d) => d.id);
  return hashes;
}

// ── catalog-miss: generate then follow ───────────────────────────────────────

/** Follow a newsletter NOT yet in the catalog (e.g. fresh from a Gmail scan).
 *  Generates each recent email into a global episode (dedup-checked server-side),
 *  then writes feed pointers + `following`. Returns the episode_hashes added. */
export async function generateAndFollow(
  uid: string,
  newsletter: Newsletter,
  emails: FetchedEmailLite[]
): Promise<string[]> {
  const results = await Promise.all(
    emails.map((em) =>
      post("/episode", {
        uid,
        sender_email: newsletter.sender_email,
        sender_name: newsletter.sender_name,
        sender_logo_url: newsletter.sender_logo_url ?? null,
        frequency: newsletter.frequency,
        subject: em.subject,
        text: em.text,
        received_at: em.date,
      }).catch((e) => {
        console.warn("[discovery] episode gen failed:", e);
        return null;
      })
    )
  );
  const hashes = results.filter(Boolean).map((r: any) => r.episode_hash);
  await addFeedPointers(uid, hashes);
  const nlHash = await newsletterHash(newsletter.sender_email);
  await setDoc(doc(db, "users", uid), { following: arrayUnion(nlHash) }, { merge: true });
  return hashes;
}

// ── home feed resolution ─────────────────────────────────────────────────────

/**
 * Resolve the user's feed: read feed POINTERS (users/{uid}/feed), batch-fetch the
 * shared GLOBAL episodes they point at, and merge in per-user playback state.
 * No episode data is duplicated per user — pointers only.
 */
export async function resolveFeed(uid: string): Promise<Episode[]> {
  const feedSnap = await getDocs(
    query(collection(db, "users", uid, "feed"), orderBy("added_at", "desc"), limit(50))
  );
  const pointers = feedSnap.docs;
  if (!pointers.length) return [];

  const globals = await Promise.all(
    pointers.map((p) => getDoc(doc(db, "global_episodes", p.id)))
  );

  // newsletter names/logos for display — fetch the catalog once and index it.
  const catalog = await fetchCatalog();
  const byId = new Map(catalog.map((n) => [n.sender_hash, n]));

  const out: Episode[] = [];
  globals.forEach((g, i) => {
    if (!g.exists()) return;
    const ge = g.data() as GlobalEpisode;
    const ptr = pointers[i].data();
    const nl = byId.get(ge.newsletter_id);
    out.push({
      id: ge.episode_hash,
      newsletter_id: ge.newsletter_id,
      sender_name: nl?.sender_name ?? "Newsletter",
      sender_logo_url: nl?.logo_url ?? null,
      subject: ge.subject,
      audio_url: ge.audio_url,
      audio_duration_s: ge.audio_duration_s,
      received_at: ge.received_at,
      playback_position_s: ptr.playback_position_s ?? 0,
      is_completed: !!ptr.is_played,
    });
  });
  return out;
}

// ── play tracking ────────────────────────────────────────────────────────────

/** Fire-and-forget global play_count increment. Call when audio actually starts. */
export function trackPlay(episodeHash: string): void {
  post("/play", { episode_hash: episodeHash }).catch(() => { /* non-critical */ });
}
