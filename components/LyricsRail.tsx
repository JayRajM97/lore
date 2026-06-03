"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildLines, activeWordIndex, activeLineIndex, ScriptLine } from "@/lib/lines";
import type { WordTs } from "@/lib/lines";

interface Props {
  text: string;
  duration: number;
  words?: WordTs[] | null;
  getAudio: () => HTMLAudioElement | null;
}

// Inline Spotify-style lyrics rail. ONE source of truth: the active word from
// real timestamps. The active line = the line that owns that word; inside it,
// the active word itself gets the strong highlight (keyword). Sits above the
// player controls — no full-screen page.
export default function LyricsRail({ text, duration, words, getAudio }: Props) {
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, words) : []),
    [text, duration, words]
  );

  const [activeWord, setActiveWord] = useState(-1);
  const [activeLine, setActiveLine] = useState(-1);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const manualUntil = useRef(0);

  // rAF straight off the audio element → minimal lag.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const a = getAudio();
      if (a) {
        const cur = a.currentTime;
        // When audio has ended, force highlight to the very last word/line.
        if (a.ended || (!a.paused && cur > 0 && cur >= (a.duration || 0) - 0.05)) {
          setActiveWord(words ? words.length - 1 : -1);
          // find last tappable line
          let last = -1;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].tappable) { last = i; break; }
          }
          setActiveLine(last);
        } else if (words && words.length > 0) {
          const w = activeWordIndex(words, cur);
          setActiveWord((p) => (p !== w ? w : p));
          let li = -1;
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (l.wordStart < 0) continue;
            if (w >= l.wordStart && w < l.wordStart + l.wordCount) { li = i; break; }
          }
          setActiveLine((p) => (p !== li ? li : p));
        } else {
          const li = activeLineIndex(lines, cur);
          setActiveLine((p) => (p !== li ? li : p));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, words, getAudio]);

  // auto-scroll active line to vertical center of the rail
  useEffect(() => {
    if (activeLine < 0) return;
    if (Date.now() < manualUntil.current) return;
    const el = lineRefs.current[activeLine];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    sc.scrollTo({ top: el.offsetTop - sc.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [activeLine]);

  function seekToLine(line: ScriptLine) {
    const a = getAudio();
    if (!a || !line.tappable) return;
    a.currentTime = line.start_time;
    if (a.paused) a.play();
    manualUntil.current = 0;
  }

  return (
    <div
      ref={scrollerRef}
      onWheel={() => (manualUntil.current = Date.now() + 3000)}
      className="no-scrollbar relative h-[360px] overflow-y-auto rounded-card px-6"
      style={{ background: "#0A3D2B", paddingTop: 140, paddingBottom: 140 }}
    >
      {lines.map((line, i) => (
        <div
          key={line.index}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
        >
          <RailLine
            line={line}
            isActive={i === activeLine}
            isPast={i < activeLine}
            activeWordInLine={i === activeLine && line.wordStart >= 0 ? activeWord - line.wordStart : -1}
            onTap={() => seekToLine(line)}
          />
        </div>
      ))}
    </div>
  );
}

function RailLine({
  line,
  isActive,
  isPast,
  activeWordInLine,
  onTap,
}: {
  line: ScriptLine;
  isActive: boolean;
  isPast: boolean;
  activeWordInLine: number;
  onTap: () => void;
}) {
  if (line.kind === "header") {
    return (
      <div className="pb-1 pt-4 text-[12px] uppercase tracking-[0.14em] text-white/40">
        {line.text}
      </div>
    );
  }
  if (line.kind === "image") {
    return (
      <div className="py-2">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-[12px] text-white/70">
          📷 Image{line.text ? ` — ${line.text}` : ""}
        </span>
      </div>
    );
  }
  if (line.kind === "pause") return <div className="h-3" />;

  const lineCls = isActive
    ? "text-white"
    : isPast
      ? "text-white/30"
      : "text-white/55";

  // split the active line into words so we can highlight the current keyword
  if (isActive && activeWordInLine >= 0) {
    const parts = line.text.split(/(\s+)/);
    let wi = -1;
    return (
      <button onClick={onTap} className="block text-left">
        <span className="text-[24px] font-semibold leading-[1.5] text-white">
          {parts.map((p, k) => {
            if (/^\s+$/.test(p)) return <span key={k}>{p}</span>;
            wi++;
            const on = wi === activeWordInLine;
            return (
              <span
                key={k}
                className={on ? "rounded-[3px] bg-teal50 px-[3px] text-teal" : "text-white"}
              >
                {p}
              </span>
            );
          })}
        </span>
      </button>
    );
  }

  return (
    <button onClick={onTap} className="block py-2 text-left">
      <span className={`text-[20px] leading-[1.6] transition-colors ${lineCls}`}>
        {line.text}
      </span>
    </button>
  );
}
