// Line-level timestamps for the Spotify-style lyrics view.
//
// Splits a tts_script / synthesized text into display lines, classifies each
// (normal | header | image | pause), and assigns [start,end) seconds. When real
// per-word timestamps are available (Kokoro), line starts snap to them for
// accurate tap-to-seek; otherwise it falls back to word-count linear interp.

import type { WordTs } from "./types";
export type { WordTs };

export type LineKind = "normal" | "header" | "image" | "pause";

export interface ScriptLine {
  index: number;
  text: string; // for images: the alt text
  kind: LineKind;
  start_time: number;
  end_time: number;
  tappable: boolean;
  imageSrc?: string; // for image lines parsed from [image: <url>] markers
}

const PAUSE_S = 0.5; // silence allocated to a [pause] / image chip
const MAX_WORDS = 12;

export function wc(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isHeader(s: string): boolean {
  const words = wc(s);
  if (words > 14 || /[“”]/.test(s)) return false;
  // Known recurring column patterns.
  if (/(\bideas?\s+from\b|\bquotes?\s+from\b|question to sit with|^here are\b|^here's\b)/i.test(s)) return true;
  // Short lines without terminal punctuation → section heading.
  // Newsletter HTML h2/h3 lose their tag; what remains is short unfinished text.
  if (words <= 8 && !/[.!?,;:]$/.test(s.trim())) return true;
  // Numbered sections: “1.” / “1)” at start (James Clear, Shane Parrish style).
  if (/^\d+[.)]\s+\S/.test(s.trim()) && words <= 10) return true;
  // Emoji-led section openers common in newsletters: “💡 The Idea”, “📚 Reading”.
  if (/^[\u{1F300}-\u{1FAD6}]/u.test(s.trim()) && words <= 10) return true;
  return false;
}

// Break one sentence into <=MAX_WORDS phrase lines at natural boundaries.
function splitSentence(sentence: string): string[] {
  const s = sentence.trim();
  if (!s) return [];
  const words = wc(s);
  const commas = (s.match(/,/g) || []).length;

  // Balanced two-clause comma sentence -> split at the comma (matches spec example).
  if (words <= MAX_WORDS && commas === 1) {
    const i = s.indexOf(",");
    const a = s.slice(0, i).trim();
    const b = s.slice(i + 1).trim();
    if (wc(a) >= 3 && wc(b) >= 3) return [a + ",", b];
    return [s];
  }
  if (words <= MAX_WORDS) return [s];

  // Long sentence -> greedy phrase break at commas / dashes.
  const parts = s.split(/(?<=[,—-])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    const candidate = buf ? `${buf} ${p}` : p;
    if (wc(candidate) > MAX_WORDS && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = candidate;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

interface RawLine {
  text: string;
  kind: LineKind;
  imageSrc?: string;
}

function splitIntoLines(text: string): RawLine[] {
  const out: RawLine[] = [];
  // [pause] markers split groups and become their own (silent) line.
  const parts = text.split(/\[pause\]/i);
  parts.forEach((part, pi) => {
    for (const para of part.split(/\n+/)) {
      const p = para.trim();
      if (!p) continue;
      const img = p.match(/\[image:?\s*([^\]]*)\]/i);
      if (img) {
        const val = (img[1] || "").trim();
        const isUrl = /^https?:\/\//i.test(val);
        out.push({
          text: isUrl ? "" : (val || "visual content"),
          kind: "image",
          imageSrc: isUrl ? val : undefined,
        });
        continue;
      }
      if (isHeader(p)) {
        out.push({ text: p.replace(/\s+/g, " "), kind: "header" });
        continue;
      }
      // sentence split: keep terminal punctuation AND any trailing closing
      // quote/bracket so a quote like `learn."` stays intact; final alt catches
      // a trailing clause with no terminal punctuation.
      const sentences = p.match(/[^.!?]+[.!?]+["”'’)\]]*|[^.!?]+$/g) || [p];
      for (const sent of sentences) {
        for (const line of splitSentence(sent)) out.push({ text: line, kind: "normal" });
      }
    }
    if (pi < parts.length - 1) out.push({ text: "", kind: "pause" });
  });
  return out;
}

export function buildLines(
  text: string,
  duration: number,
  words?: WordTs[] | null
): ScriptLine[] {
  const raw = splitIntoLines(text);
  if (raw.length === 0) return [];

  // 1) linear allocation (the spec's baseline)
  const fixed = raw.filter((l) => l.kind === "pause" || l.kind === "image").length * PAUSE_S;
  const spokenWords = raw
    .filter((l) => l.kind === "normal" || l.kind === "header")
    .reduce((n, l) => n + wc(l.text), 0);
  const remaining = Math.max(duration - fixed, 0.1);
  const perWord = spokenWords > 0 ? remaining / spokenWords : 0;

  let t = 0;
  const lines: ScriptLine[] = raw.map((l, index) => {
    const dur = l.kind === "pause" || l.kind === "image" ? PAUSE_S : wc(l.text) * perWord;
    const line: ScriptLine = {
      index,
      text: l.text,
      kind: l.kind,
      start_time: t,
      end_time: t + dur,
      tappable: l.kind === "normal",
      imageSrc: l.imageSrc,
    };
    t += dur;
    return line;
  });

  // 2) snap spoken-line starts to REAL word timestamps when available — this is
  //    what makes tap-to-seek land precisely. Walks words[] in document order,
  //    consuming wc(line) words per spoken line; pause/image lines don't consume.
  if (words && words.length > 0) {
    let cursor = 0;
    for (const line of lines) {
      if (line.kind === "pause" || line.kind === "image") continue;
      const n = wc(line.text);
      const first = words[Math.min(cursor, words.length - 1)];
      const lastIdx = Math.min(cursor + n - 1, words.length - 1);
      const last = words[lastIdx];
      if (first) line.start_time = first.start;
      if (last) line.end_time = last.end;
      cursor += n;
    }
    // keep pause/image lines wedged between their neighbors
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].kind === "pause" || lines[i].kind === "image") {
        const prevEnd = i > 0 ? lines[i - 1].end_time : 0;
        lines[i].start_time = prevEnd;
        lines[i].end_time = prevEnd + PAUSE_S;
      }
    }
  }

  return lines;
}

export interface Chapter {
  title: string;
  time: number; // seconds
}

/** Extract chapter markers from newsletter text — one per header line. */
export function extractChapters(
  text: string,
  duration: number,
  words?: WordTs[] | null
): Chapter[] {
  return buildLines(text, duration, words)
    .filter((l) => l.kind === "header" && l.text.trim())
    .map((l) => ({ title: l.text.trim(), time: l.start_time }));
}

// Active line index for a given playback time (binary-ish linear scan).
export function activeLineIndex(lines: ScriptLine[], current: number): number {
  if (lines.length === 0) return -1;
  if (current <= lines[0].start_time) return current > 0 ? 0 : -1;
  for (let i = 0; i < lines.length; i++) {
    if (current >= lines[i].start_time && current < lines[i].end_time) return i;
  }
  return lines.length - 1;
}
