import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { FadeInUp, PressableScale } from "../../components/anim";
import { scanInbox } from "../../lib/gmail";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import { ensureAccessToken } from "../../lib/tokens";
import { fetchTrendingEpisodes } from "../../lib/discovery";
import { Episode } from "../../lib/types";
import EpisodeTile from "../../components/EpisodeTile";
import MiniPlayer from "../../components/MiniPlayer";

const STEPS = [
  "Checking the last 30 days",
  "Finding newsletters",
  "Filtering noise",
  "Almost there",
];

export default function Scan() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.accessToken);
  const play = usePlayer((s) => s.play);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [explore, setExplore] = useState<Episode[]>([]);
  // If the user starts listening while we scan, don't yank them away when the
  // scan finishes — show a "Continue" banner instead.
  const interacted = useRef(false);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Explore-while-you-wait: global catalog, playable right here via MiniPlayer.
  useEffect(() => {
    fetchTrendingEpisodes(8).then(setExplore).catch(() => {});
  }, []);

  useEffect(() => {
    if (!accessToken) {
      // Try a silent server-side refresh before demanding a re-consent.
      ensureAccessToken().then((t) => {
        if (!t) router.replace("/(auth)/gmail");
        // if a token arrived, the store update re-runs this effect with it
      });
      return;
    }

    // Coming back (e.g. from the player) with results already in hand? Show
    // the completion state instead of re-scanning.
    if ((globalThis as any).__lore_scan?.length) {
      setScanDone(true);
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
        setScanDone(true);
        // Only auto-advance if the user hasn't engaged with the catalog.
        if (!interacted.current) router.replace("/(auth)/select");
      })
      .catch((e) => {
        console.error(e);
        const detail = String(e?.message ?? e).slice(0, 120);
        setError(
          /gmail 40[13]/i.test(detail)
            ? "Google didn't grant Gmail access — reconnect and tick the Gmail checkbox on the consent screen."
            : `Scan failed: ${detail}`
        );
      });

    return () => clearInterval(cycle);
  }, [accessToken]);

  function playEpisode(ep: Episode) {
    interacted.current = true;
    play(ep); // MiniPlayer below picks it up — no navigation, scan continues
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeInUp style={styles.statusCol}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>✉</Text>
          </View>

          {error ? (
            <>
              <Text style={styles.title}>Something went wrong</Text>
              <Text style={styles.sub}>{error}</Text>
              <PressableScale
                style={styles.retry}
                to={0.95}
                onPress={() => router.replace("/(auth)/gmail")}
              >
                <Text style={styles.retryText}>Reconnect Gmail</Text>
              </PressableScale>
            </>
          ) : scanDone ? (
            <>
              <Text style={styles.title}>Scan complete</Text>
              <Text style={styles.sub}>
                We found {((globalThis as any).__lore_scan ?? []).length} newsletters in your inbox.
              </Text>
              <PressableScale
                style={styles.continueBtn}
                to={0.95}
                onPress={() => router.replace("/(auth)/select")}
              >
                <Text style={styles.continueText}>Pick your newsletters →</Text>
              </PressableScale>
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
        </FadeInUp>

        {/* Explore while you wait */}
        {!error && explore.length > 0 && (
          <View style={styles.exploreSection}>
            <FadeInUp delay={200}>
              <Text style={styles.exploreHeading}>Listen while you wait</Text>
              <Text style={styles.exploreSub}>
                Newsletters already converted on Lore — tap play, the scan keeps running.
              </Text>
            </FadeInUp>
            <View style={styles.tileGrid}>
              {explore.map((ep, i) => (
                <FadeInUp key={ep.id} delay={260 + Math.min(i, 8) * 60} style={styles.tileSlot}>
                  <EpisodeTile episode={ep} onPress={() => playEpisode(ep)} />
                </FadeInUp>
              ))}
            </View>
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Inline playback — stays on this screen while the scan runs */}
      <MiniPlayer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 28, maxWidth: 720, width: "100%", alignSelf: "center" },
  statusCol: { alignItems: "center", gap: 14 },

  iconWrap: {
    width: 64, height: 64, borderRadius: RADIUS.card,
    backgroundColor: C.indigo,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
    ...(SHADOW.glow(C.indigo) as object),
  },
  icon: { fontSize: 26, color: C.white },

  title: { fontSize: 25, fontFamily: SERIF, fontWeight: "700", color: C.ink, letterSpacing: -0.3, textAlign: "center" },
  sub: { fontSize: 14.5, color: C.muted, textAlign: "center" },

  dotsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.indigo },

  retry: {
    marginTop: 8, backgroundColor: C.coral, borderRadius: RADIUS.pill,
    paddingHorizontal: 24, paddingVertical: 12,
    ...(SHADOW.glow(C.coral) as object),
  },
  retryText: { color: C.white, fontWeight: "600" },

  continueBtn: {
    marginTop: 8, backgroundColor: C.teal, borderRadius: RADIUS.pill,
    paddingHorizontal: 26, paddingVertical: 14,
    ...(SHADOW.glow(C.teal) as object),
  },
  continueText: { color: C.white, fontWeight: "700", fontSize: 15 },

  exploreSection: { marginTop: 36, gap: 14 },
  exploreHeading: { fontSize: 20, fontWeight: "700", color: C.ink, fontFamily: SERIF },
  exploreSub: { fontSize: 13.5, color: C.muted, marginTop: 4 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tileSlot: { width: "47%", flexGrow: 1 },
});
