"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { mmss, truncate } from "@/lib/format";
import StatsBar, { GenStats } from "./StatsBar";

export interface AudioHandle {
  getAudio: () => HTMLAudioElement | null;
}

const SPEEDS = [0.75, 1, 1.5, 2];

// Static amber bar visualizer — cheap, no WebAudio FFT for MVP.
const BARS = Array.from({ length: 48 }, (_, i) =>
  30 + Math.round(40 * Math.abs(Math.sin(i * 0.7) + 0.4 * Math.sin(i * 1.9)))
);

interface Props {
  audioUrl: string | null;
  title: string;
  stats: GenStats | null;
  generating: boolean;
  sidecarUp: boolean | null; // null = unknown/checking
  onProgress?: (current: number, duration: number) => void; // drives word sync
  onToggleLyrics?: () => void; // open the Spotify-style lyrics view
}

const AudioPlayer = forwardRef<AudioHandle, Props>(function AudioPlayer(
  { audioUrl, title, stats, generating, sidecarUp, onProgress, onToggleLyrics },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useImperativeHandle(ref, () => ({ getAudio: () => audioRef.current }), []);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  function report(c: number, d: number) {
    setCurrent(c);
    setDuration(d);
    onProgress?.(c, d);
  }

  // Reset transport when a new clip loads.
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    onProgress?.(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  function skip(delta: number) {
    const a = audioRef.current;
    if (!a) return;
    const t = Math.min(Math.max(0, a.currentTime + delta), duration || 0);
    a.currentTime = t;
    report(t, duration);
  }

  function scrub(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    report(t, duration);
  }

  // ── Error state: sidecar down ────────────────────────────────────────────
  if (sidecarUp === false) {
    return (
      <Centered>
        <div className="max-w-sm rounded-card border-[0.5px] border-border bg-paper p-6 text-center">
          <p className="text-ink">⚠️ TTS server not reachable.</p>
          <p className="mt-1 text-[13px] text-muted">Run the sidecar first:</p>
          <code className="mt-3 block rounded-btn bg-surface px-3 py-2 font-mono text-[12px] text-ink">
            cd sidecar &amp;&amp; uvicorn main:app --host 0.0.0.0 --port 8000
          </code>
        </div>
      </Centered>
    );
  }

  // ── Loading skeleton while generating ────────────────────────────────────
  if (generating) {
    return (
      <Centered>
        <div className="w-full max-w-md space-y-4">
          <div className="h-24 w-full animate-shimmer rounded-card shimmer" />
          <div className="mx-auto h-4 w-2/3 animate-shimmer rounded-pill shimmer" />
          <div className="mx-auto h-16 w-16 animate-shimmer rounded-full shimmer" />
        </div>
      </Centered>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!audioUrl) {
    return (
      <Centered>
        <div className="text-center text-muted">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-[0.5px] border-border bg-paper text-3xl shadow-card">
            🎙️
          </div>
          <p className="text-[15px]">Your audio will appear here</p>
          <p className="mt-1 text-[13px] text-muted/70">Paste text and hit Convert</p>
        </div>
      </Centered>
    );
  }

  // ── Player ───────────────────────────────────────────────────────────────
  const progress = duration ? current / duration : 0;

  return (
    <Centered>
      <div className="w-full max-w-md rounded-card border-[0.5px] border-border bg-paper p-7 shadow-card">
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) =>
            report(e.currentTarget.currentTime, e.currentTarget.duration || 0)
          }
          onTimeUpdate={(e) =>
            report(e.currentTarget.currentTime, e.currentTarget.duration || duration)
          }
          onEnded={() => setPlaying(false)}
        />

        {/* waveform — bars fill amber up to the playhead; gently wave while playing */}
        <div className="flex h-24 items-end justify-center gap-[3px]">
          {BARS.map((h, i) => {
            const active = i / BARS.length <= progress;
            return (
              <div
                key={i}
                style={{ height: `${h}%`, animationDelay: `${(i % 8) * 0.07}s` }}
                className={`w-[3px] origin-bottom rounded-pill ${
                  active ? "bg-amber" : "bg-border"
                } ${playing ? "animate-wave" : ""}`}
              />
            );
          })}
        </div>

        <h2 className="mt-6 truncate text-center text-[15px] font-medium text-ink">
          {truncate(title, 60)}
        </h2>

        {/* progress + timestamps */}
        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={current}
            onChange={scrub}
            className="h-1 w-full cursor-pointer appearance-none rounded-pill bg-border accent-teal"
          />
          <div className="mt-1 flex justify-between font-mono text-[12px] text-muted">
            <span>{mmss(current)}</span>
            <span>{mmss(duration)}</span>
          </div>
        </div>

        {/* controls */}
        <div className="mt-5 flex items-center justify-center gap-6">
          <SkipButton label="-15s" onClick={() => skip(-15)} />
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-teal50 shadow-play transition-transform hover:scale-105 active:scale-95"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <SkipButton label="+15s" onClick={() => skip(15)} />
        </div>

        {/* speed pills */}
        <div className="mt-5 flex justify-center gap-2">
          {SPEEDS.map((s) => {
            const active = s === speed;
            return (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-pill px-3 py-1 text-[13px] transition-colors ${
                  active
                    ? "bg-amber50 font-medium text-amber"
                    : "bg-surface text-[#444441] hover:bg-border/50"
                }`}
              >
                {s}x
              </button>
            );
          })}
        </div>

        {/* lyrics + download */}
        <div className="mt-5 flex justify-between">
          {onToggleLyrics ? (
            <button
              onClick={onToggleLyrics}
              className="flex items-center gap-1.5 rounded-btn border-[0.5px] border-border px-3 py-1.5 text-[13px] text-teal hover:bg-teal50"
            >
              <LyricsIcon /> Lyrics
            </button>
          ) : (
            <span />
          )}
          <a
            href={audioUrl}
            download="lore.mp3"
            className="rounded-btn border-[0.5px] border-border px-3 py-1.5 text-[13px] text-ink hover:bg-paper"
          >
            ↓ Download MP3
          </a>
        </div>

        {stats && <StatsBar stats={stats} />}
      </div>
    </Centered>
  );
});

export default AudioPlayer;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-8">{children}</div>
  );
}

function SkipButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 items-center justify-center rounded-full border-[0.5px] border-border bg-surface px-3 font-mono text-[12px] text-ink transition-colors hover:bg-border/40"
    >
      {label}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

// Spotify-style "lyrics" glyph (quote/mic-ish lines).
function LyricsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h11M4 12h16M4 17h9" />
    </svg>
  );
}
