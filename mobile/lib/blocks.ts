// Parse a newsletter's HTML into an ordered list of ContentBlocks, and derive
// from that SAME ordered model both:
//   - spokenText: clean prose sent to TTS (drives word timestamps)
//   - displayScript: spoken text with [image: <src>] markers for the lyrics view
//
// v3 — SECTION-AWARE AD REMOVAL. Newsletters embed ads three ways that plain
// marker-regexes miss (verified against real Sahil Bloom / James Clear issues):
//   1. Native first-person ads fenced by <hr> dividers before the article
//      ("Meet Lemon. The one AI tool I can't work without…").
//   2. The article restarting at a heading matching the email subject — all
//      preamble/ads before that anchor are droppable.
//   3. Terminal promo sections after the sign-off ("Recommendation Zone",
//      "What else am I working on?", book/affiliate blocks).
// Strategy: keep dividers while parsing, split into sections, score each
// section on ad signals, anchor the start at the subject heading, and stop at
// terminal headings/footer markers.

import type { ContentBlock } from "./types";

const MAX_WORDS = 2500; // ~15 min at 150 wpm

// Internal parse type: ContentBlock plus <hr> section dividers.
type ParsedBlock = ContentBlock | { type: "divider" };

function wc(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ── prose cleaning (mirrors gmail.ts; kept local to avoid a circular import) ──
function cleanProse(t: string): string {
  return t
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[image[^\]]*\]/gi, "")
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:)[^)]*\)/gi, "$1")
    .replace(/https?:\/\/[^\s<>)]+/gi, "")
    .replace(/www\.[^\s<>)]+/gi, "")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "")
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u034F]/g, "")
    .replace(/[*_`~]+/g, "")
    .replace(/[-=–—]{3,}/g, " ")
    .replace(/\.{3,}/g, "…")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const FOOTER_MARKERS = [
  /unsubscribe/i,
  /view (this|it) (email )?in (your )?browser/i,
  /you('| a)re receiving this/i,
  /©\s*\d{4}/,
  /all rights reserved/i,
  /was this (email )?forwarded/i,
  /update your (email )?preferences/i,
  /manage your subscription/i,
  /add us to your address book/i,
  // End-of-content signals — stop when the author signs off.
  /\bthat'?s (all|it) for (today|this week|now)\b/i,
  /\bsee you (next|tomorrow|on)\b/i,
  /\buntil next (time|week|issue)\b/i,
  /\bthanks for reading\b/i,
  /\bshare (this|the) (issue|newsletter)\b/i,
  /\brefer a friend\b/i,
  /\breferral (program|link|count)\b/i,
  /\bhow did (we|you like|you enjoy)\b.*(email|issue|edition|newsletter)/i,
  /\brate (this|today'?s) (issue|email|newsletter)\b/i,
  /\breply to this email\b/i,
  /\bjob board\b/i,
  /\badvertise (with us|in|here)\b/i,
  /\bsponsor (this|the) newsletter\b/i,
  /\bwhat did you think of\b/i,
  /\benjoyed this (issue|email|edition)\b/i,
  /\bfollow me on (social|twitter|x\b)/i,
];

function looksLikeFooter(text: string): boolean {
  return FOOTER_MARKERS.some((m) => m.test(text));
}

// Headings after which real content NEVER resumes (self-promo / affiliate
// tails). Once the article is underway, these end the narration.
const TERMINAL_HEADING =
  /^(what else am i working|my book recommendations|.*recommendation zone|order (my|your|now)|sponsor(s|ed)?( |$)|advertise|work with me|support (the|this)|shop |store$|merch|from (my|our) (friends|partners)|(today'?s|our) partners?$|upgrade to|become a (member|paid))/i;

// Sponsor / promo signals.
const SPONSOR_STRONG =
  /\b(today'?s (sponsor|newsletter is brought to you by)|sponsored( by| content| post)?\b|this (issue|email|edition) is sponsored|brought to you by|presented by|in partnership with|thanks to (our|today'?s) (sponsor|partner)|a message from (our )?(sponsor|partner)|paid (promotion|post|partnership)|partner (message|content)|advertisement\b|\bpromoted\b|from our partners?\b|use (code|promo)\b|\bpromo code\b|\d+% off\b|limited[- ]time (offer|deal)|exclusive (offer|discount) for)/i;
const SPONSOR_HEADING = /^(together with|sponsored?( by)?|a word from|from our (sponsor|partner)s?)\b/i;

function isSponsorHeading(text: string): boolean {
  const words = wc(text);
  return (SPONSOR_HEADING.test(text.trim()) && words <= 8) || SPONSOR_STRONG.test(text);
}

// Standalone call-to-action lines ("Try Lemon Free Today!", "Order Now!").
const CTA_LINE =
  /^(•\s*)?(shop|buy|try|get|grab|claim|unlock|upgrade|subscribe|sign up|join|start|download|order|book|redeem|save \d|learn more|read more|find out|discover|explore|check out|share to|see (deals|plans|pricing))\b/i;

function isCtaLine(text: string): boolean {
  const words = wc(text);
  return words <= 10 && CTA_LINE.test(text.trim()) && !/[.!?]\s+\S/.test(text);
}

// First-person native-ad phrasing ("I invested in the company", "I can't stop
// recommending", "saving me hours every week").
const NATIVE_AD =
  /\b(i|we) (can'?t stop recommending|(decided to )?invest(ed)? in (the|this) company|highly recommend (checking|trying))\b|\bsaving me hours\b|\breaders get\b.{0,30}(off|free)|\busing (my|the) code\b|\bfree welcome kit\b/i;

// Trailing button-ish line: "Try X Free Today!", "Order Now!", "Join here".
const TRAILING_CTA =
  /\b(try|order|get|start|join|claim|redeem|download|shop|subscribe)\b[^.!?\n]{0,40}\b(today|now|free|here)\b\s*[!.]?\s*$/im;

/** Score an <hr>-fenced section: is it an ad/promo unit? */
function isAdSection(blocks: ContentBlock[]): boolean {
  const texts = blocks.filter((b): b is Exclude<ContentBlock, { type: "image" }> => b.type !== "image");
  const words = texts.reduce((n, b) => n + wc(b.text), 0);
  if (words === 0 || words > 220) return false; // image-only or a real article chunk
  const joined = texts.map((t) => t.text).join("\n");
  let signals = 0;
  if (SPONSOR_STRONG.test(joined)) signals++;
  if (NATIVE_AD.test(joined)) signals++;
  if (texts.some((t) => isCtaLine(t.text))) signals++;
  if (TRAILING_CTA.test(joined)) signals++;
  if (texts.some((t) => t.type === "heading" && isSponsorHeading(t.text))) signals++;
  return signals >= 2 || (signals >= 1 && words < 90);
}

// Word-token overlap (vs the smaller set) — anchors the article start at a
// heading matching the email subject.
function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  const B = new Set(b.toLowerCase().match(/[a-z0-9']+/g) ?? []);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((t) => { if (B.has(t)) hit++; });
  return hit / Math.min(A.size, B.size);
}

// ── HTML → parsed blocks ──────────────────────────────────────────────────────
function tagKind(tag: string): ContentBlock["type"] | null {
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "blockquote") return "quote";
  if (tag === "p" || tag === "li") return "text";
  return null;
}

function isTrackingPixel(el: Element): boolean {
  const w = el.getAttribute("width");
  const h = el.getAttribute("height");
  if ((w && +w <= 2) || (h && +h <= 2)) return true;
  const src = el.getAttribute("src") || "";
  return /(\/open\b|\/track|pixel|beacon|spacer|1x1|\.gif($|\?))/i.test(src);
}

// DOM path (web). Leaf block elements + images + hr dividers in order.
function parseWithDom(html: string): ParsedBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style,script,head,title").forEach((n) => n.remove());

  const SEL = "h1,h2,h3,h4,h5,h6,p,blockquote,li,img,hr";
  const out: ParsedBlock[] = [];
  doc.body?.querySelectorAll(SEL).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "hr") {
      out.push({ type: "divider" });
      return;
    }
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src) || isTrackingPixel(el)) return;
      out.push({ type: "image", src, alt: el.getAttribute("alt") || undefined });
      return;
    }
    if (el.querySelector(SEL)) return; // skip non-leaf wrappers
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const kind = tagKind(tag)!;
    out.push({ type: kind, text: kind === "text" && tag === "li" ? `• ${text}` : text } as ContentBlock);
  });
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#?\w+;/g, " ");
}

// Native path (Hermes has no DOMParser): marker-based tag scan that preserves
// headings, images, and dividers — so ad filtering and the rich reader work
// identically on the phone.
function parseWithRegex(html: string): ParsedBlock[] {
  const marked = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<hr[^>]*>/gi, "\n@@DIV@@\n")
    .replace(/<img[^>]*?src=["']([^"']+)["'][^>]*>/gi, "\n@@IMG@@$1@@\n")
    .replace(/<h[1-6][^>]*>/gi, "\n@@H@@")
    .replace(/<\/h[1-6]>/gi, "@@\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|blockquote|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const out: ParsedBlock[] = [];
  for (const rawLine of marked.split(/\n+/)) {
    const line = decodeEntities(rawLine).replace(/\s+/g, " ").trim();
    if (!line) continue;
    if (line === "@@DIV@@") {
      out.push({ type: "divider" });
      continue;
    }
    const img = line.match(/^@@IMG@@(.+?)@@$/);
    if (img) {
      if (/^https?:\/\//i.test(img[1]) && !/(pixel|beacon|spacer|1x1|\/open\b|\/track)/i.test(img[1])) {
        out.push({ type: "image", src: img[1] });
      }
      continue;
    }
    const h = line.match(/^@@H@@(.+?)@@$/);
    if (h) {
      const t = h[1].trim();
      if (t) out.push({ type: "heading", text: t });
      continue;
    }
    // strip stray markers from mixed lines
    const text = line.replace(/@@(DIV|H)@@|@@/g, " ").replace(/\s+/g, " ").trim();
    if (text) out.push({ type: "text", text });
  }
  return out;
}

export function htmlToBlocks(html: string): ParsedBlock[] {
  try {
    if (typeof DOMParser !== "undefined") return parseWithDom(html);
  } catch {
    /* fall through */
  }
  return parseWithRegex(html);
}

export interface Content {
  blocks: ContentBlock[];   // cleaned, ad-stripped, capped — for the reader
  spokenText: string;       // pure prose for TTS
  displayScript: string;    // spoken text + [image: src] markers for lyrics
}

export function buildContent(html: string, subject?: string): Content {
  const raw = htmlToBlocks(html);

  // 1) Split into <hr>-fenced sections.
  const sections: ContentBlock[][] = [[]];
  for (const b of raw) {
    if (b.type === "divider") {
      if (sections[sections.length - 1].length) sections.push([]);
      continue;
    }
    sections[sections.length - 1].push(b);
  }

  // 2) Subject anchor: the LAST heading (within the first 70% of sections)
  //    that matches the subject marks the true article start — everything in
  //    earlier sections is preamble/ads. Only acts when the anchor isn't in
  //    the first section.
  let startIdx = 0;
  if (subject && wc(subject) >= 3) {
    const searchUpto = Math.max(1, Math.ceil(sections.length * 0.7));
    for (let i = 0; i < searchUpto; i++) {
      for (const b of sections[i]) {
        if (b.type === "heading" && wc(b.text) >= 3 && wc(b.text) <= 20 &&
            tokenOverlap(b.text, subject) >= 0.55) {
          startIdx = i;
        }
      }
    }
  }

  // 3) Drop ad-scoring sections.
  const survivors = sections
    .slice(startIdx)
    .filter((sec) => sec.length > 0 && !isAdSection(sec));

  // 4) Flatten with the per-block pipeline (sponsor zones, CTA lines, footer,
  //    terminal headings, word cap).
  const kept: ContentBlock[] = [];
  let words = 0;
  let inSponsorSection = false;
  let stopped = false;

  for (const sec of survivors) {
    if (stopped) break;
    for (const b of sec) {
      if (b.type === "heading") {
        // Terminal promo heading after real content → hard stop.
        if (words > 40 && TERMINAL_HEADING.test(b.text.trim())) { stopped = true; break; }
        inSponsorSection = isSponsorHeading(b.text);
        if (inSponsorSection) continue;
      } else if (inSponsorSection) {
        continue;
      }

      if (b.type === "image") {
        if (kept.length > 0) kept.push(b); // skip leading images
        continue;
      }
      const cleaned = cleanProse(b.text);
      if (!cleaned) continue;
      if (isCtaLine(cleaned)) continue;                       // standalone ad buttons
      if (SPONSOR_STRONG.test(cleaned)) continue;             // standalone ad blocks
      if (words > 40 && looksLikeFooter(cleaned)) { stopped = true; break; } // sign-off / footer

      const bw = wc(cleaned);
      if (words + bw > MAX_WORDS) {
        const room = MAX_WORDS - words;
        if (room > 10) kept.push({ type: b.type, text: cleaned.split(/\s+/).slice(0, room).join(" ") } as ContentBlock);
        stopped = true;
        break;
      }
      kept.push({ type: b.type, text: cleaned } as ContentBlock);
      words += bw;
    }
  }

  // drop trailing images with no content after them
  while (kept.length && kept[kept.length - 1].type === "image") kept.pop();

  const spokenText = kept
    .filter((b) => b.type !== "image")
    .map((b) => (b as { text: string }).text)
    .join("\n\n")
    .trim();
  const displayScript = kept
    .map((b) => (b.type === "image" ? `[image: ${b.src}]` : b.text))
    .join("\n\n")
    .trim();

  return { blocks: kept, spokenText, displayScript };
}
