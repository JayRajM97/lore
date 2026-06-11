import { useEffect, useMemo, useRef } from "react";
import {
  Dimensions,
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
import { SPEEDS } from "../lib/theme";
import Avatar from "./Avatar";

const { height: SCREEN_H } = Dimensions.get("window");

// Design 2: dark forest green bg, bright green phrase highlight
const BG      = "#0a1a0d";
const GREEN   = "#22c55e";
const TXT_ON  = "#ffffff";
const TXT_DIM = "rgba(255,255,255,0.25)";
const TXT_MID = "rgba(255,255,255,0.5)";
const MUTED   = "rgba(255,255,255,0.38)";
const BORDER  = "rgba(255,255,255,0.08)";

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
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, words) : []),
    [text, duration, words]
  );

  const active = activeLineIndex(lines, playbackPosition);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const manualUntil = useRef(0);

  useEffect(() => {
    if (active < 0) return;
    if (Date.now() < manualUntil.current) return;
    const y = offsets.current[active];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCREEN_H * 0.32), animated: true });
  }, [active]);

  const trackW = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant:   (e) => onSeek(clamp(e.nativeEvent.locationX / (trackW.current || 1)) * duration),
      onPanResponderMove:    (e) => onSeek(clamp(e.nativeEvent.locationX / (trackW.current || 1)) * duration),
      onPanResponderRelease: (e) => onSeek(clamp(e.nativeEvent.locationX / (trackW.current || 1)) * duration),
    })
  ).current;

  function clamp(n: number) { return Math.min(Math.max(n, 0), 1); }

  const pct = duration > 0 ? clamp(playbackPosition / duration) * 100 : 0;
  const remaining = Math.max(0, duration - playbackPosition);

  return (
    <View style={s.wrap}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: BG }}>
        <View style={s.topBar}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={s.nowLabel}>NOW NARRATING</Text>
            <Text style={s.topTitle} numberOfLines={1}>{ep.subject}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn}>
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

      {/* bottom controls — design 2 style */}
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: BG }}>
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
                <View style={[s.scrubFill, { width: `${pct}%` }]} />
              </View>
            </View>
            <Text style={s.scrubTime}>-{mmss(remaining)}</Text>
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

            <Pressable onPress={() => onSkip(-10)} style={s.skipWrap}>
              <Text style={s.skipArc}>↩</Text>
              <Text style={s.skipLbl}>10</Text>
            </Pressable>

            <Pressable onPress={onTogglePlay} style={s.playBtn}>
              <Text style={s.playIco}>{isPlaying ? "❚❚" : "▶"}</Text>
            </Pressable>

            <Pressable onPress={() => onSkip(10)} style={s.skipWrap}>
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
  );
}

function Line({ line, state, onTap }: { line: ScriptLine; state: "active" | "past" | "next"; onTap: () => void }) {
  if (line.kind === "pause") return <View style={{ height: 12 }} />;

  if (line.kind === "image") {
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

  // normal spoken line
  // Active: entire line gets a bright green highlight box (design 2 style)
  if (state === "active") {
    return (
      <Pressable onPress={onTap} style={s.activeWrap}>
        <View style={s.highlightBox}>
          <Text style={s.activeTxt}>{line.text}</Text>
        </View>
      </Pressable>
    );
  }

  const color = state === "past" ? TXT_DIM : TXT_MID;
  return (
    <Pressable onPress={onTap}>
      <Text style={[s.lineTxt, { color }]}>{line.text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  nowLabel: { fontSize: 10, color: MUTED, letterSpacing: 1.8, fontWeight: "600" },
  topTitle: { fontSize: 13, color: TXT_MID, marginTop: 3, maxWidth: 260, fontWeight: "500" },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  closeX: { fontSize: 13, color: TXT_ON },

  lyricsContent: { paddingHorizontal: 22, paddingTop: SCREEN_H * 0.25 },

  // active line — green highlight box around the WHOLE line
  activeWrap: { marginVertical: 6 },
  highlightBox: {
    backgroundColor: GREEN, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: "flex-start",
  },
  activeTxt: { color: "#000", fontSize: 30, fontWeight: "800", lineHeight: 40 },

  lineTxt: { fontSize: 28, fontWeight: "700", lineHeight: 40, marginVertical: 4 },

  headerTxt: {
    fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.3)",
    letterSpacing: 2,
  },
  imgChip: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: "flex-start", marginVertical: 10,
  },
  imgChipTxt: { color: MUTED, fontSize: 12 },

  // bottom bar
  bottomBar: {
    borderTopWidth: 0.5, borderTopColor: BORDER,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 16,
    backgroundColor: BG,
  },
  scrubRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scrubTime: { fontSize: 12, color: MUTED, fontVariant: ["tabular-nums"], width: 38, textAlign: "center" },
  scrubHit: { flex: 1, height: 24, justifyContent: "center" },
  scrubTrack: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", position: "relative" },
  scrubFill: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: GREEN, top: 0, left: 0 },

  transport: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 4,
  },
  sidePill: {
    minWidth: 52, height: 30, borderRadius: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 8,
  },
  sidePillTxt: { fontSize: 13, color: TXT_ON, fontWeight: "600" },
  skipWrap: { alignItems: "center", gap: 1 },
  skipArc: { fontSize: 26, color: TXT_ON },
  skipLbl: { fontSize: 10, color: MUTED, marginTop: -4 },
  playBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: GREEN, alignItems: "center", justifyContent: "center",
    shadowColor: GREEN, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
  },
  playIco: { color: "#000", fontSize: 22 },
});
