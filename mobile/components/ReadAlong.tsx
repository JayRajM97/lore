import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buildLines, activeLineIndex, ScriptLine } from "../lib/lines";
import { Episode } from "../lib/types";
import { C, P, RADIUS, SERIF } from "../lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

// Read Along: the newsletter in clean article format (serif headings, prose,
// inline images) where the line currently being SPOKEN is highlighted and the
// page auto-scrolls with playback. Tap any line to seek. Light/dark themable.
export default function ReadAlong({
  episode,
  dark,
  duration,
  playbackPosition,
  isPlaying,
  speed,
  onSeek,
}: {
  episode: Episode;
  dark: boolean;
  duration: number;
  playbackPosition: number;
  isPlaying: boolean;
  speed: number;
  onSeek: (s: number) => void;
}) {
  const T = dark
    ? { txt: P.txt, mut: P.txtMid, dim: P.txtDim, hlBg: P.accentDim, hlTxt: P.accent, imgBg: P.surface }
    : { txt: C.ink, mut: C.muted, dim: "#B9B7AD", hlBg: C.teal50, hlTxt: C.teal, imgBg: C.surface };

  const text = episode.tts_script ?? episode.raw_text ?? episode.subject;
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, episode.words) : []),
    [text, duration, episode.words]
  );

  // Same 60fps interpolation engine as the lyrics view: re-render only when
  // the active line changes.
  const [active, setActive] = useState(-1);
  const activeRef = useRef(-1);
  const baseline = useRef({ pos: playbackPosition, at: Date.now() });

  useEffect(() => {
    baseline.current = { pos: playbackPosition, at: Date.now() };
  }, [playbackPosition, isPlaying, speed]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const b = baseline.current;
      const pos = isPlaying ? b.pos + ((Date.now() - b.at) / 1000) * speed : b.pos;
      const idx = activeLineIndex(lines, Math.min(Math.max(pos, 0), duration || pos));
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, duration, isPlaying, speed]);

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const manualUntil = useRef(0);

  useEffect(() => {
    if (active < 0) return;
    if (Date.now() < manualUntil.current) return;
    const y = offsets.current[active];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCREEN_H * 0.28), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={() => { manualUntil.current = Date.now() + 3000; }}
      scrollEventThrottle={32}
      contentContainerStyle={s.content}
    >
      <Text style={[s.title, { color: T.txt }]}>{episode.subject}</Text>
      {lines.map((line, i) => (
        <View key={i} onLayout={(e) => { offsets.current[i] = e.nativeEvent.layout.y; }}>
          <Line
            line={line}
            state={i === active ? "active" : i < active ? "past" : "next"}
            T={T}
            onTap={() => {
              if (line.tappable) {
                onSeek(line.start_time);
                manualUntil.current = 0;
              }
            }}
          />
        </View>
      ))}
      <View style={{ height: 160 }} />
    </ScrollView>
  );
}

function Line({
  line, state, T, onTap,
}: {
  line: ScriptLine;
  state: "active" | "past" | "next";
  T: { txt: string; mut: string; dim: string; hlBg: string; hlTxt: string; imgBg: string };
  onTap: () => void;
}) {
  if (line.kind === "pause") return <View style={{ height: 10 }} />;

  if (line.kind === "image") {
    if (line.imageSrc) return <ArticleImage src={line.imageSrc} bg={T.imgBg} />;
    return null;
  }

  if (line.kind === "header") {
    return (
      <Pressable onPress={onTap}>
        <Text style={[s.heading, { color: state === "past" ? T.mut : T.txt }]}>{line.text}</Text>
      </Pressable>
    );
  }

  const isActive = state === "active";
  return (
    <Pressable onPress={onTap}>
      <Text
        style={[
          s.para,
          { color: state === "past" ? T.mut : T.txt },
          isActive && { backgroundColor: T.hlBg, color: T.hlTxt, fontWeight: "600" },
          isActive && s.paraActive,
        ]}
      >
        {line.text}
      </Text>
    </Pressable>
  );
}

function ArticleImage({ src, bg }: { src: string; bg: string }) {
  const [ratio, setRatio] = useState(1.6);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Image.getSize(src, (w, h) => { if (live && h > 0) setRatio(w / h); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [src]);
  if (failed) return null;
  return (
    <View style={[s.imgWrap, { backgroundColor: bg }]}>
      <Image source={{ uri: src }} style={{ width: "100%", aspectRatio: ratio }} resizeMode="cover" />
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 10 },
  title: {
    fontSize: 24, fontWeight: "700", fontFamily: SERIF,
    lineHeight: 31, marginBottom: 16,
  },
  heading: {
    fontSize: 18, fontWeight: "700", fontFamily: SERIF,
    lineHeight: 25, marginTop: 18, marginBottom: 4,
  },
  para: {
    fontSize: 16.5, lineHeight: 27, marginVertical: 3,
    borderRadius: RADIUS.chip, paddingHorizontal: 6, marginHorizontal: -6,
  },
  paraActive: { paddingVertical: 3 },
  imgWrap: { marginVertical: 14, borderRadius: RADIUS.card, overflow: "hidden" },
});
