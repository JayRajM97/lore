import { BACKEND_URL } from "./config";
import { WordTs } from "./types";

export interface TtsResult {
  audioUrl: string;
  words: WordTs[];
  durationS: number;
}

export async function synthesize(
  text: string,
  senderName: string
): Promise<TtsResult | null> {
  const res = await fetch(`${BACKEND_URL}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      description: `narrator reading a newsletter from ${senderName}`,
    }),
  });
  if (!res.ok) throw new Error(`sidecar ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    audioUrl: `${BACKEND_URL}${data.audio_url}`,
    words: data.words ?? [],
    durationS: data.audio_duration_s ?? 0,
  };
}
