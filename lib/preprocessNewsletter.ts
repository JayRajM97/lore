// preprocessNewsletter.ts
//
// Pure-local newsletter → TTS-ready structure. No LLM, no network: regex +
// heuristics only. Built for the "X Ideas / Y Quotes / Z Question" family
// (James Clear 3-2-1, Sahil Bloom, Morning Brew, …) but generalizes beyond it.

export interface NewsletterSection {
  type: "ideas" | "quotes" | "question" | "intro" | "image" | "skipped";
  label: string;
  count?: number;
  items?: {
    index: string;
    content: string;
    word_count: number;
    is_core: boolean;
  }[];
}

export interface ProcessedNewsletter {
  newsletter_id: string;
  sender: string;
  subject: string;
  date: string;
  structure_type: string;
  sections: NewsletterSection[];
  tts_script: string;
  skipped_sections: string[];
  image_count: number;
  estimated_duration_s: number;
}

const WORDS_PER_MIN = 140;

// ── small helpers ───────────────────────────────────────────────────────────
const ORDINAL = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ordinalWord(n: number): string {
  return ORDINAL[n] ?? String(n);
}

function countWords(s: string): number {
  // count spoken words; drop [pause] markers (silence, not spoken)
  return s
    .replace(/\[pause\]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toIsoDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return slug(date); // fall back to a slug
  // use LOCAL components — toISOString() would shift across the date line in
  // non-UTC timezones (e.g. "April 30" → "April 29" in IST).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── metadata extraction ─────────────────────────────────────────────────────
function extractSender(raw: string, given?: string): string {
  if (given) return given;
  const from = raw.match(/^From:\s*(.+?)(?:\s*<|$)/im);
  if (from) return from[1].trim();
  const signoff = raw.match(/^\s*(?:Until next week|Best|Cheers|Yours)[,\s]+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,2})/im);
  if (signoff) return signoff[1].trim();
  return "Unknown Sender";
}

function extractSubject(raw: string, given?: string): string {
  if (given) return given;
  const subj = raw.match(/^Subject:\s*(.+)$/im);
  if (subj) return subj[1].trim();
  const threeTwoOne = raw.match(/^\s*(3-2-1:.*)$/im);
  if (threeTwoOne) return threeTwoOne[1].trim();
  return "";
}

