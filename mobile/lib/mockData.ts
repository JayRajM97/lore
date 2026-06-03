import { Episode, Newsletter } from "./types";

// NOTE: audio_url points at public sample MP3s so the player works in dev
// before the TTS sidecar / backend is wired (step 8). Swap for signed storage
// URLs then. tts_script on the James Clear episode is real preprocessor output
// so the lyrics view shows genuine content.
const SAMPLE = (n: number) =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;

const JAMES_CLEAR_SCRIPT = `Here are three ideas from James Clear.

One.

Improvement is being better than your past self. It doesn't have to be more complicated than that. Do not compare against others, compare against your past self. Keep the focus internal.

[pause]

Two.

You can take things seriously without taking them personally. You don't have to eat everything that is served to you. Take what's useful, do your best to improve, and leave the rest.

[pause]

Three.

With a bow and arrow, you aim before you shoot. But in most areas of life, aiming is something you can do throughout the process. So, pick a direction and get moving.

[pause]

Two quotes from others.

One. Baba Hari Dass, yoga master, on learning: "Teach in order to learn."

[pause]

Two. Computer scientist Alan Kay on the limits of perception: "You can't learn to see until you realize you are blind."

[pause]

And one question to sit with.

Are you building or maintaining?

[pause]

Until next week, James Clear.`;

export const MOCK_NEWSLETTERS: Newsletter[] = [
  {
    id: "nl_james_clear",
    sender_email: "james@jamesclear.com",
    sender_name: "James Clear",
    sender_logo_url: null,
    frequency: "Weekly",
    last_received_at: "2026-04-30T08:00:00Z",
    is_following: true,
    episode_count: 4,
  },
  {
    id: "nl_sahil_bloom",
    sender_email: "sahil@sahilbloom.com",
    sender_name: "Sahil Bloom",
    sender_logo_url: null,
    frequency: "Weekly",
    last_received_at: "2026-04-28T13:00:00Z",
    is_following: true,
    episode_count: 3,
  },
  {
    id: "nl_morning_brew",
    sender_email: "crew@morningbrew.com",
    sender_name: "Morning Brew",
    sender_logo_url: null,
    frequency: "Daily",
    last_received_at: "2026-05-01T10:30:00Z",
    is_following: false,
    episode_count: 12,
  },
  {
    id: "nl_lenny",
    sender_email: "lenny@substack.com",
    sender_name: "Lenny's Newsletter",
    sender_logo_url: null,
    frequency: "Weekly",
    last_received_at: "2026-04-27T15:00:00Z",
    is_following: false,
    episode_count: 5,
  },
  {
    id: "nl_dense_discovery",
    sender_email: "hello@densediscovery.com",
    sender_name: "Dense Discovery",
    sender_logo_url: null,
    frequency: "Weekly",
    last_received_at: "2026-04-25T09:00:00Z",
    is_following: false,
    episode_count: 6,
  },
];

export const MOCK_EPISODES: Episode[] = [
  {
    id: "ep_jc_0430",
    newsletter_id: "nl_james_clear",
    sender_name: "James Clear",
    subject: "3-2-1: On making adjustments and the value of learning",
    tts_script: JAMES_CLEAR_SCRIPT,
    audio_url: SAMPLE(1),
    audio_duration_s: 95,
    received_at: "2026-04-30T08:00:00Z",
    playback_position_s: 32,
    is_completed: false,
    is_saved: true,
  },
  {
    id: "ep_sahil_0428",
    newsletter_id: "nl_sahil_bloom",
    sender_name: "Sahil Bloom",
    subject: "The 1-1-1 Method for a Calmer Mind",
    tts_script: "Here is one idea from Sahil Bloom.\n\nOne.\n\nThe 1-1-1 method. One win, one lesson, one act of gratitude. Do it daily.\n\n[pause]\n\nUntil next week, Sahil.",
    audio_url: SAMPLE(2),
    audio_duration_s: 220,
    received_at: "2026-04-28T13:00:00Z",
    playback_position_s: 0,
    is_completed: false,
    is_saved: false,
  },
  {
    id: "ep_brew_0501",
    newsletter_id: "nl_morning_brew",
    sender_name: "Morning Brew",
    subject: "Markets rally as chip stocks surge",
    tts_script: "Good morning. Markets rallied today. Here's what you need to know.\n\n[pause]\n\nThat's all for today.",
    audio_url: SAMPLE(3),
    audio_duration_s: 310,
    received_at: "2026-05-01T10:30:00Z",
    playback_position_s: 0,
    is_completed: false,
    is_saved: false,
  },
  {
    id: "ep_jc_0423",
    newsletter_id: "nl_james_clear",
    sender_name: "James Clear",
    subject: "3-2-1: On focus, fear, and the cost of comfort",
    tts_script: "Here are three ideas from James Clear.\n\nOne.\n\nFocus is a matter of deciding what things you're not going to do.\n\n[pause]\n\nUntil next week, James Clear.",
    audio_url: SAMPLE(4),
    audio_duration_s: 88,
    received_at: "2026-04-23T08:00:00Z",
    playback_position_s: 88,
    is_completed: true,
    is_saved: false,
  },
];

export function episodesForNewsletter(newsletterId: string): Episode[] {
  return MOCK_EPISODES.filter((e) => e.newsletter_id === newsletterId).sort(
    (a, b) => +new Date(b.received_at) - +new Date(a.received_at)
  );
}
