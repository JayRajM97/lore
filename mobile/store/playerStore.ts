import { create } from "zustand";
import { Episode } from "../lib/types";
import { AudioService } from "../services/AudioService";
import { api } from "../lib/api";

interface PlayerState {
  currentEpisode: Episode | null;
  isPlaying: boolean;
  playbackPosition: number; // seconds
  duration: number; // seconds
  speed: number;
  lyricsOpen: boolean;
  ready: boolean;

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
        if (ep) api.updateProgress(ep.id, get().duration, true);
        set({ isPlaying: false });
      }
    });
    set({ ready: true });
  },

  play: async (episode) => {
    const same = get().currentEpisode?.id === episode.id;
    set({
      currentEpisode: episode,
      duration: episode.audio_duration_s,
      playbackPosition: same ? get().playbackPosition : episode.playback_position_s ?? 0,
    });
    await AudioService.load(episode.audio_url, {
      positionS: same ? get().playbackPosition : episode.playback_position_s ?? 0,
      rate: get().speed,
      autoplay: true,
    });
  },

  resume: async () => {
    await AudioService.play();
  },
  pause: async () => {
    await AudioService.pause();
    const ep = get().currentEpisode;
    if (ep) api.updateProgress(ep.id, get().playbackPosition, false);
  },
  togglePlay: async () => {
    get().isPlaying ? await get().pause() : await get().resume();
  },
  seek: async (seconds) => {
    set({ playbackPosition: seconds });
    await AudioService.seek(seconds);
  },
  skip: async (delta) => {
    const next = Math.min(Math.max(0, get().playbackPosition + delta), get().duration);
    await get().seek(next);
  },
  setSpeed: async (speed) => {
    set({ speed });
    await AudioService.setRate(speed);
  },
  toggleLyrics: () => set((s) => ({ lyricsOpen: !s.lyricsOpen })),
  setLyrics: (open) => set({ lyricsOpen: open }),
}));
