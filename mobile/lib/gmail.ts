import { Newsletter, Frequency } from "./types";

// ── email body extraction ──────────────────────────────────────────────────

function b64decode(s: string): string {
  try {
    return decodeURIComponent(
      escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))
    );
  } catch {
    return "";
  }
}

function findPart(payload: any, mime: string): string | null {
  if (payload?.mimeType === mime && payload.body?.data)
    return b64decode(payload.body.data);
  for (const p of payload?.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  let text = findPart(msg.payload, "text/plain");
  if (!text) {
    const html = findPart(msg.payload, "text/html");
    if (html) text = stripHtml(html);
  }
  if (!text || text.trim().length < 50) return null;

  // Cap at ~2500 words — ~15 min audio at 150 wpm
  const trimmed = text.split(/\s+/).filter(Boolean).slice(0, 2500).join(" ");
  return { subject, text: trimmed };
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

const ESP_DOMAINS = new Set([
  "substack.com", "beehiiv.com", "convertkit.com", "mailchimp.com",
  "sendgrid.net", "klaviyo.com", "constantcontact.com", "ghost.io",
  "mail.beehiiv.com", "email.mg2.substack.com",
  "jamesclear.com",
]);
const SUBJECT_RE = /\bvol\b|\bissue\s*#|\b#\d+\b|weekly|daily|3-2-1|digest|newsletter/i;

function freqFromCount(count: number): Frequency {
  // count over 30 days
  if (count >= 12) return "Daily";
  if (count >= 3) return "Weekly";
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

function parseMessage(msg: any): MsgMeta | null {
  const headers: Record<string, string> = {};
  for (const h of msg?.payload?.headers ?? []) headers[h.name] = h.value;

  const from = headers["From"] ?? "";
  const subject = headers["Subject"] ?? "";
  const date = headers["Date"] ?? "";
  const hasUnsub = !!headers["List-Unsubscribe"];

  const m = from.match(/<([^>]+)>/);
  const email = (m ? m[1] : from).toLowerCase().trim();
  const name = from.replace(/\s*<[^>]+>/, "").trim().replace(/^"|"$/g, "") || email;
  const domain = email.includes("@") ? email.split("@")[1] : "";

  let score = 0;
  if (hasUnsub) score += 3;
  if (ESP_DOMAINS.has(domain) || [...ESP_DOMAINS].some((d) => domain.endsWith(d))) score += 3;
  if (SUBJECT_RE.test(subject)) score += 2;

  if (score < 3) return null;
  return { sender_email: email, sender_name: name, subject, date, score };
}

// Scan last 30 days, return detected newsletters grouped by sender.
export async function scanInbox(accessToken: string): Promise<Newsletter[]> {
  const list = await getJson(`${GMAIL}/messages?q=newer_than:90d&maxResults=500`, accessToken);
  const ids: string[] = (list.messages ?? []).map((m: any) => m.id);

  const metas = await pool(ids.slice(0, 300), 8, (id) =>
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
      frequency: freqFromCount(msgs.length),
      last_received_at: new Date(msgs[0].date).toISOString(),
      episode_count: msgs.length,
      is_following: false,
    });
  }

  // most frequent first
  newsletters.sort((a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0));
  return newsletters;
}
