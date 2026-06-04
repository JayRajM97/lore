import { BACKEND_URL } from "./config";
import { WordTs } from "./types";

export interface TtsResult {
  audioUrl: string;
  words: WordTs[];
  durationS: number;
  wordCount: number;
  generationTimeMs: number;
}

// af_heart: American female, warm/soft — the default narration voice.
const VOICE = "af_heart";

export async function synthesize(
  text: string,
): Promise<TtsResult> {
  const res = await fetch(`${BACKEND_URL}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice: VOICE }),
  });
  if (!res.ok) throw new Error(`sidecar ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    audioUrl: `${BACKEND_URL}${data.audio_url}`,
    words: data.words ?? [],
    durationS: data.audio_duration_s ?? 0,
    wordCount: data.word_count ?? 0,
    generationTimeMs: data.generation_time_ms ?? 0,
  };
}
