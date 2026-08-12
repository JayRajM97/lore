// Local playback-progress ledger — powers the "Listened" tab and "Listen
// Again" section. Kept in localStorage so it works signed-in or out; the
// player store writes to it on pause/finish, list screens merge it in.

export interface EpProgress {
  playback_position_s: number;
  is_completed: boolean;
  updated_at: number; // ms epoch — for "recently listened" ordering
}

const KEY = "lore_progress_v1";

function storage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; }
  catch { return null; }
}

export function getProgressMap(): Record<string, EpProgress> {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function setProgress(episodeId: string, positionS: number, completed: boolean) {
  try {
    const map = getProgressMap();
    map[episodeId] = {
      playback_position_s: Math.round(positionS),
      is_completed: completed || !!map[episodeId]?.is_completed,
      updated_at: Date.now(),
    };
    storage()?.setItem(KEY, JSON.stringify(map));
  } catch {}
}

/** Merge stored progress into a list of episodes. */
export function withProgress<T extends { id: string; playback_position_s?: number; is_completed?: boolean }>(
  episodes: T[]
): T[] {
  const map = getProgressMap();
  return episodes.map((e) => {
    const p = map[e.id];
    return p
      ? { ...e, playback_position_s: p.playback_position_s, is_completed: p.is_completed }
      : e;
  });
}

/** Episodes with meaningful listening history, most recent first. */
export function listenedOf<T extends { id: string }>(episodes: T[]): T[] {
  const map = getProgressMap();
  return episodes
    .filter((e) => {
      const p = map[e.id];
      return p && (p.is_completed || p.playback_position_s > 30);
    })
    .sort((a, b) => (map[b.id]?.updated_at ?? 0) - (map[a.id]?.updated_at ?? 0));
}
