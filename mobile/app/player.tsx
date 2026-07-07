import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
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
import { SPEEDS, P, RADIUS } from "../lib/theme";
import { mmss, episodeDate } from "../lib/format";
import { extractChapters, Chapter } from "../lib/lines";
import Avatar from "../components/Avatar";
import LyricsView from "../components/LyricsView";
import { FadeInUp } from "../components/anim";
import { useIsDesktop, CONTENT } from "../lib/responsive";

// Derive a dark gradient-style color from the newsletter name
function artBg(name: string): string {
  const palette = ["#0d2818","#0d1828","#1a0d28","#28100d","#0d2828","#1a280d","#280d1a","#101028"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

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

  // ── smooth scrubber: interpolate between 100ms status updates ────────────
  const progress = useRef(new Animated.Value(0)).current;
  const baseline = useRef({ pos: playbackPosition, at: Date.now() });
  const scrubbing = useRef(false);

  useEffect(() => {
    baseline.current = { pos: playbackPosition, at: Date.now() };
  }, [playbackPosition, isPlaying, speed]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const b = baseline.current;
      const pos = isPlaying ? b.pos + ((Date.now() - b.at) / 1000) * speed : b.pos;
      const clamped = Math.min(Math.max(pos, 0), duration || pos);
      if (!scrubbing.current && duration > 0) progress.setValue(clamped / duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, isPlaying, speed]);

  // ── Spotify-style artwork: full size while playing, eases down when paused ─
  const artScale = useRef(new Animated.Value(isPlaying ? 1 : 0.88)).current;
  useEffect(() => {
    Animated.spring(artScale, {
      toValue: isPlaying ? 1 : 0.88,
      useNativeDriver: false,
      speed: 14,
      bounciness: 7,
    }).start();
  }, [isPlaying]);

  // ── play button press-spring ──────────────────────────────────────────────
  const playScale = useRef(new Animated.Value(1)).current;
  const springPlay = (v: number) =>
    Animated.spring(playScale, { toValue: v, useNativeDriver: false, speed: 40, bounciness: 6 }).start();

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
      onPanResponderGrant: (e) => { scrubbing.current = true; doSeek(e.nativeEvent.locationX); },
      onPanResponderMove: (e) => doSeek(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => { scrubbing.current = false; doSeek(e.nativeEvent.locationX); },
    })
  ).current;

  function doSeek(x: number) {
    const w = trackW.current;
    if (!w) return;
    const frac = Math.min(Math.max(x / w, 0), 1);
    progress.setValue(frac);
    seek(frac * duration);
  }

  function cycleSpeed() {
    const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
  }

  const desktop = useIsDesktop();

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
        onSetSpeed={setSpeed}
      />
    );
  }

  return (
    <View style={s.wrap}>
      <View style={[s.column, desktop && { maxWidth: CONTENT.player, alignSelf: "center", width: "100%" }]}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: P.bg }}>
        {/* ── top bar ── */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()} style={s.iconCircle} hitSlop={8}>
            <Text style={s.chevron}>⌄</Text>
          </Pressable>
          <View style={s.topCenter}>
            <Text style={s.modeLabel}>NOW PLAYING</Text>
          </View>
          <Pressable style={s.iconCircle} onPress={toggleLyrics} hitSlop={8}>
            <Text style={s.ccTop}>CC</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── artwork ── */}
      <View style={s.artWrap}>
        <Animated.View
          style={[s.artBox, { backgroundColor: artBg(ep.sender_name), transform: [{ scale: artScale }] }]}
        >
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={100} />
        </Animated.View>
      </View>

      {/* ── episode info ── */}
      <FadeInUp style={s.info}>
        <Text style={s.senderLabel}>{ep.sender_name.toUpperCase()}</Text>
        <Text style={s.title} numberOfLines={2}>{ep.subject}</Text>
        {ep.received_at ? (
          <Text style={s.dateLabel}>{episodeDate(ep.received_at)}</Text>
        ) : null}
        {chapters.length > 0 && activeChapter >= 0 && (
          <Text style={s.chapterLabel}>{chapters[activeChapter].title}</Text>
        )}
      </FadeInUp>

      {/* ── scrubber ── */}
      <View style={s.scrubWrap}>
        <View
          onLayout={(e: LayoutChangeEvent) => { trackW.current = e.nativeEvent.layout.width; }}
          {...pan.panHandlers}
          style={s.trackHit}
        >
          <View style={s.track} pointerEvents="none">
            <Animated.View
              style={[s.fill, {
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]}
            />
            {chapters.map((ch, i) => (
              <View key={i} style={[
                s.tick,
                { left: `${duration > 0 ? (ch.time / duration) * 100 : 0}%` },
                i === activeChapter && s.tickOn,
              ]} />
            ))}
            <Animated.View
              style={[s.thumb, {
                left: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]}
            />
          </View>
        </View>
        <View style={s.timeRow}>
          <Text style={s.timeText}>{mmss(playbackPosition)}</Text>
          <Text style={s.timeText}>-{mmss(Math.max(0, duration - playbackPosition))}</Text>
        </View>
      </View>

      {/* ── main controls ── */}
      <View style={s.controls}>
        <Pressable onPress={cycleSpeed} style={s.pill}>
          <Text style={s.pillTxt}>{speed}x</Text>
        </Pressable>

        <Pressable onPress={() => skip(-10)} style={s.skipWrap} hitSlop={8}>
          <Text style={s.skipArc}>↩</Text>
          <Text style={s.skipNum}>10</Text>
        </Pressable>

        <Pressable onPressIn={() => springPlay(0.9)} onPressOut={() => springPlay(1)} onPress={togglePlay}>
          <Animated.View style={[s.playBtn, { transform: [{ scale: playScale }] }]}>
            <Text style={s.playIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
          </Animated.View>
        </Pressable>

        <Pressable onPress={() => skip(10)} style={s.skipWrap} hitSlop={8}>
          <Text style={s.skipArc}>↪</Text>
          <Text style={s.skipNum}>10</Text>
        </Pressable>

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

      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: P.bg }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: P.bg },
  column: { flex: 1 },

  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: P.surface, alignItems: "center", justifyContent: "center",
  },
  chevron: { fontSize: 22, color: P.txt, lineHeight: 24, marginTop: 2 },
  ccTop: { fontSize: 11, color: P.txt, fontWeight: "700", letterSpacing: 0.5 },
  topCenter: { flex: 1, alignItems: "center" },
  modeLabel: { fontSize: 11, color: P.muted, letterSpacing: 1.8, fontWeight: "600" },

  artWrap: { alignItems: "center", paddingVertical: 24 },
  artBox: {
    width: 280, height: 280, borderRadius: RADIUS.xl,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.8,
    shadowRadius: 40, shadowOffset: { width: 0, height: 20 },
  },

  info: { alignItems: "center", paddingHorizontal: 32, gap: 6 },
  senderLabel: { fontSize: 12, fontWeight: "700", color: P.accent, letterSpacing: 1.5 },
  title: { fontSize: 20, fontWeight: "700", color: P.txt, textAlign: "center", lineHeight: 28 },
  dateLabel: { fontSize: 12, color: P.muted, textAlign: "center", marginTop: 2, letterSpacing: 0.3 },
  chapterLabel: { fontSize: 14, color: P.muted, textAlign: "center" },

  scrubWrap: { paddingHorizontal: 24, marginTop: 22, gap: 8 },
  trackHit: { height: 30, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", position: "relative" },
  fill: { position: "absolute", height: 4, borderRadius: 2, backgroundColor: P.accent, top: 0, left: 0 },
  thumb: {
    position: "absolute", width: 14, height: 14, borderRadius: 7,
    backgroundColor: P.txt, top: -5, marginLeft: -7,
  },
  tick: {
    position: "absolute", width: 2, height: 8, borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.15)", top: -2, marginLeft: -1,
  },
  tickOn: { backgroundColor: P.accent, opacity: 0.8 },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, color: P.muted, fontVariant: ["tabular-nums"] },

  controls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28, paddingVertical: 20,
  },
  pill: {
    minWidth: 54, height: 34, borderRadius: RADIUS.pill,
    borderWidth: 1.5, borderColor: P.border,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 10,
  },
  pillTxt: { fontSize: 13, color: P.txt, fontWeight: "700" },
  skipWrap: { alignItems: "center", gap: 2 },
  skipArc: { fontSize: 28, color: P.txt },
  skipNum: { fontSize: 11, color: P.muted, marginTop: -4 },
  playBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: P.accent, alignItems: "center", justifyContent: "center",
    shadowColor: P.accent, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
  },
  playIcon: { color: "#04120A", fontSize: 28 },

  chSection: {
    marginHorizontal: 20, borderTopWidth: 0.5,
    borderTopColor: P.border,
    paddingTop: 12, gap: 6,
  },
  chHeader: { fontSize: 10, fontWeight: "600", color: P.muted, letterSpacing: 1.4 },
  chRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.chip,
  },
  chRowOn: { backgroundColor: P.accentDim },
  chDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)" },
  chDotOn: { backgroundColor: P.accent, width: 8, height: 8, borderRadius: 4 },
  chTime: { fontSize: 12, color: P.muted, fontVariant: ["tabular-nums"], width: 36 },
  chTitle: { flex: 1, fontSize: 13, color: P.muted },
  chTitleOn: { color: P.txt, fontWeight: "600" },
  nowTag: {
    fontSize: 9, fontWeight: "700", color: P.accent,
    backgroundColor: P.accentDim,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 0.8,
  },
});
