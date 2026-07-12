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
];

function looksLikeFooter(text: string): boolean {
  return FOOTER_MARKERS.some((m) => m.test(text));
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

  for (const b of raw) {
    if (b.type === "image") {
      if (kept.length > 0) kept.push(b); // skip leading images
      continue;
    }
    const cleaned = cleanProse(b.text);
    if (!cleaned) continue;
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
