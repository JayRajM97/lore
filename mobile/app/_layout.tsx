import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { usePlayer } from "../store/playerStore";
import { C } from "../lib/theme";

// Must be called on EVERY page load — including when Google redirects the OAuth
// popup back to localhost:8081. Placing it here (root layout) guarantees it runs
// before any screen renders, regardless of which route the redirect lands on.
WebBrowser.maybeCompleteAuthSession();

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
