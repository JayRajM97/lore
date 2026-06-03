import { Audio, AVPlaybackStatus } from "expo-av";

// Singleton wrapper around a single expo-av Sound. The Zustand PlayerStore is
// the ONLY thing that talks to this; components talk to the store.
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
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
  }

  onStatus(cb: StatusCb) {
    this.cb = cb;
  }

  private handleStatus = (status: AVPlaybackStatus) => {
    if (!this.cb) return;
    if (!status.isLoaded) {
      this.cb({ isLoaded: false, isPlaying: false, positionMillis: 0, durationMillis: 0, didJustFinish: false });
      return;
    }
    this.cb({
      isLoaded: true,
      isPlaying: status.isPlaying,
      positionMillis: status.positionMillis ?? 0,
      durationMillis: status.durationMillis ?? 0,
      didJustFinish: status.didJustFinish ?? false,
    });
  };

  async load(url: string, opts?: { positionS?: number; rate?: number; autoplay?: boolean }) {
    if (this.currentUrl === url && this.sound) {
      if (opts?.autoplay) await this.sound.playAsync();
      return;
    }
    await this.unload();
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      {
        shouldPlay: opts?.autoplay ?? true,
        positionMillis: Math.round((opts?.positionS ?? 0) * 1000),
        rate: opts?.rate ?? 1,
        shouldCorrectPitch: true,
        progressUpdateIntervalMillis: 250,
      },
      this.handleStatus
    );
    this.sound = sound;
    this.currentUrl = url;
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
    await this.sound?.setPositionAsync(Math.max(0, Math.round(seconds * 1000)));
  }
  async setRate(rate: number) {
    await this.sound?.setRateAsync(rate, true);
  }
  /** Live position read for the lyrics rAF loop (avoids store churn). */
  async positionS(): Promise<number> {
    const st = await this.sound?.getStatusAsync();
    return st && st.isLoaded ? (st.positionMillis ?? 0) / 1000 : 0;
  }
}

export const AudioService = new AudioServiceImpl();
