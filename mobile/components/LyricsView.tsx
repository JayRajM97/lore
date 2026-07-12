import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildLines, activeLineIndex, ScriptLine } from "../lib/lines";
import { WordTs, Episode } from "../lib/types";
import { mmss } from "../lib/format";
import { SPEEDS, P, RADIUS } from "../lib/theme";
import { useIsDesktop, CONTENT } from "../lib/responsive";
import Avatar from "./Avatar";

const { height: SCREEN_H } = Dimensions.get("window");

interface Props {
  text: string;
  duration: number;
  words?: WordTs[] | null;
  episode: Episode;
  onClose: () => void;
  playbackPosition: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSkip: (delta: number) => void;
  onSeek: (s: number) => void;
  onSetSpeed?: (s: number) => void;
}

export default function LyricsView({
  text, duration, words, episode: ep, onClose,
  playbackPosition, isPlaying, speed,
  onTogglePlay, onSkip, onSeek, onSetSpeed,
}: Props) {
  const desktop = useIsDesktop();
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, words) : []),
    [text, duration, words]
  );

  // ── 60fps sync engine ────────────────────────────────────────────────────
  // Audio status arrives every ~100ms; between updates we predict the position
  // from a local clock so the highlight and progress bar glide instead of
  // stepping. Re-renders happen ONLY when the active line index changes; the
  // progress bar is driven through an Animated.Value (no render churn).
  const [active, setActive] = useState(-1);
  const activeRef = useRef(-1);
  const baseline = useRef({ pos: playbackPosition, at: Date.now() });
  const progress = useRef(new Animated.Value(duration > 0 ? playbackPosition / duration : 0)).current;
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

      const idx = activeLineIndex(lines, clamped);
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, duration, isPlaying, speed]);

  // ── auto-scroll: keep the active line a third from the top ──────────────
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const manualUntil = useRef(0);

  useEffect(() => {
    if (active < 0) return;
    if (Date.now() < manualUntil.current) return;
    const y = offsets.current[active];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCREEN_H * 0.3), animated: true });
  }, [active]);

  // ── scrubber ─────────────────────────────────────────────────────────────
  const trackW = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        scrubbing.current = true;
        scrubTo(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => scrubTo(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => {
        scrubbing.current = false;
        onSeek(clamp(e.nativeEvent.locationX / (trackW.current || 1)) * duration);
      },
    })
  ).current;

  function scrubTo(x: number) {
    const frac = clamp(x / (trackW.current || 1));
    progress.setValue(frac);
    onSeek(frac * duration);
  }
  function clamp(n: number) { return Math.min(Math.max(n, 0), 1); }

  return (
    <View style={s.wrap}>
      <View style={[{ flex: 1 }, desktop && { maxWidth: CONTENT.lyrics, alignSelf: "center", width: "100%" }]}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: P.bg }}>
        <View style={s.topBar}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={s.nowLabel}>NOW NARRATING</Text>
            <Text style={s.topTitle} numberOfLines={1}>{ep.subject}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Text style={s.closeX}>✕</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* lyrics scroll */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { manualUntil.current = Date.now() + 3000; }}
        scrollEventThrottle={32}
        contentContainerStyle={s.lyricsContent}
      >
        {lines.map((line, i) => {
          const state: "active" | "past" | "next" =
            i === active ? "active" : i < active ? "past" : "next";
          return (
            <View
              key={i}
              onLayout={(e) => { offsets.current[i] = e.nativeEvent.layout.y; }}
            >
              <Line
                line={line}
                state={state}
                onTap={() => {
                  if (line.tappable) {
                    onSeek(line.start_time);
                    manualUntil.current = 0;
                  }
                }}
              />
            </View>
          );
        })}
        <View style={{ height: 220 }} />
      </ScrollView>

      {/* bottom controls */}
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: P.bg }}>
        <View style={s.bottomBar}>
          {/* scrubber */}
          <View style={s.scrubRow}>
            <Text style={s.scrubTime}>{mmss(playbackPosition)}</Text>
            <View
              onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
              {...pan.panHandlers}
              style={s.scrubHit}
            >
              <View style={s.scrubTrack} pointerEvents="none">
                <Animated.View
                  style={[s.scrubFill, {
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  }]}
                />
              </View>
            </View>
            <Text style={s.scrubTime}>-{mmss(Math.max(0, duration - playbackPosition))}</Text>
          </View>

          {/* transport */}
          <View style={s.transport}>
            <Pressable style={s.sidePill} onPress={() => {
              if (onSetSpeed) {
                const idx = SPEEDS.indexOf(speed as typeof SPEEDS[number]);
                onSetSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
              }
            }}>
              <Text style={s.sidePillTxt}>{speed}x</Text>
            </Pressable>

            <Pressable onPress={() => onSkip(-10)} style={s.skipWrap} hitSlop={8}>
              <Text style={s.skipArc}>↩</Text>
              <Text style={s.skipLbl}>10</Text>
            </Pressable>

            <PlayButton isPlaying={isPlaying} onPress={onTogglePlay} />

            <Pressable onPress={() => onSkip(10)} style={s.skipWrap} hitSlop={8}>
              <Text style={s.skipArc}>↪</Text>
              <Text style={s.skipLbl}>10</Text>
            </Pressable>

            <Pressable onPress={onClose} style={s.sidePill}>
              <Text style={s.sidePillTxt}>⋯</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      </View>
    </View>
  );
}

