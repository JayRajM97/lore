import { create } from "zustand";
import { Episode } from "../lib/types";
import { AudioService } from "../services/AudioService";
import { api } from "../lib/api";
import { trackPlay } from "../lib/discovery";
import { synthesizeForEpisode } from "../lib/tts";
import { saveEpisodes } from "../lib/db";
import { setProgress } from "../lib/progress";
import { recordWidgetPlay } from "../lib/widget";
import { useAuth } from "./authStore";

interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  playbackPosition: number; // seconds
  duration: number; // seconds
  speed: number;
  lyricsOpen: boolean;
  ready: boolean;
  generating: boolean; // generate-on-play: synthesizing audio right now

  init: () => Promise<void>;
  play: (episode: Episode) => Promise<void>;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  skip: (delta: number) => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  toggleLyrics: () => void;
  setLyrics: (open: boolean) => void;
}

let wired = false;

export const usePlayer = create<PlayerState>((set, get) => ({
  currentEpisode: null,
  isPlaying: false,
  playbackPosition: 0,
  duration: 0,
  speed: 1,
  lyricsOpen: false,
  ready: false,
  generating: false,

  init: async () => {
    if (wired) return;
    wired = true;
    await AudioService.init();
    AudioService.onStatus((s) => {
      if (!s.isLoaded) return;
      set({
        isPlaying: s.isPlaying,
        playbackPosition: s.positionMillis / 1000,
        duration: s.durationMillis / 1000 || get().duration,
      });
      if (s.didJustFinish) {
        const ep = get().currentEpisode;
        if (ep) {
          api.updateProgress(ep.id, get().duration, true);
          setProgress(ep.id, get().duration, true); // powers Listened/Listen Again
        }
        set({ isPlaying: false });
      }
    });
    set({ ready: true });
  },

  play: async (episode) => {
    const same = get().currentEpisode?.id === episode.id;

    // GENERATE-ON-PLAY: a showcased-but-unsynthesized episode gets its audio
    // made right here, the moment the user actually wants to hear it.
    if ((episode.pending || !episode.audio_url) && episode.raw_text && episode.sender_email) {
      set({
        currentEpisode: episode,
        duration: episode.audio_duration_s,
        playbackPosition: 0,
        generating: true,
        isPlaying: false,
      });
      try {
        const uid = useAuth.getState().user?.sub ?? "anonymous";
        const r = await synthesizeForEpisode({
          uid,
          senderEmail: episode.sender_email,
          senderName: episode.sender_name,
          senderLogoUrl: episode.sender_logo_url,
          frequency: episode.frequency,
          subject: episode.subject,
          text: episode.raw_text,
          receivedAt: episode.received_at,
        });
        episode = {
          ...episode,
          pending: false,
          audio_url: r.audioUrl,
          audio_duration_s: r.durationS,
          converted_at: new Date().toISOString(),
          words: r.words ?? episode.words,
          word_count: r.wordCount ?? episode.word_count,
          generation_time_ms: r.generationTimeMs,
        };
        // Update the session cache + persist the now-real episode.
        (globalThis as any).__lore_episodes = [
          ...(((globalThis as any).__lore_episodes ?? []) as Episode[]).filter((e) => e.id !== episode.id),
          episode,
        ];
        const user = useAuth.getState().user;
        if (user) saveEpisodes(user.sub, [episode]).catch(() => {});
      } catch (e) {
        console.error("[player] generate-on-play failed:", e);
        set({ generating: false });
        return;
      }
      set({ generating: false, currentEpisode: episode });
    }

    // Global play_count: count a genuine new play, not a resume of the same ep.
    // episode.id == episode_hash for shared-audio episodes; no-ops otherwise.
    if (!same) {
      trackPlay(episode.id);
      recordWidgetPlay(episode); // home-screen widget "recently played"
    }
    set({
      currentEpisode: episode,
      duration: episode.audio_duration_s,
      playbackPosition: same ? get().playbackPosition : episode.playback_position_s ?? 0,
    });
    await AudioService.load(
      episode.audio_url,
      {
        positionS: same ? get().playbackPosition : episode.playback_position_s ?? 0,
        rate: get().speed,
        autoplay: true,
      },
      // Lock-screen / notification card metadata
      {
        title: episode.subject,
        artist: episode.sender_name,
        artworkUrl: episode.sender_logo_url,
      }
    );
  },

  resume: async () => {
    await AudioService.play();
  },
  pause: async () => {
    await AudioService.pause();
    const ep = get().currentEpisode;
    if (ep) {
      api.updateProgress(ep.id, get().playbackPosition, false);
      setProgress(ep.id, get().playbackPosition, false);
    }
  },
  togglePlay: async () => {
    get().isPlaying ? await get().pause() : await get().resume();
  },
  seek: async (seconds) => {
    if (!Number.isFinite(seconds)) return;
    set({ playbackPosition: seconds });
    await AudioService.seek(seconds);
  },
  skip: async (delta) => {
    const pos = get().playbackPosition || 0;
    const dur = get().duration || 0;
    const next = dur > 0 ? Math.min(Math.max(0, pos + delta), dur) : Math.max(0, pos + delta);
    await get().seek(next);
  },
  setSpeed: async (speed) => {
    set({ speed });
    await AudioService.setRate(speed);
  },
  toggleLyrics: () => set((s) => ({ lyricsOpen: !s.lyricsOpen })),
  setLyrics: (open) => set({ lyricsOpen: open }),
}));
