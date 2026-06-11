import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { scanInbox } from "../../lib/gmail";
import { useAuth } from "../../store/authStore";

const STEPS = [
  "Checking the last 30 days",
  "Finding newsletters",
  "Filtering noise",
  "Almost there",
];

export default function Scan() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.accessToken);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!accessToken) {
      router.replace("/(auth)/gmail");
      return;
    }

    // Animate dots
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.delay(800 - delay),
        ])
      ).start();

    anim(dot1, 0);
    anim(dot2, 200);
    anim(dot3, 400);

    const cycle = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2200);

    scanInbox(accessToken)
      .then((res) => {
        (globalThis as any).__lore_scan = res;
        (globalThis as any).__lore_generating = null;
        router.replace("/(auth)/discover");
      })
      .catch((e) => {
        console.error(e);
        setError("Scan failed. Check your connection and try again.");
      });

    return () => clearInterval(cycle);
  }, [accessToken]);

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={styles.center}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✉</Text>
        </View>

        {error ? (
          <>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.sub}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => router.replace("/(auth)/gmail")}>
              <Text style={styles.retryText}>Reconnect Gmail</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Scanning your inbox</Text>
            <View style={styles.dotsRow}>
              {[dot1, dot2, dot3].map((d, i) => (
                <Animated.View
                  key={i}
                  style={[styles.dot, { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]}
                />
              ))}
            </View>
            <Text style={styles.sub}>{STEPS[step]}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 16 },

  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: C.indigo,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
    shadowColor: C.indigo, shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  icon: { fontSize: 30, color: C.white },

  title: { fontSize: 22, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 15, color: C.muted, textAlign: "center" },

  dotsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.indigo },

  retry: { marginTop: 8, backgroundColor: C.coral, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: C.white, fontWeight: "600" },
});
