// Backend-agnostic data layer. Currently returns mock data; swap these bodies
// for real calls (FastAPI / Supabase / Firebase) at step 8 without touching UI.

import { Episode, Newsletter } from "./types";
import {
  MOCK_EPISODES,
  MOCK_NEWSLETTERS,
  episodesForNewsletter,
} from "./mockData";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  // ── auth ──
  async connectGmail(): Promise<{ ok: true }> {
    await delay(600); // stubbed OAuth — real flow wired later
    return { ok: true };
  },

  // ── inbox scan / discovery ──
  async scanInbox(): Promise<Newsletter[]> {
    await delay(2200);
    return MOCK_NEWSLETTERS;
  },

  async followNewsletters(ids: string[]): Promise<{ followed: string[] }> {
    await delay(300);
    for (const nl of MOCK_NEWSLETTERS) if (ids.includes(nl.id)) nl.is_following = true;
    return { followed: ids };
  },

  async unfollowNewsletter(id: string): Promise<void> {
    await delay(150);
    const nl = MOCK_NEWSLETTERS.find((n) => n.id === id);
    if (nl) nl.is_following = false;
  },

  // ── feed / episodes ──
  async getFeed(): Promise<Episode[]> {
    await delay(250);
    const following = new Set(
      MOCK_NEWSLETTERS.filter((n) => n.is_following).map((n) => n.id)
    );
    return MOCK_EPISODES.filter((e) => following.has(e.newsletter_id)).sort(
      (a, b) => +new Date(b.received_at) - +new Date(a.received_at)
    );
  },

  async getEpisode(id: string): Promise<Episode | undefined> {
    await delay(120);
    return MOCK_EPISODES.find((e) => e.id === id);
  },

  async getNewsletter(id: string): Promise<Newsletter | undefined> {
    await delay(120);
    return MOCK_NEWSLETTERS.find((n) => n.id === id);
  },

  async getNewsletterEpisodes(id: string): Promise<Episode[]> {
    await delay(150);
    return episodesForNewsletter(id);
  },

  getFollowing(): Newsletter[] {
    return MOCK_NEWSLETTERS.filter((n) => n.is_following);
  },

  getSaved(): Episode[] {
    return MOCK_EPISODES.filter((e) => e.is_saved);
  },

  async toggleSave(id: string): Promise<boolean> {
    const ep = MOCK_EPISODES.find((e) => e.id === id);
    if (!ep) return false;
    ep.is_saved = !ep.is_saved;
    return ep.is_saved;
  },

  async updateProgress(id: string, position: number, completed: boolean): Promise<void> {
    const ep = MOCK_EPISODES.find((e) => e.id === id);
    if (ep) {
      ep.playback_position_s = position;
      ep.is_completed = completed;
    }
  },
};
