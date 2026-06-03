"use client";

import { useState } from "react";
import { VOICES } from "@/lib/voices";

const MAX_WARN = 5000;

interface Props {
  text: string;
  voice: string;
  onTextChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
  generating: boolean;
  genElapsed: number | null;  // live counter while generating (seconds, updates at 50ms)
  generatedSeconds: number | null; // final time after done, for the ⚡ pill
  onGenerate: () => void;
}

export default function TextInput({
  text,
  voice,
  onTextChange,
  onVoiceChange,
  generating,
  genElapsed,
  generatedSeconds,
  onGenerate,
}: Props) {
  const [shake, setShake] = useState(false);
  const tooLong = text.length > MAX_WARN;

  function handleSubmit() {
    if (!text.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    onGenerate();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <label className="label" htmlFor="tts-text">
        Paste your text
      </label>

      <div className="relative flex-1">
        <textarea
          id="tts-text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste a newsletter, an article, anything…"
          className="h-full w-full resize-none rounded-card border-[0.5px] border-border bg-paper p-4 font-mono text-[15px] leading-[1.7] text-ink shadow-card outline-none transition-colors placeholder:text-muted focus:border-teal"
        />
        <span className="pointer-events-none absolute bottom-3 right-4 font-mono text-[12px] text-muted">
          {text.length} chars
        </span>
      </div>

      {tooLong && (
        <p className="font-mono text-[12px] text-amber">
          Long text may take 30s+ to generate
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="tts-voice">
          Voice
        </label>
        <div className="relative">
          <select
            id="tts-voice"
            value={voice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="w-full appearance-none rounded-btn border-[0.5px] border-border bg-paper px-3 py-2 pr-9 text-[13px] text-ink outline-none transition-colors focus:border-teal"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            ▾
          </span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={generating}
        className={`w-full rounded-card bg-teal py-3 font-medium text-teal50 shadow-play transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 ${
          shake ? "animate-shake" : ""
        }`}
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span>Generating</span>
            {genElapsed != null && (
              <span className="font-mono text-teal50/80">
                {genElapsed.toFixed(1)}s
              </span>
            )}
          </span>
        ) : "Convert to Audio"}
      </button>

      {generatedSeconds != null && !generating && (
        <div className="self-start rounded-pill bg-coral50 px-3 py-1 font-mono text-[13px] text-coral">
          ⚡ Generated in {generatedSeconds.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