function extractDate(raw: string, given?: string): string {
  if (given) return given;
  const d = raw.match(/^Date:\s*(.+)$/im);
  if (d) return d[1].trim();
  const inline = raw.match(/\b([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\b/);
  return inline ? inline[1] : "";
}

// ── section header detection ────────────────────────────────────────────────
interface HeaderHit {
  line: number;
  count: number;
  kind: "ideas" | "quotes" | "question";
  label: string;
}

function findHeaders(lines: string[]): HeaderHit[] {
  const re = /^\s*(\d+)\s+(idea|quote|question)s?\b.*$/i;
  const hits: HeaderHit[] = [];
  lines.forEach((line, i) => {
    const m = line.match(re);
    if (!m) return;
    const kindWord = m[2].toLowerCase();
    const kind = kindWord.startsWith("idea") ? "ideas" : kindWord.startsWith("quote") ? "quotes" : "question";
    hits.push({ line: i, count: parseInt(m[1], 10), kind, label: line.trim() });
  });
  return hits;
}

// ── item parsing within a section block ─────────────────────────────────────
// Matches "I." / "II)" / "1." / "3)" optionally followed by inline content.
const ITEM_RE = /^\s*(IX|IV|VI{0,3}|I{1,3}|V|X|\d{1,2})[.)]\s*(.*)$/;

function parseItems(blockLines: string[]): { index: string; content: string }[] {
  const items: { index: string; content: string }[] = [];
  let cur: { index: string; content: string[] } | null = null;

  const flush = () => {
    if (cur) items.push({ index: cur.index, content: cur.content.join(" ").replace(/\s+/g, " ").trim() });
    cur = null;
  };

  for (const raw of blockLines) {
    const line = raw.trim();
    if (!line) continue;
    const m = raw.match(ITEM_RE);
    // Only treat as a new item marker if it's a roman numeral or a small int,
    // not e.g. a sentence that happens to start with a number+period.
    if (m && (ROMAN[m[1].toUpperCase()] || /^\d{1,2}$/.test(m[1]))) {
      flush();
      cur = { index: m[1].toUpperCase(), content: m[2] ? [m[2]] : [] };
    } else if (cur) {
      cur.content.push(line);
    }
  }
  flush();
  return items.filter((it) => it.content.length > 0);
}

// ── quote attribution compression ───────────────────────────────────────────
// "Baba Hari Dass, a yoga master and monk who kept a vow of silence …, on
//  learning:"  ->  "Baba Hari Dass, yoga master, on learning:"
// Short attributions (already concise) are left untouched.
export function compressAttribution(line: string): string {
  const trimmed = line.trim().replace(/:\s*$/, "");
  const words = trimmed.split(/\s+/);
  if (words.length <= 12) return trimmed + ":";

  const rel = trimmed.match(/,?\s*(on\s+[^,:]+)$/i)?.[1]?.trim();
  const commaIdx = trimmed.indexOf(",");
  const name = (commaIdx >= 0 ? trimmed.slice(0, commaIdx) : words.slice(0, 3).join(" ")).trim();

  let descriptor = "";
  if (commaIdx >= 0) {
    const rest = trimmed.slice(commaIdx + 1);
    descriptor = rest
      .split(/\s+and\s+|\s+who\s+|,/i)[0]
      .replace(/^\s*(a|an|the)\s+/i, "")
      .trim();
  }

  const parts = [name];
  if (descriptor) parts.push(descriptor);
  if (rel) parts.push(rel);
  return parts.join(", ") + ":";
}

// ── image detection ─────────────────────────────────────────────────────────
const IMAGE_PATTERNS = [
  /\(image:?\s*([^)]*)\)/gi,
  /\[image:?\s*([^\]]*)\]/gi,
  /<img[^>]*\balt=["']([^"']*)["'][^>]*>/gi,
];

function detectImages(raw: string): { count: number; alts: string[] } {
  const alts: string[] = [];
  for (const re of IMAGE_PATTERNS) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(raw)) !== null) {
      alts.push((m[1] || "visual content").trim());
    }
  }
  return { count: alts.length, alts };
}

