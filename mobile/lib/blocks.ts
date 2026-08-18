// Parse a newsletter's HTML into an ordered list of ContentBlocks, and derive
// from that SAME ordered model both:
//   - spokenText: clean prose sent to TTS (drives word timestamps)
//   - displayScript: spoken text with [image: <src>] markers at image positions,
//     fed to the lyrics engine so image tiles land between the right lines
//     WITHOUT consuming word timestamps (keeps the karaoke highlight aligned).
//
// Because audio and visuals come from one model, they can't drift.

import type { ContentBlock } from "./types";

const MAX_WORDS = 2500; // ~15 min at 150 wpm

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
  // End-of-content signals — the narration should stop when the author signs
  // off, not read the referral/rating/job-board tail.
  /\bthat'?s (all|it) for (today|this week|now)\b/i,
  /\bsee you (next|tomorrow|on)\b/i,
  /\buntil next (time|week|issue)\b/i,
  /\bthanks for reading\b/i,
  /\bshare (this|the) newsletter\b/i,
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
];

// Standalone call-to-action lines ("Start your free trial →", "Shop now"):
// short, imperative, no sentence structure — ad furniture, not content.
const CTA_LINE =
  /^(•\s*)?(shop|buy|try|get|grab|claim|unlock|upgrade|subscribe|sign up|join|start|download|order|book|redeem|save \d|learn more|read more|find out|discover|explore|check out|see (deals|plans|pricing))\b/i;

function isCtaLine(text: string): boolean {
  const words = text.trim().split(/\s+/).length;
  return words <= 10 && CTA_LINE.test(text.trim()) && !/[.!?]\s+\S/.test(text);
}

function looksLikeFooter(text: string): boolean {
  return FOOTER_MARKERS.some((m) => m.test(text));
}

// ── sponsor / ad detection ────────────────────────────────────────────────────
// Newsletters (Sahil Bloom, Morning Brew, etc.) embed sponsor sections that the
// narrator would otherwise read aloud. Two-tier heuristic:
//   - a sponsor HEADING ("Together with Athletic Greens", "Today's sponsor")
//     drops the whole section until the next heading;
//   - a strongly ad-marked TEXT block drops just that block.
const SPONSOR_STRONG =
  /\b(today'?s (sponsor|newsletter is brought to you by)|sponsored( by| content| post)?\b|this (issue|email|edition) is sponsored|brought to you by|presented by|in partnership with|thanks to (our|today'?s) (sponsor|partner)|a message from (our )?(sponsor|partner)|paid (promotion|post|partnership)|partner (message|content)|advertisement\b|\bpromoted\b|from our partners?\b|use (code|promo)\b|\bpromo code\b|\d+% off\b|limited[- ]time (offer|deal)|exclusive (offer|discount) for)/i;
// "Together with X" is the classic sponsor-header pattern, but only trust it in
// short heading-like lines to avoid nuking prose that happens to use the phrase.
const SPONSOR_HEADING = /^(together with|sponsored?( by)?|a word from|from our (sponsor|partner)s?)\b/i;

function isSponsorHeading(text: string): boolean {
  const words = text.trim().split(/\s+/).length;
  return (SPONSOR_HEADING.test(text.trim()) && words <= 8) || SPONSOR_STRONG.test(text);
}

function isSponsorText(text: string): boolean {
  return SPONSOR_STRONG.test(text);
}

// ── HTML → raw blocks ─────────────────────────────────────────────────────────
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

// DOM path (web / anywhere DOMParser exists). Selects leaf block elements +
// images in document order; a block that contains another block is skipped so
// wrappers don't duplicate their children's text.
function parseWithDom(html: string): ContentBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style,script,head,title").forEach((n) => n.remove());

  const SEL = "h1,h2,h3,h4,h5,h6,p,blockquote,li,img";
  const out: ContentBlock[] = [];
  doc.body?.querySelectorAll(SEL).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      if (!/^https?:\/\//i.test(src) || isTrackingPixel(el)) return;
      out.push({ type: "image", src, alt: el.getAttribute("alt") || undefined });
      return;
    }
    // Skip non-leaf blocks (they contain other selected blocks) to avoid dupes.
    if (el.querySelector(SEL)) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    // Link-density: ad/CTA blocks are mostly anchor text ("Try Vanta free →",
    // sponsor cards, button rows). Prose paragraphs rarely exceed ~50% links.
    if (tag === "p" || tag === "li") {
      let linkLen = 0;
      el.querySelectorAll("a").forEach((a) => { linkLen += (a.textContent || "").trim().length; });
      const words = text.split(/\s+/).length;
      if (words >= 3 && linkLen / Math.max(text.length, 1) > 0.6) return;
    }
    const kind = tagKind(tag)!;
    out.push({ type: kind, text: kind === "text" && tag === "li" ? `• ${text}` : text } as ContentBlock);
  });
  return out;
}

// Fallback for environments without DOMParser (native): no images, prose only.
function parseWithRegex(html: string): ContentBlock[] {
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#?\w+;/g, " ");
  return stripped
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ type: "text" as const, text }));
}

export function htmlToBlocks(html: string): ContentBlock[] {
  try {
    if (typeof DOMParser !== "undefined") return parseWithDom(html);
  } catch {
    /* fall through */
  }
  return parseWithRegex(html);
}

export interface Content {
  blocks: ContentBlock[];   // cleaned, footer-trimmed, capped — for the reader
  spokenText: string;       // pure prose for TTS
  displayScript: string;    // spoken text + [image: src] markers for lyrics
}

// Walk blocks in order: clean prose blocks, stop at the footer, cap at MAX_WORDS.
// Emit the surviving blocks plus the two derived scripts.
export function buildContent(html: string): Content {
  const raw = htmlToBlocks(html);
  const kept: ContentBlock[] = [];
  let words = 0;
  let inSponsorSection = false;
  let lastDropWasAd = false;

  for (const b of raw) {
    // Sponsor section: a sponsor heading mutes everything until the next
    // (non-sponsor) heading; images inside the section drop with it.
    if (b.type === "heading") {
      inSponsorSection = isSponsorHeading(b.text);
      if (inSponsorSection) { lastDropWasAd = true; continue; }
    } else if (inSponsorSection) {
      continue;
    }

    if (b.type === "image") {
      // An image right after a dropped ad block is the ad's creative — skip it.
      if (kept.length > 0 && !lastDropWasAd) kept.push(b);
      continue;
    }
    const cleaned = cleanProse(b.text);
    if (!cleaned) continue;
    if (isSponsorText(cleaned) || isCtaLine(cleaned)) { lastDropWasAd = true; continue; }
    lastDropWasAd = false;
    if (words > 40 && looksLikeFooter(cleaned)) break; // stop at footer

    const bw = cleaned.split(/\s+/).filter(Boolean).length;
    if (words + bw > MAX_WORDS) {
      const room = MAX_WORDS - words;
      if (room > 10) kept.push({ type: b.type, text: cleaned.split(/\s+/).slice(0, room).join(" ") } as ContentBlock);
      break;
    }
    kept.push({ type: b.type, text: cleaned } as ContentBlock);
    words += bw;
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
