import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio, AVPlaybackStatus } from "expo-av";
import { SIDECAR_URL } from "./config";

const DEFAULT_DESCRIPTION =
  "Realistic male voice in the 30s with american accent. Normal pitch, warm timbre, conversational pacing.";
const SPEEDS = [0.75, 1, 1.5, 2];

const C = {
  paper: "#FAFAF8",
  surface: "#F1EFE8",
  border: "#D3D1C7",
  ink: "#2C2C2A",
  muted: "#5F5E5A",
  teal: "#0F6E56",
  teal50: "#E1F5EE",
  coral: "#D85A30",
  coral50: "#FAECE7",
  amber: "#BA7517",
  amber50: "#FAEEDA",
};

interface Stats {
  generation_time_ms: number;
  audio_duration_s: number;
  word_count: number;
}

function mmss(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function App() {
  const [text, setText] = useState("");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  function onStatus(s: AVPlaybackStatus) {
    if (!s.isLoaded) return;
    setPosition((s.positionMillis || 0) / 1000);
    setDuration((s.durationMillis || 0) / 1000);
    setPlaying(s.isPlaying);
  }

  async function handleGenerate() {
    if (!text.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${SIDECAR_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, description: description.trim() || DEFAULT_DESCRIPTION }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStats({
        generation_time_ms: data.generation_time_ms,
        audio_duration_s: data.audio_duration_s,
        word_count: data.word_count,
      });

      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: `${SIDECAR_URL}${data.audio_url}` },
        { shouldPlay: false, rate: speed, shouldCorrectPitch: true },
        onStatus
      );
      soundRef.current = sound;
    } catch (e: any) {
      console.error(e);
      setError("Generation failed. Is the sidecar reachable at " + SIDECAR_URL + "?");
    } finally {
      setGenerating(false);
    }
  }

  async function togglePlay() {
    const s = soundRef.current;
    if (!s) return;
    playing ? await s.pauseAsync() : await s.playAsync();
  }

  async function skip(delta: number) {
    const s = soundRef.current;
    if (!s) return;
    const next = Math.min(Math.max(0, position + delta), duration) * 1000;
    await s.setPositionAsync(next);
  }

  async function changeSpeed(rate: number) {
    setSpeed(rate);
    await soundRef.current?.setRateAsync(rate, true);
  }

  const ratio =
    stats && stats.generation_time_ms > 0
      ? (stats.audio_duration_s / (stats.generation_time_ms / 1000)).toFixed(1)
      : "—";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>Lore</Text>

      <Text style={styles.label}>PASTE YOUR TEXT</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Paste a newsletter, an article, anything…"
        placeholderTextColor={C.muted}
        multiline
        style={styles.textarea}
      />
      <Text style={styles.charCount}>{text.length} chars</Text>

      <Text style={styles.label}>VOICE DESCRIPTION</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={styles.input}
      />

      <Pressable
        onPress={handleGenerate}
        disabled={generating}
        style={[styles.cta, generating && { opacity: 0.7 }]}
      >
        {generating ? (
          <ActivityIndicator color={C.teal50} />
        ) : (
          <Text style={styles.ctaText}>Convert to Audio</Text>
        )}
      </Pressable>

      {stats && !generating && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            ⚡ Generated in {(stats.generation_time_ms / 1000).toFixed(2)}s
          </Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Player */}
      {soundRef.current && (
        <View style={styles.player}>
          <Text style={styles.title} numberOfLines={1}>
            {text.slice(0, 60)}
          </Text>

          <View style={styles.timeRow}>
            <Text style={styles.time}>{mmss(position)}</Text>
            <Text style={styles.time}>{mmss(duration)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${duration ? (position / duration) * 100 : 0}%` },
              ]}
            />
          </View>

          <View style={styles.controls}>
            <Pressable onPress={() => skip(-15)} style={styles.skip}>
              <Text style={styles.skipText}>-15s</Text>
            </Pressable>
            <Pressable onPress={togglePlay} style={styles.play}>
              <Text style={styles.playText}>{playing ? "❚❚" : "▶"}</Text>
            </Pressable>
            <Pressable onPress={() => skip(15)} style={styles.skip}>
              <Text style={styles.skipText}>+15s</Text>
            </Pressable>
          </View>

          <View style={styles.speeds}>
            {SPEEDS.map((s) => (
              <Pressable
                key={s}
                onPress={() => changeSpeed(s)}
                style={[styles.pill, s === speed && styles.pillActive]}
              >
                <Text style={[styles.pillText, s === speed && styles.pillTextActive]}>
                  {s}x
                </Text>
              </Pressable>
            ))}
          </View>

          {stats && (
            <View style={styles.stats}>
              <Text style={styles.statText}>
                Generation: {(stats.generation_time_ms / 1000).toFixed(1)}s
              </Text>
              <Text style={styles.statText}>
                Duration: {mmss(stats.audio_duration_s)}
              </Text>
              <Text style={styles.statText}>Ratio: {ratio}x realtime</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  content: { padding: 20, paddingTop: 64, gap: 8 },
  brand: { fontSize: 24, fontWeight: "700", color: C.teal, marginBottom: 8 },
  label: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.7,
    color: C.muted,
    marginTop: 8,
  },
  textarea: {
    minHeight: 160,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: C.ink,
    backgroundColor: C.paper,
    textAlignVertical: "top",
  },
  charCount: { alignSelf: "flex-end", fontSize: 12, color: C.muted },
  input: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: C.ink,
  },
  cta: {
    marginTop: 12,
    backgroundColor: C.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: { color: C.teal50, fontWeight: "600", fontSize: 15 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: C.coral50,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  badgeText: { color: C.coral, fontSize: 13 },
  error: { color: C.coral, fontSize: 13, marginTop: 8 },
  player: {
    marginTop: 24,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
  },
  title: { fontSize: 15, fontWeight: "500", color: C.ink, textAlign: "center" },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  time: { fontSize: 12, color: C.muted },
  track: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 100,
    marginTop: 4,
    overflow: "hidden",
  },
  fill: { height: 4, backgroundColor: C.teal },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    marginTop: 20,
  },
  skip: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 100,
    backgroundColor: C.paper,
    justifyContent: "center",
  },
  skipText: { color: C.ink, fontSize: 12 },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.teal,
    justifyContent: "center",
    alignItems: "center",
  },
  playText: { color: C.teal50, fontSize: 22 },
  speeds: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 20 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: C.paper,
  },
  pillActive: { backgroundColor: C.amber50 },
  pillText: { fontSize: 13, color: "#444441" },
  pillTextActive: { color: C.amber },
  stats: { marginTop: 20, gap: 4 },
  statText: { fontSize: 13, color: C.muted },
});
