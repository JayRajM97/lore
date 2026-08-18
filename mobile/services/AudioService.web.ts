import { Audio, AVPlaybackStatus } from "expo-av";

// WEB audio engine: expo-av (HTML5 audio underneath) + the Media Session API
// so browser/OS media keys and the PWA lock-screen card control playback.
// The native app uses react-native-track-player (see AudioService.ts).

export interface TrackMeta {
  title?: string;
  artist?: string;
  artworkUrl?: string | null;
}

type StatusCb = (s: {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
}) => void;

class AudioServiceImpl {
  private sound: Audio.Sound | null = null;
  private cb: StatusCb | null = null;
  private currentUrl: string | null = null;

  async init() {
    if (typeof Audio.setAudioModeAsync === "function") {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });
      } catch {
        // ignore on platforms that don't support it
      }
    }
  }

  onStatus(cb: StatusCb) {
    this.cb = cb;
  }

  private finite = (n: unknown, fallback = 0) =>
    typeof n === "number" && Number.isFinite(n) ? n : fallback;

  private handleStatus = (status: AVPlaybackStatus) => {
    if (!this.cb) return;
    if (!status.isLoaded) {
      this.cb({ isLoaded: false, isPlaying: false, positionMillis: 0, durationMillis: 0, didJustFinish: false });
      return;
    }
    this.cb({
      isLoaded: true,
      isPlaying: status.isPlaying,
      positionMillis: this.finite(status.positionMillis),
      durationMillis: this.finite(status.durationMillis),
      didJustFinish: status.didJustFinish ?? false,
    });
    this.updatePositionState(status);
  };

  // ── Media Session (browser media keys + PWA lock-screen card) ────────────
  private mediaSessionReady = false;

  private setupMediaSession(meta?: TrackMeta) {
    try {
      const ms = (navigator as any)?.mediaSession;
      if (!ms) return;
      if ("MediaMetadata" in globalThis) {
        ms.metadata = new (globalThis as any).MediaMetadata({
          title: meta?.title ?? "Lore",
          artist: meta?.artist ?? "Lore",
          artwork: meta?.artworkUrl
            ? [{ src: meta.artworkUrl, sizes: "512x512" }]
            : [],
        });
      }
      if (!this.mediaSessionReady) {
        ms.setActionHandler("play", () => this.play());
        ms.setActionHandler("pause", () => this.pause());
        ms.setActionHandler("seekbackward", (d: any) => this.relativeSeek(-(d?.seekOffset ?? 15)));
        ms.setActionHandler("seekforward", (d: any) => this.relativeSeek(d?.seekOffset ?? 15));
        ms.setActionHandler("seekto", (d: any) => {
          if (typeof d?.seekTime === "number") this.seek(d.seekTime);
        });
        this.mediaSessionReady = true;
      }
    } catch {
      // media session unsupported — fine
    }
  }

  private updatePositionState(status: AVPlaybackStatus) {
    try {
      const ms = (navigator as any)?.mediaSession;
      if (!ms?.setPositionState || !status.isLoaded) return;
      const duration = this.finite(status.durationMillis) / 1000;
      if (duration <= 0) return;
      ms.setPositionState({
        duration,
        position: Math.min(this.finite(status.positionMillis) / 1000, duration),
        playbackRate: this.finite((status as any).rate, 1) || 1,
      });
    } catch {
      // ignore
    }
  }

  private async relativeSeek(delta: number) {
    const pos = await this.positionS();
    await this.seek(Math.max(0, pos + delta));
  }

  async load(url: string, opts?: { positionS?: number; rate?: number; autoplay?: boolean }, meta?: TrackMeta) {
    if (this.currentUrl === url && this.sound) {
      if (opts?.autoplay) await this.sound.playAsync();
      this.setupMediaSession(meta);
      return;
    }
    await this.unload();
    const startMs = Math.max(0, Math.round(this.finite(opts?.positionS) * 1000));
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      {
        shouldPlay: opts?.autoplay ?? true,
        positionMillis: startMs,
        rate: opts?.rate ?? 1,
        shouldCorrectPitch: true,
        progressUpdateIntervalMillis: 100,
      },
      this.handleStatus
    );
    this.sound = sound;
    this.currentUrl = url;
    this.setupMediaSession(meta);
  }

  async unload() {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch {
        // ignore
      }
      this.sound = null;
      this.currentUrl = null;
    }
  }

  async play() {
    await this.sound?.playAsync();
  }
  async pause() {
    await this.sound?.pauseAsync();
  }
  async seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    await this.sound?.setPositionAsync(Math.max(0, Math.round(seconds * 1000)));
  }
  async setRate(rate: number) {
    await this.sound?.setRateAsync(rate, true);
  }
  /** Live position read for rAF loops (avoids store churn). */
  async positionS(): Promise<number> {
    const st = await this.sound?.getStatusAsync();
    return st && st.isLoaded ? (st.positionMillis ?? 0) / 1000 : 0;
  }
}

export const AudioService = new AudioServiceImpl();
