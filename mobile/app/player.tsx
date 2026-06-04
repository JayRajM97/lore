import { useMemo, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../store/playerStore";
import { C, SPEEDS } from "../lib/theme";
import { mmss } from "../lib/format";
import { extractChapters, Chapter } from "../lib/lines";
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

  // Derive chapters from episode text + word timestamps.
  const chapters = useMemo<Chapter[]>(() => {
    if (!ep || !duration) return [];
    const text = ep.tts_script ?? ep.raw_text ?? ep.subject;
    return extractChapters(text, duration, ep.words);
  }, [ep?.id, duration]);

  // Which chapter is active now?
  const activeChapter = useMemo(() => {
    if (!chapters.length) return -1;
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (playbackPosition >= chapters[i].time) idx = i;
    }
    return idx;
  }, [chapters, playbackPosition]);

  if (!ep) {
    router.back();
    return null;
  }

  const progress = duration > 0 ? playbackPosition / duration : 0;
  const pct = Math.min(progress * 100, 100);

  function scrub(e: GestureResponderEvent) {
    if (!trackW) return;
    const ratio = Math.min(Math.max(e.nativeEvent.locationX / trackW, 0), 1);
    seek(ratio * duration);
  }

  function seekChapter(delta: 1 | -1) {
    const next = activeChapter + delta;
    if (next >= 0 && next < chapters.length) {
      seek(chapters[next].time);
    } else if (delta === -1) {
      seek(0);
    }
  }

  const lyricsText = ep.tts_script ?? ep.raw_text ?? ep.subject;

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>
        <Text style={styles.headerLabel}>
          {lyricsOpen ? "LYRICS" : "NOW PLAYING"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* body */}
      {lyricsOpen ? (
        <LyricsView text={lyricsText} duration={duration} words={ep.words} />
      ) : (
        <View style={styles.art}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={80} />
          <Text style={styles.sender}>{ep.sender_name}</Text>
          <Text style={styles.title} numberOfLines={2}>{ep.subject}</Text>
          <View style={{ marginTop: 24 }}>
            <WaveformBars progress={progress} />
          </View>
          {/* Chapter list under waveform when chapters exist */}
          {chapters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chapterScroll}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
            >
              {chapters.map((ch, i) => (
                <Pressable
                  key={i}
                  onPress={() => seek(ch.time)}
                  style={[styles.chapterPill, i === activeChapter && styles.chapterPillOn]}
                >
                  <Text style={[styles.chapterTime, i === activeChapter && styles.chapterTimeOn]}>
                    {mmss(ch.time)}
                  </Text>
                  <Text style={[styles.chapterTitle, i === activeChapter && styles.chapterTitleOn]} numberOfLines={1}>
                    {ch.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* controls */}
      <View style={[styles.controls, lyricsOpen && styles.controlsOnLyrics]}>

        {/* scrubber with chapter tick marks */}
        <Pressable
          onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
          onPress={scrub}
          style={styles.trackHit}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
            {/* chapter ticks */}
            {chapters.map((ch, i) => {
              const pos = duration > 0 ? (ch.time / duration) * 100 : 0;
              return (
                <View
                  key={i}
                  style={[
                    styles.chapterTick,
                    { left: `${pos}%` },
                    i === activeChapter && styles.chapterTickActive,
                  ]}
                />
              );
            })}
            <View style={[styles.thumb, { left: `${pct}%` }]} />
          </View>
        </Pressable>

        {/* time + chapter name */}
        <View style={styles.timeRow}>
          <Text style={styles.time}>{mmss(playbackPosition)}</Text>
          {chapters.length > 0 && (
            <Text style={styles.chapterCurrent} numberOfLines={1}>
              {chapters[activeChapter]?.title ?? ""}
            </Text>
          )}
          <Text style={styles.time}>{mmss(duration)}</Text>
        </View>

        {/* transport: prev-chapter | -15 | play | +15 | next-chapter */}
        <View style={styles.row}>
          {chapters.length > 0 ? (
            <Pressable onPress={() => seekChapter(-1)} hitSlop={8}>
              <Text style={styles.chapterNav}>⏮</Text>
            </Pressable>
          ) : (
            <View style={{ width: 28 }} />
          )}
          <Pressable onPress={() => skip(-15)} hitSlop={8}>
            <Text style={styles.skip}>-15</Text>
          </Pressable>
          <Pressable onPress={togglePlay} style={styles.play}>
            <Text style={styles.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
          </Pressable>
          <Pressable onPress={() => skip(15)} hitSlop={8}>
            <Text style={styles.skip}>+15</Text>
          </Pressable>
          {chapters.length > 0 ? (
            <Pressable onPress={() => seekChapter(1)} hitSlop={8}>
              <Text style={styles.chapterNav}>⏭</Text>
            </Pressable>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>

        <View style={styles.speeds}>
          {SPEEDS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpeed(s)}
              style={[styles.pill, s === speed && styles.pillOn]}
            >
              <Text style={[styles.pillText, s === speed && styles.pillTextOn]}>{s}x</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.iconRow}>
          <Pressable onPress={toggleLyrics} hitSlop={8}>
            <Text style={[styles.iconBtn, lyricsOpen && { color: C.teal }]}>≡ Lyrics</Text>
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

  // chapter horizontal pill list
  chapterScroll: { marginTop: 20, maxHeight: 70 },
  chapterPill: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: C.border,
  },
  chapterPillOn: { backgroundColor: C.teal50, borderColor: C.teal },
  chapterTime: { fontSize: 11, color: C.muted, fontVariant: ["tabular-nums"] },
  chapterTimeOn: { color: C.teal },
  chapterTitle: { fontSize: 12, fontWeight: "500", color: C.ink, marginTop: 2 },
  chapterTitleOn: { color: C.teal },

  controls: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 12 },
  controlsOnLyrics: { backgroundColor: "rgba(0,0,0,0.3)" },

  // scrubber
  trackHit: { height: 28, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: C.border, position: "relative" },
  fill: { position: "absolute", height: 4, borderRadius: 2, backgroundColor: C.teal, top: 0, left: 0 },
  thumb: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: C.teal, top: -5, marginLeft: -7 },

  // chapter tick marks on scrubber
  chapterTick: {
    position: "absolute",
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: C.muted,
    top: -3,
    marginLeft: -1,
    opacity: 0.5,
  },
  chapterTickActive: { backgroundColor: C.teal, opacity: 1 },

  // time row
  timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  time: { fontSize: 13, color: C.muted, fontVariant: ["tabular-nums"] },
  chapterCurrent: { flex: 1, fontSize: 12, color: C.teal, textAlign: "center", paddingHorizontal: 8 },

  // transport
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  skip: { fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"], width: 32, textAlign: "center" },
  chapterNav: { fontSize: 20, color: C.ink, width: 28, textAlign: "center" },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  playIcon: { color: C.white, fontSize: 22 },

  speeds: { flexDirection: "row", justifyContent: "center", gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, backgroundColor: C.surface },
  pillOn: { backgroundColor: C.amber50 },
  pillText: { fontSize: 13, color: "#444441" },
  pillTextOn: { color: C.amber, fontWeight: "500" },
  iconRow: { flexDirection: "row", justifyContent: "center", paddingTop: 2 },
  iconBtn: { fontSize: 14, color: C.muted },
});
