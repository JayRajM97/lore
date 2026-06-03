import { useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";

const { width } = Dimensions.get("window");

const CARDS = [
  { art: "🎧", title: "Your newsletters, spoken aloud", sub: "Connect Gmail and we'll find every newsletter you subscribe to." },
  { art: "〜", title: "Podcast-style, automatically", sub: "New issue arrives → audio ready. No manual uploads, ever." },
  { art: "✦", title: "Read along as you listen", sub: "Tap any line to jump. Speed up. Save for later." },
];

export default function Onboarding() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      {page < 2 && (
        <Pressable style={styles.skip} onPress={() => router.replace("/(auth)/gmail")}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {CARDS.map((c, i) => (
          <View key={i} style={[styles.card, { width }]}>
            <Text style={styles.art}>{c.art}</Text>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.sub}>{c.sub}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {CARDS.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>

      {page === 2 ? (
        <Pressable style={styles.cta} onPress={() => router.replace("/(auth)/gmail")}>
          <Text style={styles.ctaText}>Connect Gmail</Text>
        </Pressable>
      ) : (
        <View style={styles.ctaSpacer} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  skip: { position: "absolute", top: 60, right: 24, zIndex: 10 },
  skipText: { color: C.muted, fontSize: 15 },
  card: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 20 },
  art: { fontSize: 72 },
  title: { fontSize: 26, fontWeight: "600", color: C.ink, textAlign: "center" },
  sub: { fontSize: 16, color: C.muted, textAlign: "center", lineHeight: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotOn: { backgroundColor: C.indigo, width: 22 },
  cta: { marginHorizontal: 24, marginBottom: 12, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: C.teal50, fontWeight: "600", fontSize: 16 },
  ctaSpacer: { height: 64 },
});
