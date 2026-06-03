import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { buildLines, activeLineIndex, ScriptLine } from "../lib/lines";
import { usePlayer } from "../store/playerStore";
import { C } from "../lib/theme";
import { WordTs } from "../lib/types";

const { height: SCREEN_H } = Dimensions.get("window");

export default function LyricsView({
  text,
  duration,
  words,
}: {
  text: string;
  duration: number;
  words?: WordTs[] | null;
}) {
  const { playbackPosition, seek, resume, isPlaying } = usePlayer();
  const lines = useMemo(
    () => (duration > 0 ? buildLines(text, duration, words) : []),
    [text, duration, words]
  );

  const active = activeLineIndex(lines, playbackPosition);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const manualUntil = useRef(0);

  // auto-scroll active line to ~35% from top unless user scrolled recently
  useEffect(() => {
    if (active < 0) return;
    if (Date.now() < manualUntil.current) return;
    const y = offsets.current[active];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - SCREEN_H * 0.35), animated: true });
  }, [active]);

  function onManual(_e: NativeSyntheticEvent<NativeScrollEvent>) {
    manualUntil.current = Date.now() + 3000;
  }

  function tap(line: ScriptLine) {
    if (!line.tappable) return;
    seek(line.start_time);
    if (!isPlaying) resume();
    manualUntil.current = 0;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={onManual}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: SCREEN_H * 0.32, paddingBottom: SCREEN_H * 0.4, paddingHorizontal: 24 }}
      >
        {lines.map((line, i) => (
          <View
            key={line.index}
            onLayout={(e) => {
              offsets.current[i] = e.nativeEvent.layout.y;
            }}
          >
            <LyricLine line={line} state={i === active ? "active" : i < active ? "past" : "upcoming"} onTap={() => tap(line)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LyricLine({
  line,
  state,
  onTap,
}: {
  line: ScriptLine;
  state: "active" | "past" | "upcoming";
  onTap: () => void;
}) {
  if (line.kind === "header") {
    return (
      <Text style={styles.header}>{line.text.toUpperCase()}</Text>
    );
  }
  if (line.kind === "image") {
    return (
      <View style={styles.chip}>
        <Text style={styles.chipText}>📷 Image{line.text ? ` — ${line.text}` : ""}</Text>
      </View>
    );
  }
  if (line.kind === "pause") {
    return <View style={{ height: 22 }} />;
  }

  const style =
    state === "active" ? styles.active : state === "past" ? styles.past : styles.upcoming;
  return (
    <Pressable onPress={onTap}>
      <Text style={[styles.line, style]}>{line.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.tealDark },
  line: { color: C.white, lineHeight: 36, paddingVertical: 6 },
  active: { fontSize: 30, fontWeight: "600", opacity: 1 },
  past: { fontSize: 22, opacity: 0.35 },
  upcoming: { fontSize: 22, opacity: 0.55 },
  header: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.6,
    paddingTop: 24,
    paddingBottom: 8,
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginVertical: 10,
  },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
});
