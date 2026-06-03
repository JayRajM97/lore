import { useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../store/playerStore";
import { api } from "../lib/api";
import { C, SPEEDS } from "../lib/theme";
import { mmss } from "../lib/format";
import Avatar from "../components/Avatar";
import WaveformBars from "../components/WaveformBars";
import LyricsView from "../components/LyricsView";

export default function Player() {
  const router = useRouter();
  const {
    currentEpisode: ep,
    isPlaying,
    playbackPosition,
    duration,
    speed,
    lyricsOpen,
    togglePlay,
    skip,
    seek,
    setSpeed,
    toggleLyrics,
  } = usePlayer();

  const [trackW, setTrackW] = useState(0);
  const [saved, setSaved] = useState(ep?.is_saved ?? false);

  if (!ep) {
    router.back();
    return null;
  }

  const progress = duration > 0 ? playbackPosition / duration : 0;

  function scrub(e: GestureResponderEvent) {
    if (!trackW) return;
    const ratio = Math.min(Math.max(e.nativeEvent.locationX / trackW, 0), 1);
    seek(ratio * duration);
  }

  async function toggleSave() {
    const s = await api.toggleSave(ep!.id);
    setSaved(s);
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        <Text style={styles.headerLabel}>{lyricsOpen ? "LYRICS" : "NOW PLAYING"}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* body: lyrics OR art */}
      {lyricsOpen ? (
        <LyricsView text={ep.tts_script ?? ep.subject} duration={duration} />
      ) : (
        <View style={styles.art}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={80} />
          <Text style={styles.sender}>{ep.sender_name}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {ep.subject}
          </Text>
          <View style={{ marginTop: 24 }}>
            <WaveformBars progress={progress} />
          </View>
        </View>
      )}

      {/* controls */}
      <View style={[styles.controls, lyricsOpen && styles.controlsOnLyrics]}>
        <Pressable onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)} onPress={scrub} style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
          <View style={[styles.thumb, { left: `${Math.min(progress * 100, 100)}%` }]} />
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{mmss(playbackPosition)}</Text>
          <Text style={styles.time}>{mmss(duration)}</Text>
        </View>

        <View style={styles.row}>
          <Pressable onPress={() => skip(-15)} hitSlop={8}><Text style={styles.skip}>-15</Text></Pressable>
          <Pressable onPress={togglePlay} style={styles.play}>
            <Text style={styles.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Pressable onPress={() => skip(15)} hitSlop={8}><Text style={styles.skip}>+15</Text></Pressable>
        </View>

        <View style={styles.speeds}>
          {SPEEDS.map((s) => (
            <Pressable key={s} onPress={() => setSpeed(s)} style={[styles.pill, s === speed && styles.pillOn]}>
              <Text style={[styles.pillText, s === speed && styles.pillTextOn]}>{s}x</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.iconRow}>
          <Pressable onPress={toggleSave} hitSlop={8}>
            <Text style={[styles.iconBtn, saved && { color: C.amber }]}>{saved ? "★ Saved" : "☆ Save"}</Text>
          </Pressable>
          <Pressable onPress={toggleLyrics} hitSlop={8}>
            <Text style={[styles.iconBtn, lyricsOpen && { color: C.teal }]}>≡ Lyrics</Text>
          </Pressable>
          <Pressable hitSlop={8}>
            <Text style={styles.iconBtn}>↓ Download</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 8 },
  chevron: { fontSize: 28, color: C.ink, lineHeight: 28 },
  headerLabel: { fontSize: 12, letterSpacing: 1.4, color: C.muted },
  art: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  sender: { fontSize: 14, color: C.muted, marginTop: 12 },
  title: { fontSize: 18, fontWeight: "500", color: C.ink, textAlign: "center" },
  controls: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, gap: 14 },
  controlsOnLyrics: { backgroundColor: "rgba(0,0,0,0.3)" },
  track: { height: 24, justifyContent: "center" },
  fill: { position: "absolute", height: 4, borderRadius: 2, backgroundColor: C.teal },
  thumb: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: C.teal, marginLeft: -6 },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  time: { fontSize: 13, color: C.muted, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  skip: { fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  playIcon: { color: C.white, fontSize: 22 },
  speeds: { flexDirection: "row", justifyContent: "center", gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: C.surface },
  pillOn: { backgroundColor: C.amber50 },
  pillText: { fontSize: 13, color: "#444441" },
  pillTextOn: { color: C.amber, fontWeight: "500" },
  iconRow: { flexDirection: "row", justifyContent: "space-around", paddingTop: 4 },
  iconBtn: { fontSize: 14, color: C.muted },
});
