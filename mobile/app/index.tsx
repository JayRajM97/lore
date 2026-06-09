import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { C } from "../lib/theme";
import { useAuth } from "../store/authStore";

export default function Splash() {
  const router = useRouter();
  const restore = useAuth((s) => s.restore);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      const hasSession = restore(); // populates store from localStorage
      router.replace(hasSession ? "/home" : "/(auth)/onboarding");
    }, 800); // shorter splash — user already knows the app
    return () => clearTimeout(t);
  }, []);

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
