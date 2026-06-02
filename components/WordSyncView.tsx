"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { buildLines, activeLineIndex, ScriptLine } from "@/lib/lines";
import type { WordTs } from "./WordHighlight";
import { mmss } from "@/lib/format";

const BG = "#0A3D2B"; // dark teal, Spotify-style album bg

interface Props {
  open: boolean;
  text: string;
  duration: number;
  words?: WordTs[] | null;
  getAudio: () => HTMLAudioElement | null;
  onClose: () => void;
}

export default function WordSyncView({
  open,
  text,
  duration,
  words,
  getAudio,
  onClose,
}: Props) {
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, words) : []),
    [text, duration, words]
  );

  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const manualUntil = useRef(0); // ms timestamp until which auto-scroll is paused

  // rAF loop: read the real audio position, drive active line + auto-scroll.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const a = getAudio();
      if (a) {
        setPos(a.currentTime);
        setPlaying(!a.paused);
        const idx = activeLineIndex(lines, a.currentTime);
        setActive((prev) => (prev !== idx ? idx : prev));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, lines, getAudio]);

  // Auto-scroll active line to ~35% from top (unless user scrolled recently).
  useEffect(() => {
    if (!open || active < 0) return;
    if (Date.now() < manualUntil.current) return;
    const el = lineRefs.current[active];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    sc.scrollTo({ top: el.offsetTop - sc.clientHeight * 0.35, behavior: "smooth" });
  }, [active, open]);

  function onManualScroll() {
    manualUntil.current = Date.now() + 3000; // resume auto-scroll after 3s idle
  }

  function seekTo(line: ScriptLine) {
    const a = getAudio();
    if (!a || !line.tappable) return;
    a.currentTime = line.start_time;
    if (a.paused) a.play();
    manualUntil.current = 0; // snap back to following the active line
  }

  function togglePlay() {
    const a = getAudio();
    if (!a) return;
    a.paused ? a.play() : a.pause();
  }
  function skip(d: number) {
    const a = getAudio();
    if (!a) return;
    a.currentTime = Math.min(Math.max(0, a.currentTime + d), a.duration || 0);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: BG }}>
      {/* top bar: dismiss */}
      <div className="flex shrink-0 items-center justify-between px-5 py-3 text-white/80">
        <span className="text-[12px] uppercase tracking-[0.12em] text-white/50">
          Lyrics
        </span>
        <button
          onClick={onClose}
          aria-label="Close lyrics"
          className="rounded-full p-1.5 text-white/70 hover:bg-white/10"
        >
          <ChevronDown />
        </button>
      </div>

      {/* scroller */}
      <div
        ref={scrollerRef}
        onScroll={onManualScroll}
        onWheel={onManualScroll}
        onTouchMove={onManualScroll}
        className="no-scrollbar flex-1 overflow-y-auto px-6"
        style={{ paddingTop: "35vh", paddingBottom: "45vh" }}
      >
        {lines.map((line, i) => (
          <LyricLine
            key={line.index}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            line={line}
            state={i === active ? "active" : i < active ? "past" : "upcoming"}
            onTap={() => seekTo(line)}
          />
        ))}
      </div>

      {/* controls pinned bottom, darker overlay */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between text-white">
          <span className="w-12 font-mono text-[12px] text-white/60">{mmss(pos)}</span>
          <div className="flex items-center gap-6">
            <button onClick={() => skip(-15)} className="text-[12px] text-white/80">
              -15s
            </button>
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#0A3D2B] transition-transform hover:scale-105 active:scale-95"
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={() => skip(15)} className="text-[12px] text-white/80">
              +15s
            </button>
          </div>
          <span className="w-12 text-right font-mono text-[12px] text-white/60">
            {mmss(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

const LyricLine = forwardRef<
  HTMLDivElement,
  {
    line: ScriptLine;
    state: "active" | "past" | "upcoming";
    onTap: () => void;
  }
>(function LyricLine({ line, state, onTap }, ref) {
  // section header → non-tappable divider
  if (line.kind === "header") {
    return (
      <div ref={ref} className="pb-2 pt-6">
        <span className="text-[14px] uppercase tracking-[0.14em] text-white/40">
          {line.text}
        </span>
      </div>
    );
  }

  // image → non-tappable chip
  if (line.kind === "image") {
    return (
      <div ref={ref} className="py-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 text-[12px] text-white/70">
          <CameraIcon />
          Image{line.text ? ` — ${line.text}` : ""}
        </span>
      </div>
    );
  }

  // pause → breathing space only
  if (line.kind === "pause") {
    return <div ref={ref} className="h-6" />;
  }

  const cls =
    state === "active"
      ? "text-white font-semibold text-[30px] opacity-100 scale-[1.02]"
      : state === "past"
        ? "text-white text-[22px] opacity-35"
        : "text-white text-[22px] opacity-55";

  return (
    <div ref={ref} className="origin-left py-3">
      <button
        onClick={onTap}
        className={`block text-left leading-[1.6] transition-all duration-300 ${cls}`}
      >
        {line.text}
      </button>
    </div>
  );
});

// ── icons ─────────────────────────────────────────────────────────────────
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
