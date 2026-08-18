import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from "react-native-track-player";

// NATIVE audio engine: react-native-track-player. Gives us what expo-av
// can't: background playback with a lock-screen / notification card showing
// artwork + title, with play/pause, ±15s jumps, and scrubbing.
// (Web resolves AudioService.web.ts instead — expo-av + Media Session.)

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

// Handles remote-control events from the lock screen / notification.
// Registered at module scope so it's in place before any playback starts.
TrackPlayer.registerPlaybackService(() => async () => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (e) => {
    const p = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.min(p.position + (e.interval ?? 15), p.duration || p.position + 15));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (e) => {
    const p = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, p.position - (e.interval ?? 15)));
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));
});

class AudioServiceImpl {
  private cb: StatusCb | null = null;
  private currentUrl: string | null = null;
  private setup = false;
  private lastPlaying = false;
  private lastPos = 0;
  private lastDur = 0;

  async init() {
    if (this.setup) return;
    try {
      await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    } catch (e: any) {
      // "player already initialized" after a JS reload — safe to continue
      if (!String(e?.message ?? e).includes("already been initialized")) throw e;
    }
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.JumpForward,
        Capability.JumpBackward,
      ],
      forwardJumpInterval: 15,
      backwardJumpInterval: 15,
      progressUpdateEventInterval: 0.25,
    });

    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (e) => {
      this.lastPos = e.position;
      this.lastDur = e.duration;
      this.emit(false);
    });
    TrackPlayer.addEventListener(Event.PlaybackState, (e) => {
      this.lastPlaying = e.state === State.Playing;
      this.emit(false);
    });
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
      this.lastPlaying = false;
      this.emit(true);
    });
    this.setup = true;
  }

  private emit(didJustFinish: boolean) {
    this.cb?.({
      isLoaded: !!this.currentUrl,
      isPlaying: this.lastPlaying,
      positionMillis: this.lastPos * 1000,
      durationMillis: this.lastDur * 1000,
      didJustFinish,
    });
  }

  onStatus(cb: StatusCb) {
    this.cb = cb;
  }

  async load(url: string, opts?: { positionS?: number; rate?: number; autoplay?: boolean }, meta?: TrackMeta) {
    await this.init();
    if (this.currentUrl === url) {
      if (opts?.autoplay) await TrackPlayer.play();
      return;
    }
    await TrackPlayer.reset();
    await TrackPlayer.add({
      url,
      title: meta?.title ?? "Lore episode",
      artist: meta?.artist ?? "Lore",
      artwork: meta?.artworkUrl ?? undefined,
    });
    this.currentUrl = url;
    if (opts?.positionS && opts.positionS > 0) await TrackPlayer.seekTo(opts.positionS);
    if (opts?.rate && opts.rate !== 1) await TrackPlayer.setRate(opts.rate);
    if (opts?.autoplay ?? true) await TrackPlayer.play();
  }

  async unload() {
    try {
      await TrackPlayer.reset();
    } catch {
      // ignore
    }
    this.currentUrl = null;
  }

  async play() {
    await TrackPlayer.play();
  }
  async pause() {
    await TrackPlayer.pause();
  }
  async seek(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    await TrackPlayer.seekTo(Math.max(0, seconds));
    this.lastPos = Math.max(0, seconds);
  }
  async setRate(rate: number) {
    await TrackPlayer.setRate(rate);
  }
  /** Live position read for rAF loops. */
  async positionS(): Promise<number> {
    try {
      const p = await TrackPlayer.getProgress();
      return p.position;
    } catch {
      return this.lastPos;
    }
  }
}

export const AudioService = new AudioServiceImpl();
