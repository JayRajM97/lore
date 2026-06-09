import { useMemo, useRef } from "react";
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../store/playerStore";
import { SPEEDS } from "../lib/theme";
import { mmss } from "../lib/format";
import { extractChapters, Chapter } from "../lib/lines";
import Avatar from "../components/Avatar";
import LyricsView from "../components/LyricsView";

// Derive a dark gradient-style color from the newsletter name
function artBg(name: string): string {
  const palette = ["#0d2818","#0d1828","#1a0d28","#28100d","#0d2828","#1a280d","#280d1a","#101028"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

const BG    = "#000000";
const CARD  = "#141414";
const GREEN = "#22c55e";
const TXT   = "#ffffff";
const MUTED = "rgba(255,255,255,0.4)";
const SURF  = "rgba(255,255,255,0.08)";
const BORDER = "rgba(255,255,255,0.18)";

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

  const trackW = useRef(0);

  const chapters = useMemo<Chapter[]>(() => {
    if (!ep || !duration) return [];
    return extractChapters(ep.tts_script ?? ep.raw_text ?? ep.subject, duration, ep.words);
  }, [ep?.id, duration]);

  const activeChapter = useMemo(() => {
    if (!chapters.length) return -1;
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (playbackPosition >= chapters[i].time) idx = i;
    }
    return idx;
  }, [chapters, playbackPosition]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:   (e) => doSeek(e.nativeEvent.locationX),
      onPanResponderMove:    (e) => doSeek(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => doSeek(e.nativeEvent.locationX),
    })
  ).current;

  function doSeek(x: number) {
    const w = trackW.current;
    if (!w) return;
    seek(Math.min(Math.max(x / w, 0), 1) * duration);
  }

  function cycleSpeed() {
    const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  }

  if (!ep) return <Redirect href="/home" />;

  if (lyricsOpen) {
    return (
      <LyricsView
        text={ep.tts_script ?? ep.raw_text ?? ep.subject}
        duration={duration}
        words={ep.words}
        episode={ep}
        onClose={toggleLyrics}
        playbackPosition={playbackPosition}
        isPlaying={isPlaying}
        speed={speed}
        onTogglePlay={togglePlay}
        onSkip={skip}
        onSeek={seek}
      />
    );
  }

  const pct = duration > 0 ? Math.min((playbackPosition / duration) * 100, 100) : 0;
  const remaining = Math.max(0, duration - playbackPosition);

  return (
    <View style={s.wrap}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: BG }}>
        {/* ── top bar ── */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.iconCircle}>
            <Text style={s.chevron}>⌄</Text>
          </Pressable>
          <View style={s.topCenter}>
            <Text style={s.modeLabel}>NOW PLAYING</Text>
          </View>
          <Pressable style={s.iconCircle} onPress={() => {}}>
            <Text style={s.volIcon}>🔊</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── artwork ── */}
      <View style={s.artWrap}>
        <View style={[s.artBox, { backgroundColor: artBg(ep.sender_name) }]}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={100} />
        </View>
      </View>

      {/* ── episode info ── */}
      <View style={s.info}>
        <Text style={s.senderLabel}>{ep.sender_name.toUpperCase()}</Text>
        <Text style={s.title} numberOfLines={2}>{ep.subject}</Text>
        {chapters.length > 0 && activeChapter >= 0 && (
          <Text style={s.chapterLabel}>{chapters[activeChapter].title}</Text>
        )}
      </View>

      {/* ── scrubber ── */}
      <View style={s.scrubWrap}>
        <View
          onLayout={(e: LayoutChangeEvent) => { trackW.current = e.nativeEvent.layout.width; }}
          {...pan.panHandlers}
          style={s.trackHit}
        >
          <View style={s.track} pointerEvents="none">
            <View style={[s.fill, { width: `${pct}%` }]} />
            {chapters.map((ch, i) => (
              <View key={i} style={[
                s.tick,
                { left: `${duration > 0 ? (ch.time / duration) * 100 : 0}%` },
                i === activeChapter && s.tickOn,
              ]} />
            ))}
            <View style={[s.thumb, { left: `${pct}%` }]} />
          </View>
        </View>
        <View style={s.timeRow}>
          <Text style={s.timeText}>{mmss(playbackPosition)}</Text>
          <Text style={s.timeText}>-{mmss(remaining)}</Text>
        </View>
      </View>

      {/* ── main controls ── */}
      <View style={s.controls}>
        {/* speed */}
        <Pressable onPress={cycleSpeed} style={s.pill}>
          <Text style={s.pillTxt}>{speed}x</Text>
        </Pressable>

        {/* back 10 */}
        <Pressable onPress={() => skip(-10)} style={s.skipWrap}>
          <Text style={s.skipArc}>↩</Text>
          <Text style={s.skipNum}>10</Text>
        </Pressable>

        {/* play / pause */}
        <Pressable onPress={togglePlay} style={s.playBtn}>
          <Text style={s.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
        </Pressable>

        {/* forward 10 */}
        <Pressable onPress={() => skip(10)} style={s.skipWrap}>
          <Text style={s.skipArc}>↪</Text>
          <Text style={s.skipNum}>10</Text>
        </Pressable>

        {/* CC / lyrics */}
        <Pressable onPress={toggleLyrics} style={s.pill}>
          <Text style={s.pillTxt}>CC</Text>
        </Pressable>
      </View>

      {/* ── chapter list ── */}
      {chapters.length > 0 && (
        <View style={s.chSection}>
          <Text style={s.chHeader}>CHAPTERS</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 150 }}>
            {chapters.map((ch, i) => (
              <Pressable
                key={i}
                style={[s.chRow, i === activeChapter && s.chRowOn]}
                onPress={() => seek(ch.time)}
              >
                <View style={[s.chDot, i === activeChapter && s.chDotOn]} />
                <Text style={s.chTime}>{mmss(ch.time)}</Text>
                <Text style={[s.chTitle, i === activeChapter && s.chTitleOn]} numberOfLines={1}>
                  {ch.title}
                </Text>
                {i === activeChapter && <Text style={s.nowTag}>NOW</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: BG }} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: SURF, alignItems: "center", justifyContent: "center",
  },
  chevron: { fontSize: 22, color: TXT, lineHeight: 24, marginTop: 2 },
  volIcon: { fontSize: 16 },
  topCenter: { flex: 1, alignItems: "center" },
  modeLabel: { fontSize: 11, color: MUTED, letterSpacing: 1.8, fontWeight: "600" },

  artWrap: { alignItems: "center", paddingVertical: 24 },
  artBox: {
    width: 280, height: 280, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.8,
    shadowRadius: 40, shadowOffset: { width: 0, height: 20 },
  },

  info: { alignItems: "center", paddingHorizontal: 32, gap: 6 },
  senderLabel: { fontSize: 12, fontWeight: "700", color: GREEN, letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: "700", color: TXT, textAlign: "center", lineHeight: 28 },
  chapterLabel: { fontSize: 14, color: MUTED, textAlign: "center" },

  scrubWrap: { paddingHorizontal: 24, marginTop: 22, gap: 8 },
  trackHit: { height: 30, justifyContent: "center" },
  track: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", position: "relative" },
  fill: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: GREEN, top: 0, left: 0 },
  thumb: {
    position: "absolute", width: 14, height: 14, borderRadius: 7,
    backgroundColor: TXT, top: -6, marginLeft: -7,
  },
  tick: {
    position: "absolute", width: 2, height: 8, borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.15)", top: -3, marginLeft: -1,
  },
  tickOn: { backgroundColor: GREEN, opacity: 0.8 },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, color: MUTED, fontVariant: ["tabular-nums"] },

  controls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28, paddingVertical: 20,
  },
  pill: {
    minWidth: 52, height: 32, borderRadius: 6,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 8,
  },
  pillTxt: { fontSize: 13, color: TXT, fontWeight: "700" },
  skipWrap: { alignItems: "center", gap: 2 },
  skipArc: { fontSize: 28, color: TXT },
  skipNum: { fontSize: 11, color: MUTED, marginTop: -4 },
  playBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
    shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
  },
  playIcon: { color: "#000", fontSize: 28 },

  chSection: {
    marginHorizontal: 20, borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12, gap: 6,
  },
  chHeader: { fontSize: 10, fontWeight: "600", color: MUTED, letterSpacing: 1.4 },
  chRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8,
  },
  chRowOn: { backgroundColor: "rgba(34,197,94,0.1)" },
  chDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)" },
  chDotOn: { backgroundColor: GREEN, width: 8, height: 8, borderRadius: 4 },
  chTime: { fontSize: 12, color: MUTED, fontVariant: ["tabular-nums"], width: 36 },
  chTitle: { flex: 1, fontSize: 13, color: MUTED },
  chTitleOn: { color: TXT, fontWeight: "600" },
  nowTag: {
    fontSize: 9, fontWeight: "700", color: GREEN,
    backgroundColor: "rgba(34,197,94,0.12)",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 0.8,
  },
});
