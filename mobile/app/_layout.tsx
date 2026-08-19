import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { usePlayer } from "../store/playerStore";
import { useAuth } from "../store/authStore";
import { C } from "../lib/theme";

// Must be called on EVERY page load — including when Google redirects the OAuth
// popup back to localhost:8081. Placing it here (root layout) guarantees it runs
// before any screen renders, regardless of which route the redirect lands on.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const init = usePlayer((s) => s.init);
  const restore = useAuth((s) => s.restore);
  useEffect(() => {
    init();
    // Restore the session on EVERY entry path — deep links (widget taps open
    // lore://home) bypass the index splash, which used to be the only place
    // restore ran, making the app look signed-out.
    restore().catch(() => {});
  }, [init, restore]);

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
        {/* Full-screen push (not a sheet) — the player owns the whole screen
            and provides its own back button. */}
        <Stack.Screen name="player" options={{ presentation: "card", animation: "slide_from_right" }} />
        <Stack.Screen name="playground" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
