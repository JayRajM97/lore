// NATIVE: keeps the home-screen widget fed. Two sources, one key:
//   - seedWidgetEpisodes(latest): called when the app loads its feed, so the
//     widget shows the newest episodes even before anything is played;
//   - recordWidgetPlay(ep): every new play moves that episode to the front.
// State lives in the App Group; the widget redraws on every write.
// iOS-only for now — Android's widget reads the same shape when built.
// Web resolves widget.web.ts (no-op).

import { Platform } from "react-native";
import { Episode } from "./types";

const GROUP = "group.com.jayraj.lore";
const KEY = "lore_widget_state";
const MAX = 4;

interface WidgetEpisode {
  id: string;
  title: string;
  sender: string;
}

let list: WidgetEpisode[] = [];

function toEntry(e: Episode): WidgetEpisode {
  return { id: e.id, title: e.subject, sender: e.sender_name };
}

function write() {
  if (Platform.OS !== "ios") return;
  try {
    // Lazy require keeps non-iOS bundles free of the native module.
    const { ExtensionStorage } = require("@bacons/apple-targets");
    const storage = new ExtensionStorage(GROUP);
    storage.set(KEY, JSON.stringify({ episodes: list.slice(0, MAX), updatedAt: Date.now() }));
    ExtensionStorage.reloadWidget();
  } catch (e) {
    console.warn("[widget] update failed:", e);
  }
}

/** Feed the widget the newest episodes (called on home/feed load). Played
 *  entries already at the front stay in front. */
export function seedWidgetEpisodes(episodes: Episode[]) {
  if (Platform.OS !== "ios" || !episodes.length) return;
  const fresh = [...episodes]
    .sort((a, b) => +new Date(b.received_at) - +new Date(a.received_at))
    .slice(0, MAX)
    .map(toEntry);
  const playedIds = new Set(list.map((e) => e.id));
  list = [...list, ...fresh.filter((f) => !playedIds.has(f.id))].slice(0, MAX);
  write();
}

/** A new play bumps that episode to the top. */
export function recordWidgetPlay(episode: Episode) {
  if (Platform.OS !== "ios") return;
  const entry = toEntry(episode);
  list = [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX);
  write();
}
