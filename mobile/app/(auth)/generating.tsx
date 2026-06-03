import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Newsletter } from "../../lib/types";
import Avatar from "../../components/Avatar";

const STAGES = ["Queued", "Fetching", "Generating", "Done"] as const;

export default function Generating() {
  const router = useRouter();
  const list: Newsletter[] = useMemo(() => (globalThis as any).__lore_generating ?? [], []);
  const [stage, setStage] = useState<number[]>(() => list.map(() => 0));
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    list.forEach((_, i) => {
      for (let s = 1; s <= 3; s++) {
        timers.push(
          setTimeout(() => {
            setStage((prev) => {
              const next = [...prev];
              next[i] = Math.max(next[i], s);
              return next;
            });
          }, i * 1500 + s * 1400)
        );
      }
    });
    const skipT = setTimeout(() => setShowSkip(true), 10000);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(skipT);
    };
  }, [list]);

  const done = stage.filter((s) => s === 3).length;
  const overall = list.length ? done / list.length : 0;

  // auto-advance to home when everything done
  useEffect(() => {
    if (list.length && done === list.length) {
      const t = setTimeout(() => router.replace("/home"), 800);
      return () => clearTimeout(t);
    }
  }, [done, list.length, router]);

  const minutes = Math.max(1, Math.round(list.length * 0.7));

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <Text style={styles.h1}>Preparing your feed</Text>
        <Text style={styles.sub}>
          About {minutes} min for {list.length} newsletter{list.length === 1 ? "" : "s"}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${overall * 100}%` }]} />
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, gap: 10 }}>
        {list.map((nl, i) => (
          <View key={nl.id} style={styles.row}>
            <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={40} />
            <Text style={styles.name} numberOfLines={1}>
              {nl.sender_name}
            </Text>
            <Text style={[styles.status, stage[i] === 3 && { color: C.teal }]}>
              {stage[i] === 3 ? "Done ✓" : STAGES[stage[i]]}
            </Text>
          </View>
        ))}
      </View>

      {showSkip && (
        <Pressable style={styles.skip} onPress={() => router.replace("/home")}>
          <Text style={styles.skipText}>Skip and explore →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { padding: 20, gap: 8 },
  h1: { fontSize: 24, fontWeight: "600", color: C.ink },
  sub: { fontSize: 15, color: C.muted },
  track: { height: 6, backgroundColor: C.border, borderRadius: 100, marginTop: 10, overflow: "hidden" },
  fill: { height: 6, backgroundColor: C.teal },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: "500", color: C.ink },
  status: { fontSize: 13, color: C.muted },
  skip: { alignItems: "center", paddingVertical: 20 },
  skipText: { color: C.teal, fontSize: 15, fontWeight: "500" },
});