// ── skipped-section labelling ───────────────────────────────────────────────
const SKIP_RULES: { label: string; re: RegExp }[] = [
  { label: "greeting", re: /^\s*happy\b.*!/im },
  { label: "website", re: /^.*\bread (?:online|on|in your browser)\b.*$/im },
  { label: "ps", re: /^\s*p\.?\s?s\.?\b/im },
  { label: "book recommendations", re: /\b(recommended reading|books? i'?m reading|recommended books?|reading list)\b/im },
  { label: "book recommendations", re: /amazon\.[a-z.]+/im },
  { label: "what else am i working on", re: /what else am i working on/im },
  { label: "footer", re: /\b(cofounder|co-founder|founder of|all rights reserved)\b/im },
  { label: "unsubscribe", re: /\b(unsubscribe|manage (?:your )?preferences|email preferences)\b/im },
];

function detectSkipped(raw: string): string[] {
  const found = new Set<string>();
  for (const { label, re } of SKIP_RULES) if (re.test(raw)) found.add(label);
  return [...found];
}

// ── main ────────────────────────────────────────────────────────────────────
export function preprocessNewsletter(
  rawText: string,
  metadata?: { sender?: string; subject?: string; date?: string }
): ProcessedNewsletter {
  const raw = rawText.replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  const sender = extractSender(raw, metadata?.sender);
  const subject = extractSubject(raw, metadata?.subject);
  const date = extractDate(raw, metadata?.date);

  const headers = findHeaders(lines);
  const { count: image_count } = detectImages(raw);
  const skipped_sections = detectSkipped(raw);

  // structure_type: e.g. "3-2-1" from the ordered header counts, else subject hint.
  let structure_type = headers.map((h) => h.count).join("-");
  if (!structure_type) structure_type = /3-2-1/.test(subject) ? "3-2-1" : "freeform";

  // Carve each header's block: from just after its line to the next header line.
  const sections: NewsletterSection[] = [];
  headers.forEach((h, hi) => {
    const start = h.line + 1;
    const end = hi + 1 < headers.length ? headers[hi + 1].line : lines.length;
    const block = lines.slice(start, end);

    if (h.kind === "question") {
      // the single question = first non-empty, non-marker, non-signoff line
      const q = block
        .map((l) => l.trim())
        .find((l) => l && !ITEM_RE.test(l) && !/^until next week|^best|^cheers/i.test(l));
      const content = (q || "").replace(/^\s*(?:1[.)]|I[.)])\s*/, "").trim();
      sections.push({
        type: "question",
        label: h.label,
        count: 1,
        items: content ? [{ index: "I", content, word_count: countWords(content), is_core: true }] : [],
      });
      return;
    }

    const parsed = parseItems(block).slice(0, h.count || undefined);
    sections.push({
      type: h.kind,
      label: h.label,
      count: h.count,
      items: parsed.map((it) => ({
        index: it.index,
        content: it.content,
        word_count: countWords(it.content),
        is_core: true,
      })),
    });
  });

  const tts_script = buildScript(sections, sender, raw);
  const estimated_duration_s = Math.round((countWords(tts_script) / WORDS_PER_MIN) * 60);

  return {
    newsletter_id: `${slug(sender)}-${toIsoDate(date)}`,
    sender,
    subject,
    date,
    structure_type,
    sections,
    tts_script,
    skipped_sections,
    image_count,
    estimated_duration_s,
  };
}

// ── tts_script assembly ─────────────────────────────────────────────────────
function buildScript(sections: NewsletterSection[], sender: string, raw: string): string {
  // Each entry becomes a [pause]-delimited segment. A section intro attaches to
  // its FIRST item (no pause between); the ordinal marker attaches to its own
  // content. Pauses fall only between items and between sections.
  const segments: string[] = [];

  const ordOf = (index: string) => ROMAN[index] || parseInt(index, 10) || 1;

  for (const sec of sections) {
    const items = sec.items ?? [];
    if (!items.length) continue;
    let intro = "";
    let rendered: string[] = [];

    if (sec.type === "ideas") {
      intro = `Here are ${ordinalWord(sec.count || items.length)} ideas from ${sender}.`;
      rendered = items.map((it) => `${cap(ordinalWord(ordOf(it.index)))}.\n\n${it.content}`);
    } else if (sec.type === "quotes") {
      intro = `${cap(ordinalWord(sec.count || items.length))} quotes from others.`;
      rendered = items.map((it) => `${cap(ordinalWord(ordOf(it.index)))}. ${renderQuoteItem(it.content)}`);
    } else if (sec.type === "question") {
      intro = "And one question to sit with.";
      rendered = [items[0].content];
    }

    rendered.forEach((r, k) => segments.push(k === 0 ? `${intro}\n\n${r}` : r));
  }

  // closing signoff, if present
  const sign = raw.match(/^\s*Until next week,?\s*([^\n]+)$/im);
  if (sign) {
    const name = sign[1].trim().replace(/[,.]$/, "");
    segments.push(`Until next week, ${name}.`);
  }

  return segments.join("\n\n[pause]\n\n");
}

// Split a quote item into "attribution: \"quote\"" form, compressing attribution.
function renderQuoteItem(content: string): string {
  const quotes = [...content.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1].trim());
  // attribution = everything before the first quote mark
  const firstQuotePos = content.search(/[“"]/);
  let attribution = (firstQuotePos >= 0 ? content.slice(0, firstQuotePos) : content).trim();
  attribution = attribution.replace(/[:：]\s*$/, "");

  if (quotes.length === 0) return content;

  const attr = compressAttribution(attribution);
  const spoken = quotes.map((q) => `"${q}"`).join(" ");
  return `${attr} ${spoken}`;
}
