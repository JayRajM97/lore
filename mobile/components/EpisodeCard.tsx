import { Pressable, StyleSheet, Text, View } from "react-native";
import { Episode } from "../lib/types";
import { C, RADIUS, SHADOW } from "../lib/theme";
import { humanDuration, relativeDate } from "../lib/format";
import Avatar from "./Avatar";
import { PressableScale } from "./anim";

export default function EpisodeCard({
  episode,
  onPressBody,
  onPressPlay,
}: {
  episode: Episode;
  onPressBody: () => void;
  onPressPlay: () => void;
}) {
  const unplayed = !episode.playback_position_s && !episode.is_completed;

  return (
    <PressableScale style={styles.card} onPress={onPressBody}>
      <Avatar name={episode.sender_name} url={episode.sender_logo_url} size={44} />
      <View style={styles.center}>
        <Text style={styles.sender} numberOfLines={1}>
          {episode.sender_name}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {episode.subject}
        </Text>
        <Text style={styles.meta}>
          {relativeDate(episode.received_at)} · {humanDuration(episode.audio_duration_s)}
          {episode.is_completed ? " · Played" : ""}
        </Text>
      </View>
      <Pressable onPress={onPressPlay} hitSlop={8} style={styles.right}>
        {unplayed && <View style={styles.dot} />}
        <View style={styles.play}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </Pressable>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: RADIUS.card,
    padding: 12,
    ...(SHADOW.card as object),
  },
  center: { flex: 1, gap: 2 },
  sender: { fontSize: 13, color: C.muted },
  title: { fontSize: 15, fontWeight: "500", color: C.ink },
  meta: { fontSize: 13, color: C.muted, marginTop: 2 },
  right: { alignItems: "center", flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
    ...(SHADOW.glow(C.teal) as object),
  },
  playIcon: { color: C.white, fontSize: 14, marginLeft: 2 },
});
