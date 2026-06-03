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
