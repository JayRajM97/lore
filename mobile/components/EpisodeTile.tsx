import { StyleSheet, Text, View } from "react-native";
import { Episode } from "../lib/types";
import { C, RADIUS, SHADOW } from "../lib/theme";
import { humanDuration, episodeDate } from "../lib/format";
import { PressableScale } from "./anim";
import Avatar from "./Avatar";

// Fixed-height card tile for the "cards" view mode (Home Up Next, Library,
// Listen Again). Date + play pinned to the bottom so grids stay even.
export default function EpisodeTile({
  episode,
  onPress,
}: {
  episode: Episode;
  onPress: () => void;
}) {
  const listened = !!episode.is_completed;
  return (
    <PressableScale style={s.card} onPress={onPress}>
      <View style={s.top}>
        <View style={s.srcRow}>
          <Avatar name={episode.sender_name} url={episode.sender_logo_url} size={22} />
          <Text style={s.src} numberOfLines={1}>{episode.sender_name.toUpperCase()}</Text>
        </View>
        <Text style={s.title} numberOfLines={3}>{episode.subject}</Text>
      </View>
      <View style={s.meta}>
        <Text style={s.dur} numberOfLines={1}>
          {episodeDate(episode.received_at)} · {humanDuration(episode.audio_duration_s)}
          {listened ? " · ✓" : ""}
        </Text>
        <View style={s.play}>
          <Text style={s.playIcon}>▶</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: RADIUS.card,
    padding: 15, height: 172, justifyContent: "space-between",
    ...(SHADOW.card as object),
  },
  top: { gap: 8 },
  srcRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  src: { fontSize: 10, fontWeight: "700", color: C.teal, letterSpacing: 0.8, flex: 1 },
  title: { fontSize: 14.5, fontWeight: "700", color: C.ink, lineHeight: 19.5 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dur: { fontSize: 12, color: C.muted, flex: 1, marginRight: 8 },
  play: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.teal,
    alignItems: "center", justifyContent: "center",
    ...(SHADOW.glow(C.teal) as object),
  },
  playIcon: { color: C.white, fontSize: 11, marginLeft: 2 },
});
