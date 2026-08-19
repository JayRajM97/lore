import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { C } from "../lib/theme";
import { Episode } from "../lib/types";
import { usePlayer } from "../store/playerStore";
import { useAuth } from "../store/authStore";
import { getEpisodes } from "../lib/db";
import { fetchTrendingEpisodes } from "../lib/discovery";
import { withProgress } from "../lib/progress";

// Deep-link target for widget play buttons: lore://play?id=<episodeId>.
// Resolves the episode (session cache -> user library -> global catalog),
// starts playback, and lands on the player.
export default function PlayLink() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    (async () => {
      if (!id) {
        router.replace("/home");
        return;
      }
      await restore().catch(() => {});

      let ep: Episode | undefined = (((globalThis as any).__lore_episodes ?? []) as Episode[]).find(
        (e) => e.id === id
      );
      if (!ep) {
        const user = useAuth.getState().user;
        if (user) {
          try {
            ep = (await getEpisodes(user.sub)).find((e) => e.id === id);
          } catch { /* offline — keep falling through */ }
        }
      }
      if (!ep) {
        try {
          ep = (await fetchTrendingEpisodes(50)).find((e) => e.id === id);
        } catch { /* ignore */ }
      }

      if (ep) {
        play(withProgress([ep])[0]); // resume where they left off
        router.replace("/player");
      } else {
        router.replace("/home");
      }
    })();
  }, [id]);

  return (
    <View style={s.wrap}>
      <ActivityIndicator color={C.teal} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
});
