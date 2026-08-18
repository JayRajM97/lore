// NATIVE: pushes "recently played" into the App Group store that the home
// screen widget reads, then asks WidgetKit to redraw. iOS-only for now —
// the Android widget lands with the Android app build (react-native-android-
// widget), reading the same state shape. Web resolves widget.web.ts (no-op).

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

let recents: WidgetEpisode[] = [];

export function recordWidgetPlay(episode: Episode) {
  if (Platform.OS !== "ios") return;
  try {
    // Lazy require: keeps non-iOS bundles free of the native module.
    const { ExtensionStorage } = require("@bacons/apple-targets");
    const entry: WidgetEpisode = {
      id: episode.id,
      title: episode.subject,
      sender: episode.sender_name,
    };
    recents = [entry, ...recents.filter((e) => e.id !== entry.id)].slice(0, MAX);
    const storage = new ExtensionStorage(GROUP);
    storage.set(KEY, JSON.stringify({ episodes: recents, updatedAt: Date.now() }));
    ExtensionStorage.reloadWidget();
  } catch {
    // widget module unavailable (simulator without target, etc.) — ignore
  }
}
