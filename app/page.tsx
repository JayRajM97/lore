"use client";

import { useEffect, useRef, useState } from "react";
import TextInput from "@/components/TextInput";
import AudioPlayer, { AudioHandle } from "@/components/AudioPlayer";
import WordHighlight, { WordTs } from "@/components/WordHighlight";
import WordSyncView from "@/components/WordSyncView";
import { GenStats } from "@/components/StatsBar";
import { DEFAULT_VOICE } from "@/lib/voices";

export default function Home() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(DEFAULT_VOICE);

  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [syncedText, setSyncedText] = useState(""); // text that produced current audio
  const [wordTs, setWordTs] = useState<WordTs[] | null>(null);
  const [stats, setStats] = useState<GenStats | null>(null);
  const [sidecarUp, setSidecarUp] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [wordSync, setWordSync] = useState(true); // default ON
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  const [lyricsOpen, setLyricsOpen] = useState(false);
  const playerRef = useRef<AudioHandle>(null);

  // Poll sidecar health on mount + every 10s.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const j = await r.json();
        if (alive) setSidecarUp(j.status === "ok");
      } catch {
        if (alive) setSidecarUp(false);
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setToast(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAudioUrl(data.audio_url);
      setSyncedText(text);
      setWordTs(Array.isArray(data.words) ? data.words : null);
      setStats({
        generation_time_ms: data.generation_time_ms,
        audio_duration_s: data.audio_duration_s,
        word_count: data.word_count,
      });
    } catch (e) {
      console.error(e);
      setToast("Generation failed. Check console.");
    } finally {
      setGenerating(false);
    }
  }

  const showHighlight = wordSync && !!audioUrl;

  return (
    <main className="flex h-screen flex-col bg-paper">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-bold tracking-tight text-indigo">
            Lore
          </span>
          <span className="text-[12px] text-muted">TTS Playground</span>
        </div>
        <WordSyncToggle on={wordSync} onChange={setWordSync} />
      </header>

      {/* Split pane */}
      <div className="flex min-h-0 flex-1">
        {/* Left — input or read-along */}
        <section className="h-full w-1/2 border-r border-border bg-paper">
          {showHighlight ? (
            <WordHighlight
              text={syncedText}
              current={progress.current}
              duration={progress.duration}
              words={wordTs}
            />
          ) : (
            <TextInput
              text={text}
              voice={voice}
              onTextChange={setText}
              onVoiceChange={setVoice}
              generating={generating}
              generatedSeconds={stats ? stats.generation_time_ms / 1000 : null}
              onGenerate={handleGenerate}
            />
          )}
        </section>

        {/* Right — player */}
        <section className="h-full w-1/2 bg-surface">
          <AudioPlayer
            ref={playerRef}
            audioUrl={audioUrl}
            title={syncedText}
            stats={stats}
            generating={generating}
            sidecarUp={sidecarUp}
            onProgress={(current, duration) => setProgress({ current, duration })}
            onToggleLyrics={audioUrl ? () => setLyricsOpen(true) : undefined}
          />
        </section>
      </div>

      <WordSyncView
        open={lyricsOpen}
        text={syncedText}
        duration={progress.duration}
        words={wordTs}
        getAudio={() => playerRef.current?.getAudio() ?? null}
        onClose={() => setLyricsOpen(false)}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 rounded-card bg-coral px-4 py-3 text-[13px] text-coral50 shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function WordSyncToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center gap-2.5 text-[13px] text-muted"
      aria-pressed={on}
    >
      <span className="label !normal-case !tracking-normal">Word Sync</span>
      <span
        className={`relative h-6 w-11 rounded-pill transition-colors ${
          on ? "bg-teal" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform ${
            on ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className={`w-7 font-medium ${on ? "text-teal" : "text-muted"}`}>
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
