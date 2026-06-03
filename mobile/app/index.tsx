import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { C } from "../lib/theme";

export default function Splash() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // No session persistence yet → always go to onboarding.
    const t = setTimeout(() => router.replace("/(auth)/onboarding"), 1500);
    return () => clearTimeout(t);
  }, [fade, router]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ opacity: fade, alignItems: "center" }}>
        <Text style={styles.logo}>Lore</Text>
        <Text style={styles.tag}>newsletters, spoken aloud</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  logo: { fontSize: 40, fontWeight: "700", color: C.indigo, letterSpacing: -1 },
  tag: { marginTop: 8, fontSize: 14, color: C.muted },
});
