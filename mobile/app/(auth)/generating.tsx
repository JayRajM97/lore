import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Newsletter, Episode } from "../../lib/types";
import { fetchRecentEmails, FetchedEmail } from "../../lib/gmail";
import { synthesizeForEpisode } from "../../lib/tts";
import { saveEpisodes, getEpisodes } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { currentUid } from "../../lib/discovery";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Avatar from "../../components/Avatar";

type Stage = "queued" | "fetching" | "generating" | "done" | "failed";

interface Item {
  newsletter: Newsletter;
  stage: Stage;
  error?: string;
  wordCount?: number;
  genMs?: number;
  episodeCount?: number;
}

const MAX_W = 680;

export default function Generating() {
  const router = useRouter();
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const list: Newsletter[] = (globalThis as any).__lore_generating ?? [];

  const [items, setItems] = useState<Item[]>(
    () => list.map((nl) => ({ newsletter: nl, stage: "queued" as Stage }))
  );
  const [done, setDone] = useState(false);
  const ran = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  // Page-level fade for done → navigate transition
  const pageOpacity = useRef(new Animated.Value(1)).current;

  function patch(i: number, update: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...update } : it)));
  }

  useEffect(() => {
    if (ran.current || !list.length) return;
    ran.current = true;

    (async () => {
      const existingIds = new Set<string>();
      if (user) {
        try {
          const prior = await getEpisodes(user.sub);
          for (const e of prior) existingIds.add(e.id);
          for (const e of ((globalThis as any).__lore_episodes ?? []) as Episode[]) {
            existingIds.add(e.id);
          }
        } catch (e) {
          console.warn("dedup preload failed:", e);
        }
      }

      const episodes: Episode[] = [];
      for (let i = 0; i < list.length; i++) {
        const nl = list[i];

        if (!token) {
          patch(i, { stage: "failed", error: "Session expired — reconnect Gmail" });
          continue;
        }

        patch(i, { stage: "fetching" });
        let emailsData: FetchedEmail[] = [];
        try {
          emailsData = await fetchRecentEmails(nl, token, 2);
        } catch (e: any) {
          patch(i, { stage: "failed", error: e?.message ?? "Gmail fetch failed" });
          continue;
        }
        if (!emailsData.length) {
          patch(i, { stage: "failed", error: "No recent emails found" });
          continue;
        }

        patch(i, { stage: "generating" });
        let episodeCount = 0;
        let skipped = 0;
        let lastWordCount = 0;
        let lastGenMs = 0;
        let newsletterId: string | null = null;
        // Firebase Auth uid for global catalog attribution; falls back to the
        // Google sub if Firebase sign-in (fired at /gmail) hasn't resolved yet.
        const uid = currentUid() ?? user?.sub ?? "anonymous";
        for (const emailData of emailsData) {
          // Real dedup now happens server-side (one episode per sender per
          // calendar day, via Shared Audio Nodes) — this local check just
          // avoids a redundant network round-trip for episodes from this
          // session.
          let result;
          try {
            result = await synthesizeForEpisode({
              uid,
              senderEmail: nl.sender_email,
              senderName: nl.sender_name,
              senderLogoUrl: nl.sender_logo_url,
              frequency: nl.frequency,
              subject: emailData.subject,
              text: emailData.text,
              receivedAt: emailData.date,
            });
          } catch {
            continue;
          }
          const epId = result.episodeHash;
          newsletterId = result.newsletterId;
          if (existingIds.has(epId)) {
            skipped++;
            continue;
          }
          existingIds.add(epId);
          episodeCount++;
          lastWordCount = result.wordCount ?? 0;
          lastGenMs = result.generationTimeMs ?? 0;
          episodes.push({
            id: epId,
            newsletter_id: result.newsletterId,
            sender_name: nl.sender_name,
            sender_logo_url: nl.sender_logo_url,
            subject: result.subject,
            raw_text: emailData.text,
            audio_url: result.audioUrl,
            audio_duration_s: result.durationS,
            received_at: result.receivedAt,
            words: result.words,
            word_count: result.wordCount,
            generation_time_ms: result.generationTimeMs,
          });
          (globalThis as any).__lore_episodes = [
            ...(((globalThis as any).__lore_episodes ?? []) as Episode[]).filter(
              (e: Episode) => e.id !== epId
            ),
            ...episodes,
          ];
        }

        // Register this newsletter as "following" on the global catalog so it
        // shows up (with correct state) on the Discover tab. Non-blocking —
        // failure here shouldn't break the working per-user generation flow.
        if (newsletterId && uid !== "anonymous") {
          setDoc(doc(db, "users", uid), { following: arrayUnion(newsletterId) }, { merge: true }).catch(
            (e) => console.warn("[generating] following write failed:", e)
          );
        }

        if (episodeCount === 0 && skipped > 0) {
          patch(i, { stage: "done", episodeCount: 0, error: "Already in library" });
        } else if (episodeCount === 0) {
          patch(i, { stage: "failed", error: "TTS failed" });
        } else {
          patch(i, { stage: "done", wordCount: lastWordCount, genMs: lastGenMs, episodeCount });
        }

        Animated.timing(progress, {
          toValue: (i + 1) / list.length,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }

      if (user && episodes.length) {
        saveEpisodes(user.sub, episodes).catch((e) =>
          console.error("saveEpisodes failed", e)
        );
      }
      (globalThis as any).__lore_just_generated = true;
      setDone(true);
    })();
  }, []);

  // Auto-navigate after done with a smooth fade-out
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => {
        Animated.timing(pageOpacity, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => router.replace("/home"));
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [done]);

  function goBack() {
    router.canGoBack() ? router.back() : router.replace("/(auth)/discover");
  }

  function goHome() {
    router.replace("/home");
  }

  if (!list.length) return <Redirect href="/home" />;

  const doneCount = items.filter((it) => it.stage === "done").length;
  const activeItem = items.find(
    (it) => it.stage === "fetching" || it.stage === "generating"
  );
  const progressPct = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View style={[g.page, { opacity: pageOpacity }]}>
      <SafeAreaView style={g.safe} edges={["top", "bottom"]}>

        {/* ── Header ── */}
        <View style={g.header}>
          {/* Back button */}
          <Pressable onPress={goBack} style={g.backBtn} hitSlop={10}>
            <Text style={g.backIcon}>←</Text>
          </Pressable>

          {/* Logo */}
          <View style={g.headerCenter}>
            <View style={g.logoMark}>
              <Text style={g.logoMarkText}>L</Text>
            </View>
            <Text style={g.logoText}>Lore!</Text>
          </View>

          {/* Skip */}
          <Pressable onPress={goHome} style={g.skipBtn} hitSlop={10}>
            <Text style={g.skipText}>{done ? "Open →" : "Skip →"}</Text>
          </Pressable>
        </View>

        {/* ── Global progress bar (top edge) ── */}
        <View style={g.globalTrack}>
          <Animated.View style={[g.globalFill, { width: progressPct }]} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={g.scroll}>
          <View style={g.inner}>

            {/* ── Status banner ── */}
            <BannerCard done={done} doneCount={doneCount} total={list.length} activeItem={activeItem} />

            {/* ── Queue list ── */}
            <View style={g.queueSection}>
              <Text style={g.sectionLabel}>Queue</Text>
              <View style={g.qList}>
                {items.map((item, i) => (
                  <QueueRow key={item.newsletter.id} item={item} index={i} />
                ))}
              </View>
            </View>

            {/* ── Done results ── */}
            {done && doneCount > 0 && (
              <DoneSection items={items} />
            )}
          </View>
        </ScrollView>

        {/* ── Bottom CTA when done ── */}
        {done && (
          <DoneBar onPress={goHome} count={doneCount} />
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────
function BannerCard({
  done,
  doneCount,
  total,
  activeItem,
}: {
  done: boolean;
  doneCount: number;
  total: number;
  activeItem: Item | undefined;
}) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Pulse on done transition
  useEffect(() => {
    if (done) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.03,
          useNativeDriver: true,
          speed: 40,
          bounciness: 10,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }),
      ]).start();
    }
  }, [done]);

  return (
    <Animated.View
      style={[
        g.banner,
        done && g.bannerDone,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <View style={[g.bannerIconWrap, done && g.bannerIconWrapDone]}>
        {done ? (
          <Text style={g.bannerDoneIcon}>✓</Text>
        ) : (
          <ActivityIndicator color={C.indigo} size="small" />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={g.bannerTitle}>
          {done
            ? `${doneCount} episode${doneCount !== 1 ? "s" : ""} ready!`
            : activeItem
            ? `Converting ${activeItem.newsletter.sender_name}…`
            : "Generating audio"}
        </Text>
        <Text style={g.bannerSub}>
          {done ? "Taking you to your feed…" : `${doneCount} of ${total} done`}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Queue row ────────────────────────────────────────────────────────────────
function QueueRow({ item, index }: { item: Item; index: number }) {
  const { newsletter: nl, stage, error } = item;
  const isActive = stage === "fetching" || stage === "generating";
  const isDone = stage === "done";
  const isFailed = stage === "failed";

  // Entrance animation — staggered by index
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 360,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Highlight pulse when becoming active
  const highlightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(highlightAnim, { toValue: 0.7, duration: 600, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [isActive]);

  return (
    <Animated.View
      style={[
        g.qRow,
        isActive && g.qRowActive,
        isDone && g.qRowDone,
        isFailed && g.qRowFail,
        {
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={g.qName} numberOfLines={1}>{nl.sender_name}</Text>
        <Text
          style={[
            g.qStatus,
            isActive && g.qStatusActive,
            isDone && g.qStatusDone,
            isFailed && g.qStatusFail,
          ]}
        >
          {isActive
            ? stage === "fetching"
              ? "Fetching emails…"
              : "Converting to audio…"
            : isDone
            ? item.episodeCount === 0
              ? "Already in library"
              : `${item.episodeCount} episode${(item.episodeCount ?? 0) !== 1 ? "s" : ""} ready`
            : isFailed
            ? error ?? "Failed"
            : "Waiting in queue"}
        </Text>
      </View>
      <View
        style={[
          g.qBadge,
          isActive && g.qBadgeActive,
          isDone && g.qBadgeDone,
          isFailed && g.qBadgeFail,
        ]}
      >
        {isActive ? (
          <ActivityIndicator size="small" color={C.indigo} />
        ) : isDone ? (
          <Text style={g.qBadgeIcon}>✓</Text>
        ) : isFailed ? (
          <Text style={g.qBadgeIcon}>✕</Text>
        ) : (
          <Text style={g.qBadgeNum}>⏸</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Done section ─────────────────────────────────────────────────────────────
function DoneSection({ items }: { items: Item[] }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  }, []);

  const readyItems = items.filter(
    (it) => it.stage === "done" && (it.episodeCount ?? 0) > 0
  );
  if (!readyItems.length) return null;

  return (
    <Animated.View
      style={[
        g.doneSection,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      <Text style={g.sectionLabel}>Just Generated</Text>
      <View style={g.doneList}>
        {readyItems.map((it) => (
          <View key={it.newsletter.id} style={g.doneRow}>
            <Avatar
              name={it.newsletter.sender_name}
              url={it.newsletter.sender_logo_url}
              size={44}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={g.doneName} numberOfLines={1}>
                {it.newsletter.sender_name}
              </Text>
              <Text style={g.doneMeta}>
                {it.episodeCount} episode{(it.episodeCount ?? 0) !== 1 ? "s" : ""}
                {it.genMs ? ` · ${(it.genMs / 1000).toFixed(1)}s` : ""}
              </Text>
            </View>
            <View style={g.readyPill}>
              <Text style={g.readyPillText}>READY</Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Done bottom bar ──────────────────────────────────────────────────────────
function DoneBar({ onPress, count }: { onPress: () => void; count: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 16,
      bounciness: 8,
      delay: 200,
    }).start();
  }, []);

  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View
      style={[
        g.doneBar,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        style={g.doneBtn}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start()
        }
      >
        <Animated.View style={[g.doneBtnInner, { transform: [{ scale }] }]}>
          <Text style={g.doneBtnText}>
            Go to my feed →
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 24 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: C.border,
  },
  backIcon: { fontSize: 18, color: C.ink },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.indigo,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: { color: C.white, fontSize: 14, fontWeight: "800" },
  logoText: { fontSize: 17, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  skipText: { fontSize: 14, color: C.teal, fontWeight: "600" },

  // Global progress bar (top edge under header)
  globalTrack: {
    height: 3,
    backgroundColor: C.border,
    overflow: "hidden",
  },
  globalFill: {
    height: 3,
    backgroundColor: C.indigo,
  },

  // Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  bannerDone: { backgroundColor: C.teal50, borderColor: C.teal },
  bannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: C.border,
  },
  bannerIconWrapDone: { backgroundColor: C.teal, borderColor: C.teal },
  bannerDoneIcon: { fontSize: 20, color: C.white },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  bannerSub: { fontSize: 13, color: C.muted },

  sectionLabel: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  queueSection: {},
  qList: { gap: 8 },

  // Queue rows
  qRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  qRowActive: { borderColor: C.indigo, backgroundColor: "#F5F4FF" },
  qRowDone: { borderColor: C.teal, backgroundColor: C.teal50 },
  qRowFail: { borderColor: C.coral, backgroundColor: C.coral50 },
  qName: { fontSize: 15, fontWeight: "600", color: C.ink },
  qStatus: { fontSize: 12, color: C.muted },
  qStatusActive: { color: C.indigo },
  qStatusDone: { color: C.teal },
  qStatusFail: { color: C.coral },
  qBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: C.border,
    flexShrink: 0,
  },
  qBadgeActive: { borderColor: C.indigo },
  qBadgeDone: { backgroundColor: C.teal, borderColor: C.teal },
  qBadgeFail: { backgroundColor: C.coral, borderColor: C.coral },
  qBadgeIcon: { fontSize: 14, fontWeight: "700", color: C.white },
  qBadgeNum: { fontSize: 14, color: C.muted },

  // Done section
  doneSection: {},
  doneList: { gap: 8 },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 12,
  },
  doneName: { fontSize: 14, fontWeight: "600", color: C.ink },
  doneMeta: { fontSize: 12, color: C.muted },
  readyPill: {
    backgroundColor: C.teal50,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyPillText: { fontSize: 10, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },

  // Done bar
  doneBar: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 0.5,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  doneBtn: { borderRadius: 14, overflow: "hidden" },
  doneBtnInner: {
    backgroundColor: C.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.teal,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  doneBtnText: { color: C.white, fontWeight: "700", fontSize: 16 },
});
