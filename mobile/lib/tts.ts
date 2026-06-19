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

function resolveAudioUrl(audio_url: string): string {
  // Sidecar returns either a full Firebase Storage URL (starts with https://)
  // or a relative path (/audio/{id}) when Firebase isn't configured.
  return audio_url.startsWith("http") ? audio_url : `${BACKEND_URL}${audio_url}`;
}

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
    audioUrl: resolveAudioUrl(data.audio_url),
    words: data.words ?? [],
    durationS: data.audio_duration_s ?? 0,
    wordCount: data.word_count ?? 0,
    generationTimeMs: data.generation_time_ms ?? 0,
  };
}

export interface EpisodeTtsResult {
  episodeHash: string;
  newsletterId: string;
  reused: boolean;
  audioUrl: string;
  durationS: number;
  subject: string;
  receivedAt: string;
  // Only present when reused === false — see sidecar /episode comment.
  words?: WordTs[];
  wordCount?: number;
  generationTimeMs?: number;
}

/**
 * Shared Audio Node generation: calls /episode instead of /synthesize. Same
 * sender + same calendar day -> server returns the EXISTING audio, zero TTS
 * cost, and the newsletter is upserted into the public global_newsletters
 * catalog (visible on the Discover tab) as a side effect.
 */
export async function synthesizeForEpisode(args: {
  uid: string;
  senderEmail: string;
  senderName: string;
  senderLogoUrl?: string | null;
  frequency?: string | null;
  subject: string;
  text: string;
  receivedAt: string;
}): Promise<EpisodeTtsResult> {
  const res = await fetch(`${BACKEND_URL}/episode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid: args.uid,
      sender_email: args.senderEmail,
      sender_name: args.senderName,
      sender_logo_url: args.senderLogoUrl ?? null,
      frequency: args.frequency ?? null,
      subject: args.subject,
      text: args.text,
      received_at: args.receivedAt,
      voice: VOICE,
    }),
  });
  if (!res.ok) throw new Error(`sidecar /episode ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    episodeHash: data.episode_hash,
    newsletterId: data.newsletter_id,
    reused: !!data.reused,
    audioUrl: resolveAudioUrl(data.audio_url),
    durationS: data.audio_duration_s ?? 0,
    subject: data.subject,
    receivedAt: data.received_at,
    words: data.words,
    wordCount: data.word_count,
    generationTimeMs: data.generation_time_ms,
  };
}
