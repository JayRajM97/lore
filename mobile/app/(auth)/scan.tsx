import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { C } from "../../lib/theme";
import { scanInbox } from "../../lib/gmail";
import { useAuth } from "../../store/authStore";

const SUBS = ["Checking the last 30 days", "Finding newsletters", "Almost there"];

export default function Scan() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.accessToken);
  const [sub, setSub] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    const cycle = setInterval(() => setSub((s) => (s + 1) % SUBS.length), 2000);

    if (!accessToken) {
      setError("Not signed in.");
      return () => clearInterval(cycle);
    }

    // Real Gmail scan on-device; cache result for the discover screen.
    scanInbox(accessToken)
      .then((res) => {
        (globalThis as any).__lore_scan = res;
        router.replace("/(auth)/discover");
      })
      .catch((e) => {
        console.error(e);
        setError("Scan failed. Pull down to retry.");
      });
    return () => clearInterval(cycle);
  }, [pulse, router, accessToken]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] });

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
        <View style={styles.core} />
      </View>
      <Text style={styles.title}>{error ? "Hmm." : "Scanning your inbox…"}</Text>
      <Text style={styles.sub}>{error ?? SUBS[sub]}</Text>
      {error && (
        <Pressable style={styles.retry} onPress={() => router.replace("/(auth)/gmail")}>
          <Text style={styles.retryText}>Reconnect Gmail</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, gap: 16 },
  center: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: C.teal },
  core: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal },
  title: { fontSize: 20, fontWeight: "600", color: C.ink, marginTop: 12 },
  sub: { fontSize: 15, color: C.muted, textAlign: "center", paddingHorizontal: 32 },
  retry: { marginTop: 8, backgroundColor: C.teal, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: C.teal50, fontWeight: "600" },
});
