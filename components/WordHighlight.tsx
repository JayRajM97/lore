"use client";

import { useEffect, useMemo, useRef } from "react";
import type { WordTs } from "@/lib/lines";

export type { WordTs };

interface Props {
  text: string;
  current: number; // seconds
  duration: number; // seconds
  words?: WordTs[] | null; // real per-word timestamps from the backend
}

interface Token {
  text: string;
  isWord: boolean;
  // linear-fallback timing (fractions 0..1)
  start: number;
  end: number;
}

// Split into words + whitespace, KEEPING whitespace (incl. newlines) so the
// original formatting renders verbatim under `whitespace-pre-wrap`.
function tokenize(text: string): Token[] {
  const raw = text.split(/(\s+)/).filter((t) => t.length > 0);
  const weights = raw.map((t) => (/\s/.test(t) ? 0 : t.replace(/[^\w]/g, "").length + 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return raw.map((t) => {
    const isWord = !/\s/.test(t);
    const start = acc / total;
    const w = isWord ? t.replace(/[^\w]/g, "").length + 1 : 0;
    acc += w;
    return { text: t, isWord, start, end: acc / total };
  });
}

export default function WordHighlight({ text, current, duration, words }: Props) {
  const tokens = useMemo(() => tokenize(text), [text]);

  // Ordinal index (0-based) of the active WORD, counting words only.
  const activeOrdinal = useMemo(() => {
    if (words && words.length > 0) {
      // real timestamps — authoritative
      if (current <= words[0].start) return current > 0 ? 0 : -1;
      for (let j = 0; j < words.length; j++) {
        if (current >= words[j].start && current < words[j].end) return j;
      }
      return words.length - 1; // past the end
    }
    // linear fallback
    const frac = duration > 0 ? Math.min(current / duration, 1) : 0;
    if (frac <= 0) return -1;
    let ord = -1;
    for (const t of tokens) {
      if (!t.isWord) continue;
      ord++;
      if (frac >= t.start && frac < t.end) return ord;
    }
    return ord; // last
  }, [words, current, duration, tokens]);

  // Map word-ordinal -> token index for rendering/highlight.
  const activeTokenIndex = useMemo(() => {
    if (activeOrdinal < 0) return -1;
    let ord = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].isWord && ++ord === activeOrdinal) return i;
    }
    return -1;
  }, [tokens, activeOrdinal]);

  const activeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTokenIndex]);

  return (
    <div className="flex h-full flex-col gap-4 p-8">
      <span className="label">Reading along</span>
      <div className="flex-1 overflow-y-auto rounded-card border-[0.5px] border-border bg-paper p-5 shadow-card">
        {/* whitespace-pre-wrap preserves the pasted formatting verbatim */}
        <div className="whitespace-pre-wrap break-words font-mono text-[15px] leading-[1.7] text-ink">
          {tokens.map((t, i) => {
            if (!t.isWord) return <span key={i}>{t.text}</span>;
            const active = i === activeTokenIndex;
            return (
              <span
                key={i}
                ref={active ? activeRef : undefined}
                className={
                  active
                    ? "rounded-[3px] bg-teal50 text-teal"
                    : "text-ink"
                }
              >
                {t.text}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
