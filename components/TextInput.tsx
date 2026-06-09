"use client";

import { useState } from "react";
import { VOICES } from "@/lib/voices";

const MAX_WARN = 5000;

const DESCRIPTION_EXAMPLES = [
  "A calm, measured professor reading lecture notes",
  "An energetic podcast host — upbeat, conversational",
  "A soft, intimate narrator for a bedtime story",
  "A deep, authoritative documentary narrator",
  "A warm, friendly newsletter author speaking directly to you",
];

interface Props {
  text: string;
  voice: string;
  voiceDescription: string;
  onTextChange: (v: string) => void;
  onVoiceChange: (v: string) => void;
  onVoiceDescriptionChange: (v: string) => void;
  generating: boolean;
  genElapsed: number | null;
  generatedSeconds: number | null;
  onGenerate: () => void;
}

export default function TextInput({
  text,
  voice,
  voiceDescription,
  onTextChange,
  onVoiceChange,
  onVoiceDescriptionChange,
  generating,
  genElapsed,
  generatedSeconds,
  onGenerate,
}: Props) {
  const [shake, setShake] = useState(false);
  const [exampleIdx, setExampleIdx] = useState(0);
  const tooLong = text.length > MAX_WARN;
  const isCustom = voice === "custom";

  function handleSubmit() {
    if (!text.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    onGenerate();
  }

  function cycleExample() {
    const next = (exampleIdx + 1) % DESCRIPTION_EXAMPLES.length;
    setExampleIdx(next);
    onVoiceDescriptionChange(DESCRIPTION_EXAMPLES[next]);
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

      {/* ── Voice selector ── */}
      <div className="flex flex-col gap-2">
        <label className="label" htmlFor="tts-voice">
          Voice
        </label>

        {/* voice option grid — 2 columns of radio pills */}
        <div className="grid grid-cols-2 gap-2">
          {VOICES.map((v) => (
            <label
              key={v.id}
              className={`flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2 text-[13px] transition-colors ${
                voice === v.id
                  ? "border-teal bg-teal/5 text-ink"
                  : "border-border bg-paper text-muted hover:border-teal/50"
              }`}
            >
              <input
                type="radio"
                name="voice"
                value={v.id}
                checked={voice === v.id}
                onChange={() => onVoiceChange(v.id)}
                className="accent-teal"
              />
              <span>{v.label}</span>
            </label>
          ))}

          {/* Custom option */}
          <label
            className={`col-span-2 flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2 text-[13px] transition-colors ${
              isCustom
                ? "border-indigo bg-indigo/5 text-ink"
                : "border-border bg-paper text-muted hover:border-indigo/50"
            }`}
          >
            <input
              type="radio"
              name="voice"
              value="custom"
              checked={isCustom}
              onChange={() => onVoiceChange("custom")}
              className="accent-indigo"
            />
            <span className={isCustom ? "font-medium text-indigo" : ""}>
              ✦ Custom — describe your own voice
            </span>
          </label>
        </div>

        {/* Description textarea — only visible when custom selected */}
        {isCustom && (
          <div className="flex flex-col gap-2 rounded-card border border-indigo/30 bg-indigo/5 p-3">
            <div className="flex items-center justify-between">
              <span className="label text-indigo">Describe how to speak</span>
              <button
                type="button"
                onClick={cycleExample}
                className="rounded-pill border border-indigo/30 px-2 py-0.5 font-mono text-[11px] text-indigo/70 transition-colors hover:border-indigo hover:text-indigo"
              >
                try example ↻
              </button>
            </div>
            <textarea
              value={voiceDescription}
              onChange={(e) => onVoiceDescriptionChange(e.target.value)}
              placeholder={DESCRIPTION_EXAMPLES[0]}
              rows={3}
              className="w-full resize-none rounded-btn border border-indigo/20 bg-white/60 p-3 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-indigo"
            />
            <p className="font-mono text-[11px] text-muted">
              Kokoro maps your description to the closest available voice.
              Try: tone, gender, age, pace, style.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={generating || (isCustom && !voiceDescription.trim())}
        className={`w-full rounded-card bg-teal py-3 font-medium text-teal50 shadow-play transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 ${
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
        ) : isCustom && !voiceDescription.trim() ? (
          "Describe a voice to continue"
        ) : (
          "Convert to Audio"
        )}
      </button>

      {generatedSeconds != null && !generating && (
        <div className="self-start rounded-pill bg-coral50 px-3 py-1 font-mono text-[13px] text-coral">
          ⚡ Generated in {generatedSeconds.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
