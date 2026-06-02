// Shared formatting helpers for the web player + stats.

/** Seconds -> "m:ss" (e.g. 92 -> "1:32"). */
export function mmss(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Seconds -> "1m 32s" for the stats row. */
export function humanDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Truncate to n chars with an ellipsis. */
export function truncate(text: string, n = 60): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/** audio duration / generation time -> "22x realtime". */
export function realtimeRatio(audioDurationS: number, generationMs: number): string {
  if (generationMs <= 0) return "—";
  const ratio = audioDurationS / (generationMs / 1000);
  return `${ratio.toFixed(1)}x realtime`;
}
