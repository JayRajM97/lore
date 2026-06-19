// Domain types shared across screens, store, and the (mock) API layer.

export type Frequency = "Daily" | "Weekly" | "Monthly";

export interface Newsletter {
  id: string;
  sender_email: string;
  sender_name: string;
  sender_logo_url?: string | null;
  frequency: Frequency;
  last_received_at: string; // ISO
  is_following?: boolean;
  episode_count?: number;
}

export interface Episode {
  id: string;
  newsletter_id: string;
  sender_name: string;
  sender_logo_url?: string | null;
  subject: string;
  raw_text?: string;
  tts_script?: string;
  audio_url: string;
  audio_duration_s: number;
  received_at: string; // ISO
  words?: WordTs[];          // per-word timestamps from Kokoro, for lyrics sync
  word_count?: number;       // total words synthesized
  generation_time_ms?: number;
  // per-user playback state
  playback_position_s?: number;
  is_completed?: boolean;
  is_saved?: boolean;
}

// Word-level timestamps from the TTS sidecar (for the lyrics view).
export interface WordTs {
  start: number;
  end: number;
}

// ── Public discovery layer (global, shared across all users) ─────────────────

// A newsletter in the public catalog. Doc id = newsletterHash(sender_email).
export interface GlobalNewsletter {
  sender_hash: string;
  sender_name: string;
  sender_email: string;
  logo_url?: string | null;
  frequency?: Frequency | null;
  follower_count: number;
  episode_count: number;
  last_episode_at?: string | null; // ISO
  added_by_uid?: string;
  created_at?: string;
  // client-side only, derived from the signed-in user's `following`:
  is_following?: boolean;
}

// A globally-generated episode (Shared Audio Node). Doc id = episodeHash.
export interface GlobalEpisode {
  episode_hash: string;
  newsletter_id: string; // -> GlobalNewsletter.sender_hash
  subject: string;
  audio_url: string;
  audio_duration_s: number;
  generation_time_ms?: number;
  play_count?: number;
  received_at: string; // ISO
}

// users/{uid}/feed/{episode_hash} — pointer + per-user playback state.
export interface FeedPointer {
  episode_hash: string;
  added_at: string;
  is_played: boolean;
  playback_position_s: number;
}

// Minimal email payload sent to the sidecar /episode endpoint for generation.
export interface FetchedEmailLite {
  subject: string;
  text: string;
  date: string; // ISO received timestamp
}
