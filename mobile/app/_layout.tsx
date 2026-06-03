import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { usePlayer } from "../store/playerStore";
import { C } from "../lib/theme";

export default function RootLayout() {
  const init = usePlayer((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: "modal" }} />
        <Stack.Screen name="newsletter/[id]" />
        <Stack.Screen name="playground" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
