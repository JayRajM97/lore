import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { C } from "../../lib/theme";
import { api } from "../../lib/api";

const SUBS = ["Checking the last 30 days", "Finding newsletters", "Almost there"];

export default function Scan() {
  const router = useRouter();
  const [sub, setSub] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    const cycle = setInterval(() => setSub((s) => (s + 1) % SUBS.length), 2000);

    // store result on a module cache for discover to read
    api.scanInbox().then((res) => {
      (globalThis as any).__lore_scan = res;
      router.replace("/(auth)/discover");
    });
    return () => clearInterval(cycle);
  }, [pulse, router]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.1] });

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <Animated.View style={[styles.ring, { transform: [{ scale }], opacity }]} />
        <View style={styles.core} />
      </View>
      <Text style={styles.title}>Scanning your inbox…</Text>
      <Text style={styles.sub}>{SUBS[sub]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg, gap: 16 },
  center: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: C.teal },
  core: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.teal },
  title: { fontSize: 20, fontWeight: "600", color: C.ink, marginTop: 12 },
  sub: { fontSize: 15, color: C.muted },
});
