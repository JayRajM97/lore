import { Newsletter, Frequency } from "./types";

// ── email body extraction ──────────────────────────────────────────────────

// base64url → binary (latin1) string. Keeps raw bytes so the correct decoder
// (quoted-printable or UTF-8) can run afterwards.
function b64ToBinary(s: string): string {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

function utf8(binary: string): string {
  try {
    return decodeURIComponent(escape(binary));
  } catch {
    return binary;
  }
}

// Decode quoted-printable: soft line breaks (=\n) drop, =XX → byte. Bytes are
// gathered then UTF-8 decoded so multi-byte chars (’ — “) come through clean
// instead of being read aloud as "equals E2 80 99".
function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "=") {
      if (s[i + 1] === "\n") { i += 1; continue; }
      if (s[i + 1] === "\r" && s[i + 2] === "\n") { i += 2; continue; }
      const hex = s.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue; }
    }
    bytes.push(c.charCodeAt(0) & 0xff);
  }
  try {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

function header(part: any, name: string): string {
  const h = (part?.headers ?? []).find(
    (x: any) => x.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

// Recursively locate a MIME part and return its decoded text.
function findPart(part: any, mime: string): string | null {
  if (part?.mimeType === mime && part.body?.data) {
    const binary = b64ToBinary(part.body.data);
    const cte = header(part, "Content-Transfer-Encoding").toLowerCase();
    return cte === "quoted-printable" ? decodeQuotedPrintable(binary) : utf8(binary);
  }
  for (const p of part?.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#?\w+;/g, " ");
}

// Turn raw newsletter text into clean prose a narrator can read: drop URLs,
// markdown link syntax, image alt junk, emphasis marks, and zero-width chars.
function cleanProse(t: string): string {
  return t
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                       // ![alt](url) image → drop
    .replace(/\[image[^\]]*\]/gi, "")
    .replace(/\[([^\]]+)\]\((?:https?:|mailto:)[^)]*\)/gi, "$1") // [label](url) → label
    .replace(/https?:\/\/[^\s<>)]+/gi, "")                       // bare URLs
    .replace(/www\.[^\s<>)]+/gi, "")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "")                // emails
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")           // zero-width / soft hyphen
    .replace(/^[*_#>`~|\-\s]+$/gm, "")                          // separator-only lines
    .replace(/[*_`~]+/g, "")                                     // md emphasis
    .replace(/[-=–—]{3,}/g, " ")                                // rule lines
    .replace(/\.{3,}/g, "…")
    .replace(/\(\s*\)/g, "")                                     // empty parens left by URL removal
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Cut boilerplate footer (unsubscribe / view-in-browser / copyright) so the
// narrator stops at the article end. Only cuts past 200 chars so short emails
// aren't gutted.
function cutFooter(t: string): string {
  const markers = [
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
  let cut = t.length;
  for (const m of markers) {
    const idx = t.search(m);
    if (idx > 200 && idx < cut) cut = idx;
  }
  return t.slice(0, cut).trim();
}

/** Fetch the body of the most recent email from a newsletter sender. */
export async function fetchLatestEmail(
  newsletter: Newsletter,
  token: string
): Promise<{ subject: string; text: string } | null> {
  const search = await getJson(
    `${GMAIL}/messages?q=${encodeURIComponent(
      `from:${newsletter.sender_email}`
    )}&maxResults=1`,
    token
  );
  const id = search.messages?.[0]?.id;
  if (!id) return null;

  const msg = await getJson(`${GMAIL}/messages/${id}?format=full`, token);

  const hdrs: Record<string, string> = {};
  for (const h of msg?.payload?.headers ?? []) hdrs[h.name] = h.value;
  const subject = hdrs["Subject"] ?? newsletter.sender_name;

  // Clean both candidate sources; many newsletters ship a degraded link-dump
  // text/plain alongside a richer HTML part — pick whichever yields more prose.
  const plainRaw = findPart(msg.payload, "text/plain");
  const htmlRaw = findPart(msg.payload, "text/html");

  const plain = plainRaw ? cutFooter(cleanProse(plainRaw)) : "";
  const fromHtml = htmlRaw ? cutFooter(cleanProse(stripHtml(htmlRaw))) : "";

  const text = fromHtml.length > plain.length ? fromHtml : plain;
  if (!text || text.trim().length < 50) return null;

  // Cap at ~2500 words — ~15 min audio at 150 wpm
  const trimmed = text.split(/\s+/).filter(Boolean).slice(0, 2500).join(" ");
  return { subject, text: trimmed };
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

// Newsletter delivery platforms (ESPs). Mail from these is *probably* a real
// editorial newsletter — strong positive signal.
const ESP_DOMAINS = [
  "substack.com", "beehiiv.com", "mail.beehiiv.com", "ghost.io",
  "convertkit.com", "convertkit-mail.com", "kit.com", "buttondown.email",
  "mailchimpapp.net", "ck.page",
];

// Curated editorial newsletters we always want included, even if Gmail buried
// them past the recent-message window. Each is fetched directly by sender so
// they can never be missed (James Clear's 3-2-1, Shane Parrish's Brain Food,
// Sahil Bloom's Curiosity Chronicle, etc.). Add senders here freely.
const EDITORIAL_ALLOW = [
  "jamesclear.com",
  "fs.blog", "farnamstreetblog.com",
  "sahilbloom.com",
  "thecuriosity.com",
  "morningbrew.com",
  "every.to",
  "stratechery.com",
  "platformer.news",
  "lennysnewsletter.com",
  "newsletter.pragmaticengineer.com",
];

// Editorial subject markers — issue numbering, volume, recurring-column names.
const POS_SUBJECT = /\b(issue|vol\.?|edition|weekly|3-?2-?1|brain food|curiosity chronicle|the profile|digest)\b|#\s?\d+/i;

// Transactional / promo / alert / job / social — NOT newsletters. Matched
// against subject + Gmail snippet. Any hit vetoes a sender (unless curated).
const NEG_CONTENT =
  /\b(otp|one[- ]time|password|verify|verification|sign[- ]?in|log[- ]?in|security alert|account|statement|invoice|receipt|payment|transaction|balance|emi|credit card|debit|refund|kyc|due|bill|delivery|shipped|order|tracking|cashback|coupon|% off|\bsale\b|\bdeal\b|\boffer\b|discount|limited time|flash sale|buy now|shop now|job alert|jobs for you|hiring|new jobs|application|interview|booking|itinerary|reservation|appointment)\b/i;

// Transactional sender local-parts (the bit before @).
const NEG_SENDER = /^(no-?reply|do-?not-?reply|donotreply|alert|alerts|notification|notifications|notify|billing|statements?|account|accounts|security|support|service|jobs|jobalerts|orders|info|mailer|bounce|email)\b/i;

function domainMatches(domain: string, list: string[]): boolean {
  return list.some((d) => domain === d || domain.endsWith("." + d) || domain.endsWith(d));
}

// Frequency from the median gap between consecutive emails — window-agnostic,
// so it's correct whether we scanned 30 or 120 days. Falls back to Weekly when
// there's only one sample (most newsletters are weekly).
function frequencyFromDates(dates: string[]): Frequency {
  const ts = dates
    .map((d) => +new Date(d))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a);
  if (ts.length < 2) return "Weekly";
  const gaps: number[] = [];
  for (let i = 0; i < ts.length - 1; i++) gaps.push((ts[i] - ts[i + 1]) / 86400000);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 2) return "Daily";
  if (median <= 10) return "Weekly";
  return "Monthly";
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

// Run promises with limited concurrency (device-friendly).
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out.filter(Boolean);
}

interface MsgMeta {
  sender_email: string;
  sender_name: string;
  subject: string;
  date: string;
  score: number;
}

// Classify one message as newsletter-or-not. Curated senders always pass;
// everything else needs a real editorial positive AND must clear the
// transactional/promo veto applied to subject + snippet.
function parseMessage(msg: any): MsgMeta | null {
  const headers: Record<string, string> = {};
  for (const h of msg?.payload?.headers ?? []) headers[h.name] = h.value;

  const from = headers["From"] ?? "";
  const subject = headers["Subject"] ?? "";
  const date = headers["Date"] ?? "";
  const snippet: string = msg?.snippet ?? "";
  const hasUnsub = !!headers["List-Unsubscribe"];

  const m = from.match(/<([^>]+)>/);
  const email = (m ? m[1] : from).toLowerCase().trim();
  const name = from.replace(/\s*<[^>]+>/, "").trim().replace(/^"|"$/g, "") || email;
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const localPart = email.split("@")[0] ?? "";

  const keep = (score: number): MsgMeta => ({
    sender_email: email,
    sender_name: name,
    subject,
    date,
    score,
  });

  // 1. Curated editorial newsletters — always keep, skip all vetoes.
  if (domainMatches(domain, EDITORIAL_ALLOW)) return keep(100);

  // 2. Must have an unsubscribe header — baseline for any bulk/newsletter mail.
  if (!hasUnsub) return null;

  // 3. Positive editorial signals.
  const isEsp = domainMatches(domain, ESP_DOMAINS);
  const subjectEditorial = POS_SUBJECT.test(subject);
  const nameSaysNewsletter = /\bnewsletter\b/i.test(name);
  const hasPositive = isEsp || subjectEditorial || nameSaysNewsletter;
  if (!hasPositive) return null; // unsubscribe alone is not enough anymore

  // 4. Negative veto — transactional / promo / job / alert content or sender.
  const content = `${subject} ${snippet}`;
  if (NEG_CONTENT.test(content)) return null;
  if (NEG_SENDER.test(localPart)) return null;

  let score = 1;
  if (isEsp) score += 4;
  if (subjectEditorial) score += 2;
  if (nameSaysNewsletter) score += 2;
  return keep(score);
}

async function listIds(query: string, token: string, max: number): Promise<string[]> {
  const list = await getJson(
    `${GMAIL}/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
    token
  );
  return (list.messages ?? []).map((m: any) => m.id);
}

// Scan recent mail and return detected newsletters grouped by sender.
//
// Two-pronged so curated newsletters are never missed:
//   1. Broad pass over Gmail's "Updates" category (where bulk/editorial mail
//      lands) — keeps the candidate pool small and on-topic, so weekly senders
//      aren't pushed out by high-volume Primary mail.
//   2. Targeted per-sender queries for the curated allowlist — guarantees
//      James Clear / Shane Parrish / Sahil Bloom show up regardless of volume.
export async function scanInbox(accessToken: string): Promise<Newsletter[]> {
  const broad = await listIds("newer_than:120d category:updates", accessToken, 400);

  const targeted = await pool(EDITORIAL_ALLOW, 6, (domain) =>
    listIds(`from:${domain} newer_than:180d`, accessToken, 3)
  );

  const ids = Array.from(new Set([...broad, ...targeted.flat()]));

  const metas = await pool(ids.slice(0, 400), 8, (id) =>
    getJson(
      `${GMAIL}/messages/${id}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`,
      accessToken
    ).then(parseMessage)
  );

  // group by sender
  const bySender = new Map<string, MsgMeta[]>();
  for (const m of metas) {
    if (!m) continue;
    const arr = bySender.get(m.sender_email) ?? [];
    arr.push(m);
    bySender.set(m.sender_email, arr);
  }

  const newsletters: Newsletter[] = [];
  for (const [email, msgs] of bySender) {
    msgs.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    const domain = email.split("@")[1] ?? "";
    newsletters.push({
      id: email, // stable id = sender email
      sender_email: email,
      sender_name: msgs[0].sender_name,
      sender_logo_url: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null,
      frequency: frequencyFromDates(msgs.map((mm) => mm.date)),
      last_received_at: new Date(msgs[0].date).toISOString(),
      episode_count: msgs.length,
      is_following: false,
    });
  }

  // most frequent first
  newsletters.sort((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0));
  return newsletters;
}
