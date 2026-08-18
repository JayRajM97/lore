import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { usePlayer } from "../store/playerStore";
import { P, RADIUS, SHADOW } from "../lib/theme";
import Avatar from "./Avatar";

// Spotify-style now-playing bar: slim dark card docked above the tab bar —
// artwork left, title/artist stacked, bare play/pause glyph right, and a
// hairline progress line hugging the bottom edge.
export default function MiniPlayer() {
  const router = useRouter();
  const { currentEpisode, isPlaying, playbackPosition, duration, speed, generating, togglePlay } = usePlayer();

  // slide-up + fade on first appearance
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (currentEpisode) {
      Animated.spring(intro, { toValue: 1, useNativeDriver: false, speed: 16, bounciness: 7 }).start();
    }
  }, [!!currentEpisode]);

  // interpolated progress (same engine as the player screens)
  const progress = useRef(new Animated.Value(0)).current;
  const baseline = useRef({ pos: playbackPosition, at: Date.now() });
  useEffect(() => {
    baseline.current = { pos: playbackPosition, at: Date.now() };
  }, [playbackPosition, isPlaying, speed]);
  useEffect(() => {
    if (!currentEpisode) return;
    let raf: number;
    const tick = () => {
      const b = baseline.current;
      const pos = isPlaying ? b.pos + ((Date.now() - b.at) / 1000) * speed : b.pos;
      if (duration > 0) progress.setValue(Math.min(pos / duration, 1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [!!currentEpisode, duration, isPlaying, speed]);

  const btnScale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(btnScale, { toValue: v, useNativeDriver: false, speed: 40, bounciness: 6 }).start();

  if (!currentEpisode) return null;

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          opacity: intro,
          transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) }],
        },
      ]}
    >
      <Pressable style={styles.card} onPress={() => router.push("/player")}>
        <View style={styles.row}>
          <Avatar name={currentEpisode.sender_name} url={currentEpisode.sender_logo_url} size={40} />
          <View style={styles.center}>
            <Text style={styles.title} numberOfLines={1}>
              {currentEpisode.subject}
            </Text>
            <Text style={styles.sender} numberOfLines={1}>
              {currentEpisode.sender_name}
            </Text>
          </View>
          <Pressable
            onPress={(e) => { e.stopPropagation(); togglePlay(); }}
            onPressIn={() => spring(0.8)}
            onPressOut={() => spring(1)}
            hitSlop={12}
            style={styles.btnHit}
            disabled={generating}
          >
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              {generating
                ? <ActivityIndicator size="small" color={P.txt} />
                : <Text style={styles.icon}>{isPlaying ? "❚❚" : "▶"}</Text>}
            </Animated.View>
          </Pressable>
        </View>
        {/* progress hairline hugging the bottom edge */}
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, {
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            }]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 8, paddingBottom: 5 },
  card: {
    backgroundColor: P.card,
    borderRadius: RADIUS.chip,
    overflow: "hidden",
    ...(SHADOW.float as object),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 8,
  },
  center: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: "600", color: P.txt },
  sender: { fontSize: 12, color: P.txtMid, marginTop: 1.5 },
  btnHit: { width: 34, alignItems: "center", justifyContent: "center" },
  icon: { color: P.txt, fontSize: 18 },
  track: { position: "absolute", left: 8, right: 8, bottom: 0, height: 2, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 1 },
  fill: { height: 2, backgroundColor: P.accent, borderRadius: 1 },
});
