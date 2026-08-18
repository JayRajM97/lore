import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../store/playerStore";
import { useAuth } from "../store/authStore";
import { C, P, RADIUS, SERIF, SHADOW } from "../lib/theme";
import { mmss, episodeDate } from "../lib/format";
import { getPref, setPref } from "../lib/prefs";
import { fetchRawHtml } from "../lib/gmail";
import { useIsDesktop, CONTENT } from "../lib/responsive";
import Avatar from "../components/Avatar";
import ReadAlong from "../components/ReadAlong";
import HtmlView from "../components/HtmlView";
import SpeedSlider from "../components/SpeedSlider";
import { FadeInUp } from "../components/anim";

type Mode = "player" | "read" | "original";

// Stacked-card art colors derived from the newsletter name.
function artBg(name: string): string {
  const palette = ["#0d2818","#0d1828","#1a0d28","#28100d","#0d2828","#1a280d","#280d1a","#101028"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

// Theme palettes — LIGHT is the default; dark is a toggle at the top.
const LIGHT = {
  bg: C.bg, txt: C.ink, mut: C.muted, accent: C.teal, accentTxt: C.white,
  surface: "#ECEAE2", border: C.border, track: "#E2E0D8", thumb: C.ink,
  segBg: "#ECEAE2", segOn: C.white, segTxt: C.muted, segTxtOn: C.ink,
};
const DARK = {
  bg: P.bg, txt: P.txt, mut: P.muted, accent: P.accent, accentTxt: "#04120A",
  surface: P.surface, border: P.border, track: "rgba(255,255,255,0.12)", thumb: P.txt,
  segBg: P.surface, segOn: P.card, segTxt: P.txtMid, segTxtOn: P.txt,
};

export default function Player() {
  const router = useRouter();
  const desktop = useIsDesktop();
  const token = useAuth((s) => s.accessToken);
  const {
    currentEpisode: ep,
    isPlaying,
    playbackPosition,
    duration,
    speed,
    generating,
    togglePlay,
    skip,
    seek,
    setSpeed,
  } = usePlayer();

  const [dark, setDark] = useState(() => getPref("player_theme", "light") === "dark");
  const [mode, setMode] = useState<Mode>("player");
  const T = dark ? DARK : LIGHT;

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    setPref("player_theme", next ? "dark" : "light");
  }

  // ── smooth scrubber (interpolates between 100ms status updates) ──────────
  const trackW = useRef(0);
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

  // ── artwork breathing: full-size while playing, eases down paused ─────────
  const artScale = useRef(new Animated.Value(isPlaying ? 1 : 0.92)).current;
  useEffect(() => {
    Animated.spring(artScale, {
      toValue: isPlaying ? 1 : 0.92,
      useNativeDriver: false, speed: 14, bounciness: 7,
    }).start();
  }, [isPlaying]);

  const playScale = useRef(new Animated.Value(1)).current;
  const springPlay = (v: number) =>
    Animated.spring(playScale, { toValue: v, useNativeDriver: false, speed: 40, bounciness: 6 }).start();

  // ── original email (raw HTML) for the Original mode ──────────────────────
  const [html, setHtml] = useState<string | null>(null);
  const [htmlErr, setHtmlErr] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "original" || html || !ep?.gmail_message_id || !token) return;
    fetchRawHtml(ep.gmail_message_id, token)
      .then((h) => (h ? setHtml(h) : setHtmlErr("Couldn't load the original email.")))
      .catch(() => setHtmlErr("Couldn't load the original email."));
  }, [mode, ep?.gmail_message_id, token, html]);
  useEffect(() => { setHtml(null); setHtmlErr(null); setMode("player"); }, [ep?.id]);

  const [speedOpen, setSpeedOpen] = useState(false);

  if (!ep) return <Redirect href="/home" />;

  const canOriginal = !!ep.gmail_message_id && !!token;
  const stack1 = artBg(ep.sender_name);
  const stack2 = artBg(ep.subject);

  return (
    <View style={[s.wrap, { backgroundColor: T.bg }]}>
      <View style={[s.column, desktop && { maxWidth: CONTENT.player, alignSelf: "center", width: "100%" }]}>
        <SafeAreaView edges={["top"]} style={{ backgroundColor: T.bg }}>
          {/* ── top bar: close · mode segments · theme ── */}
          <View style={s.topBar}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))} style={[s.iconCircle, { backgroundColor: T.surface }]} hitSlop={8}>
              <Text style={[s.backArrow, { color: T.txt }]}>‹</Text>
            </Pressable>

            <View style={[s.segments, { backgroundColor: T.segBg }]}>
              {([["player", "Player"], ["read", "Read"], ...(canOriginal ? [["original", "Original"]] : [])] as [Mode, string][]).map(([m, label]) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[s.segBtn, mode === m && { backgroundColor: T.segOn, ...(SHADOW.card as object) }]}
                >
                  <Text style={[s.segTxt, { color: mode === m ? T.segTxtOn : T.segTxt }]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={toggleTheme} style={[s.iconCircle, { backgroundColor: T.surface }]} hitSlop={8}>
              <Text style={s.themeIcon}>{dark ? "☀️" : "🌙"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>

        {/* ── middle region: cover stack | read-along | original ── */}
        {mode === "player" && (
          <View style={s.centerZone}>
            {/* stacked cards behind the artwork */}
            <View style={s.artWrap}>
              <View style={[s.stackCard, { backgroundColor: stack2, transform: [{ rotate: "6deg" }, { translateX: 14 }] }]} />
              <View style={[s.stackCard, { backgroundColor: stack1, transform: [{ rotate: "-5deg" }, { translateX: -12 }] }]} />
              <Animated.View style={[s.artBox, { backgroundColor: stack1, transform: [{ scale: artScale }] }]}>
                <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={104} />
              </Animated.View>
            </View>

            <FadeInUp style={s.info}>
              <Text style={[s.senderLabel, { color: T.accent }]}>{ep.sender_name.toUpperCase()}</Text>
              <Text style={[s.title, { color: T.txt }]} numberOfLines={3}>{ep.subject}</Text>
              {ep.received_at ? (
                <Text style={[s.dateLabel, { color: T.mut }]}>{episodeDate(ep.received_at)}</Text>
              ) : null}
              {generating && (
                <Text style={[s.genLabel, { color: T.mut }]}>Preparing audio…</Text>
              )}
            </FadeInUp>
          </View>
        )}

        {mode === "read" && (
          <ReadAlong
            episode={ep}
            dark={dark}
            duration={duration}
            playbackPosition={playbackPosition}
            isPlaying={isPlaying}
            speed={speed}
            onSeek={seek}
          />
        )}

        {mode === "original" && (
          <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: RADIUS.chip, overflow: "hidden", marginHorizontal: 12 }}>
            {!html && !htmlErr && (
              <View style={s.centerFill}><ActivityIndicator color={C.teal} /></View>
            )}
            {htmlErr && <Text style={[s.notice, { color: C.muted }]}>{htmlErr}</Text>}
            {html && <HtmlView html={html} />}
          </View>
        )}

        {/* ── scrubber ── */}
        <View style={s.scrubWrap}>
          <View
            onLayout={(e: LayoutChangeEvent) => { trackW.current = e.nativeEvent.layout.width; }}
            {...pan.panHandlers}
            style={s.trackHit}
          >
            <View style={[s.track, { backgroundColor: T.track }]} pointerEvents="none">
              <Animated.View
                style={[s.fill, {
                  backgroundColor: T.accent,
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                }]}
              />
              <Animated.View
                style={[s.thumb, {
                  backgroundColor: T.thumb,
                  left: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                }]}
              />
            </View>
          </View>
          <View style={s.timeRow}>
            <Text style={[s.timeText, { color: T.mut }]}>{mmss(playbackPosition)}</Text>
            <Text style={[s.timeText, { color: T.mut }]}>-{mmss(Math.max(0, duration - playbackPosition))}</Text>
          </View>
        </View>

        {/* ── speed slider panel ── */}
        {speedOpen && (
          <View style={[s.speedPanel, { backgroundColor: dark ? P.card : C.white }, SHADOW.float as object]}>
            <SpeedSlider
              value={Math.round(speed * 10) / 10}
              onChange={(v) => setSpeed(v)}
              colors={{ accent: T.accent, track: T.track, txt: T.txt, mut: T.mut }}
            />
          </View>
        )}

        {/* ── transport ── */}
        <View style={s.controls}>
          <Pressable
            onPress={() => setSpeedOpen((v) => !v)}
            style={[s.pill, { borderColor: T.border }, speedOpen && { backgroundColor: T.accent, borderColor: T.accent }]}
          >
            <Text style={[s.pillTxt, { color: speedOpen ? T.accentTxt : T.txt }]}>
              {(Math.round(speed * 10) / 10).toFixed(1)}×
            </Text>
          </Pressable>

          <Pressable onPress={() => skip(-15)} style={s.skipWrap} hitSlop={8}>
            <Text style={[s.skipArc, { color: T.txt }]}>↺</Text>
            <Text style={[s.skipNum, { color: T.mut }]}>15</Text>
          </Pressable>

          <Pressable onPressIn={() => springPlay(0.9)} onPressOut={() => springPlay(1)} onPress={togglePlay} disabled={generating}>
            <Animated.View style={[s.playBtn, { backgroundColor: T.accent, transform: [{ scale: playScale }] }, dark ? (SHADOW.glow(P.accent) as object) : (SHADOW.glow(C.teal) as object)]}>
              {generating
                ? <ActivityIndicator color={T.accentTxt} />
                : <Text style={[s.playIcon, { color: T.accentTxt }]}>{isPlaying ? "❚❚" : "▶"}</Text>}
            </Animated.View>
          </Pressable>

          <Pressable onPress={() => skip(15)} style={s.skipWrap} hitSlop={8}>
            <Text style={[s.skipArc, { color: T.txt }]}>↻</Text>
            <Text style={[s.skipNum, { color: T.mut }]}>15</Text>
          </Pressable>

          <Pressable onPress={() => setMode(mode === "read" ? "player" : "read")} style={[s.pill, { borderColor: T.border }, mode === "read" && { backgroundColor: T.accent, borderColor: T.accent }]}>
            <Text style={[s.pillTxt, { color: mode === "read" ? T.accentTxt : T.txt }]}>Aa</Text>
          </Pressable>
        </View>

        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: T.bg }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  column: { flex: 1 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  backArrow: { fontSize: 26, lineHeight: 28, marginTop: -2, fontWeight: "600" },
  themeIcon: { fontSize: 15 },

  segments: { flexDirection: "row", borderRadius: RADIUS.pill, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.pill },
  segTxt: { fontSize: 13, fontWeight: "600" },

  centerZone: { flex: 1, justifyContent: "center", gap: 30, paddingBottom: 10 },

  artWrap: { alignItems: "center", justifyContent: "center", height: 300 },
  stackCard: {
    position: "absolute", width: 240, height: 240, borderRadius: RADIUS.xl,
    opacity: 0.28,
  },
  artBox: {
    width: 260, height: 260, borderRadius: RADIUS.xl,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35,
    shadowRadius: 32, shadowOffset: { width: 0, height: 16 },
  },

  info: { alignItems: "center", paddingHorizontal: 36, gap: 7 },
  senderLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", lineHeight: 30, fontFamily: SERIF },
  dateLabel: { fontSize: 13, textAlign: "center", letterSpacing: 0.3 },
  genLabel: { fontSize: 13, fontStyle: "italic" },

  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  notice: { fontSize: 14, textAlign: "center", padding: 32 },

  scrubWrap: { paddingHorizontal: 26, marginTop: 14, gap: 8 },
  trackHit: { height: 32, justifyContent: "center" },
  track: { height: 5, borderRadius: 3, position: "relative" },
  fill: { position: "absolute", height: 5, borderRadius: 3, top: 0, left: 0 },
  thumb: {
    position: "absolute", width: 16, height: 16, borderRadius: 8,
    top: -5.5, marginLeft: -8,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, fontVariant: ["tabular-nums"] },

  controls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30, paddingVertical: 18,
  },
  speedPanel: {
    marginHorizontal: 26, marginTop: 10,
    borderRadius: RADIUS.card, padding: 16,
  },
  pill: {
    minWidth: 54, height: 36, borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
  },
  pillTxt: { fontSize: 13.5, fontWeight: "700" },
  skipWrap: { alignItems: "center", gap: 1 },
  skipArc: { fontSize: 27 },
  skipNum: { fontSize: 10.5, marginTop: -5 },
  playBtn: {
    width: 78, height: 78, borderRadius: 39,
    alignItems: "center", justifyContent: "center",
  },
  playIcon: { fontSize: 28 },
});
