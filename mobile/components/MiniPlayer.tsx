import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { usePlayer } from "../store/playerStore";
import { C } from "../lib/theme";
import Avatar from "./Avatar";

export default function MiniPlayer() {
  const router = useRouter();
  const { currentEpisode, isPlaying, playbackPosition, duration, togglePlay } = usePlayer();

  if (!currentEpisode) return null;
  const progress = duration > 0 ? playbackPosition / duration : 0;

  return (
    <Pressable style={styles.wrap} onPress={() => router.push("/player")}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
      <View style={styles.row}>
        <Avatar name={currentEpisode.sender_name} url={currentEpisode.sender_logo_url} size={36} />
        <View style={styles.center}>
          <Text style={styles.sender} numberOfLines={1}>
            {currentEpisode.sender_name}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {currentEpisode.subject}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          hitSlop={10}
          style={styles.btn}
        >
          <Text style={styles.icon}>{isPlaying ? "❚❚" : "▶"}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface,
    borderTopWidth: 0.5,
    borderColor: C.border,
  },
  track: { height: 2, backgroundColor: C.border },
  fill: { height: 2, backgroundColor: C.teal },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  center: { flex: 1 },
  sender: { fontSize: 12, color: C.muted },
  title: { fontSize: 14, fontWeight: "500", color: C.ink },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { color: C.white, fontSize: 14 },
});
