import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { scanInbox } from "../../lib/gmail";
import { useAuth } from "../../store/authStore";

const SUBS = [
  "Checking the last 90 days",
  "Finding newsletters",
  "Filtering noise…",
  "Almost there",
];

export default function Scan() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.accessToken);
  const [sub, setSub] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Token expired → must re-auth before scanning
    if (!accessToken) {
      router.replace("/(auth)/gmail");
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    const cycle = setInterval(() => setSub((s) => (s + 1) % SUBS.length), 2500);

    scanInbox(accessToken)
      .then((res) => {
        (globalThis as any).__lore_scan = res;
        (globalThis as any).__lore_generating = null; // clear stale state
        router.replace("/(auth)/discover");
      })
      .catch((e) => {
        console.error(e);
        setError("Scan failed. Check your connection and try again.");
      });

    return () => clearInterval(cycle);
  }, [accessToken]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.05] });

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
        <View style={styles.core}>
          <Text style={styles.coreIcon}>✉</Text>
        </View>
      </View>
      <Text style={styles.title}>{error ? "Something went wrong" : "Scanning your inbox…"}</Text>
      <Text style={styles.sub}>{error ?? SUBS[sub]}</Text>
      {error && (
        <Pressable style={styles.retry} onPress={() => router.replace("/(auth)/gmail")}>
          <Text style={styles.retryText}>Reconnect Gmail</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, gap: 20 },
  center: { width: 130, height: 130, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: C.teal },
  core: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  coreIcon: { fontSize: 26, color: C.white },
  title: { fontSize: 20, fontWeight: "700", color: C.ink, marginTop: 8 },
  sub: { fontSize: 15, color: C.muted, textAlign: "center", paddingHorizontal: 40 },
  retry: { marginTop: 4, backgroundColor: C.teal, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: C.white, fontWeight: "600" },
});