/** Play/pause with a press-spring, mirroring the main player. */
function PlayButton({ isPlaying, onPress }: { isPlaying: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: false, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable onPressIn={() => spring(0.9)} onPressOut={() => spring(1)} onPress={onPress}>
      <Animated.View style={[s.playBtn, { transform: [{ scale }] }]}>
        <Text style={s.playIco}>{isPlaying ? "❚❚" : "▶"}</Text>
      </Animated.View>
    </Pressable>
  );
}

// Inline newsletter image shown between lyric lines, self-sizing to its ratio.
function LyricImage({ src }: { src: string }) {
  const [ratio, setRatio] = useState(1.6);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Image.getSize(src, (w, h) => { if (live && h > 0) setRatio(w / h); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [src]);
  if (failed) return <View style={{ height: 8 }} />;
  return (
    <View style={s.lyricImgWrap}>
      <Image source={{ uri: src }} style={{ width: "100%", aspectRatio: ratio }} resizeMode="cover" />
    </View>
  );
}

function Line({ line, state, onTap }: { line: ScriptLine; state: "active" | "past" | "next"; onTap: () => void }) {
  if (line.kind === "pause") return <View style={{ height: 12 }} />;

  if (line.kind === "image") {
    if (line.imageSrc) return <LyricImage src={line.imageSrc} />;
    return (
      <View style={s.imgChip}>
        <Text style={s.imgChipTxt}>📷 {line.text || "Image"}</Text>
      </View>
    );
  }

  if (line.kind === "header") {
    return (
      <Pressable onPress={onTap} style={{ paddingVertical: 12 }}>
        <Text style={s.headerTxt}>{line.text.toUpperCase()}</Text>
      </Pressable>
    );
  }

  if (state === "active") {
    return (
      <Pressable onPress={onTap} style={s.activeWrap}>
        <ActiveHighlight text={line.text} />
      </Pressable>
    );
  }

  const color = state === "past" ? P.txtDim : P.txtMid;
  return (
    <Pressable onPress={onTap}>
      <Text style={[s.lineTxt, { color }]}>{line.text}</Text>
    </Pressable>
  );
}

/** The highlight box springs in each time a new line becomes active. */
function ActiveHighlight({ text }: { text: string }) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 24, bounciness: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }),
    ]).start();
  }, [text]);
  return (
    <Animated.View style={[s.highlightBox, { opacity, transform: [{ scale }] }]}>
      <Text style={s.activeTxt}>{text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: P.bg },

  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  nowLabel: { fontSize: 10, color: P.muted, letterSpacing: 1.8, fontWeight: "600" },
  topTitle: { fontSize: 13, color: P.txtMid, marginTop: 3, maxWidth: 260, fontWeight: "500" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: P.surface,
    alignItems: "center", justifyContent: "center",
  },
  closeX: { fontSize: 13, color: P.txt },

  lyricsContent: { paddingHorizontal: 22, paddingTop: SCREEN_H * 0.25 },

  activeWrap: { marginVertical: 6 },
  highlightBox: {
    backgroundColor: P.accent, borderRadius: RADIUS.chip,
    paddingHorizontal: 12, paddingVertical: 7,
    alignSelf: "flex-start",
  },
  activeTxt: { color: "#04120A", fontSize: 30, fontWeight: "800", lineHeight: 40 },

  lineTxt: { fontSize: 28, fontWeight: "700", lineHeight: 40, marginVertical: 4 },

  headerTxt: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
  },
  imgChip: {
    backgroundColor: P.surface, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: "flex-start", marginVertical: 10,
  },
  imgChipTxt: { color: P.muted, fontSize: 12 },
  lyricImgWrap: {
    marginVertical: 16, borderRadius: RADIUS.card, overflow: "hidden",
    backgroundColor: P.surface,
  },

  bottomBar: {
    borderTopWidth: 0.5, borderTopColor: P.border,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 16,
    backgroundColor: P.bg,
  },
  scrubRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scrubTime: { fontSize: 12, color: P.muted, fontVariant: ["tabular-nums"], width: 42, textAlign: "center" },
  scrubHit: { flex: 1, height: 28, justifyContent: "center" },
  scrubTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", position: "relative", overflow: "hidden" },
  scrubFill: { position: "absolute", height: 4, borderRadius: 2, backgroundColor: P.accent, top: 0, left: 0 },

  transport: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 4,
  },
  sidePill: {
    minWidth: 54, height: 34, borderRadius: RADIUS.pill,
    borderWidth: 1.5, borderColor: P.border,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 10,
  },
  sidePillTxt: { fontSize: 13, color: P.txt, fontWeight: "600" },
  skipWrap: { alignItems: "center", gap: 1 },
  skipArc: { fontSize: 26, color: P.txt },
  skipLbl: { fontSize: 10, color: P.muted, marginTop: -4 },
  playBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: P.accent, alignItems: "center", justifyContent: "center",
    shadowColor: P.accent, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
  },
  playIco: { color: "#04120A", fontSize: 22 },
});
