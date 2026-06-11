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
import { synthesize } from "../../lib/tts";
import { saveEpisodes, getEpisodes } from "../../lib/db";
import { useAuth } from "../../store/authStore";
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

// Animated shimmer skeleton block
function Skeleton({ width, height, style }: { width?: any; height: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View
      style={[
        { width: width ?? "100%", height, borderRadius: 8, backgroundColor: C.border, opacity },
        style,
      ]}
    />
  );
}

function QueueItem({ item, index }: { item: Item; index: number }) {
  const { newsletter: nl, stage, error } = item;
  const isActive = stage === "fetching" || stage === "generating";
  const isDone = stage === "done";
  const isFailed = stage === "failed";

  return (
    <View style={[styles.qItem, isActive && styles.qItemActive]}>
      <View style={styles.qThumb}>
        {isActive ? (
          <View style={styles.qSpinner}>
            <ActivityIndicator size="small" color={C.teal} />
          </View>
        ) : isDone ? (
          <View style={styles.qDone}>
            <Text style={styles.qDoneIcon}>✓</Text>
          </View>
        ) : isFailed ? (
          <View style={styles.qFail}>
            <Text style={styles.qFailIcon}>✕</Text>
          </View>
        ) : (
          <View style={styles.qQueue}>
            <Text style={styles.qQueueIcon}>⏸</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.qLabel} numberOfLines={1}>
          {isActive
            ? stage === "fetching"
              ? "Fetching emails..."
              : "Converting..."
            : isDone
            ? item.episodeCount && item.episodeCount > 1
              ? `${item.episodeCount} episodes ready`
              : "Ready"
            : isFailed
            ? error ?? "Failed"
            : "Waiting in queue"}
        </Text>
        <Text style={styles.qName} numberOfLines={1}>{nl.sender_name}</Text>
      </View>
    </View>
  );
}

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

  function patch(i: number, update: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...update } : it)));
  }

  useEffect(() => {
    if (ran.current || !list.length) return;
    ran.current = true;

    (async () => {
      // Dedup: load ids of episodes already generated for this user so we never
      // re-synthesize the same Gmail message. Episode id is deterministic:
      // `${newsletterId}-${gmailMessageId}`.
      const existingIds = new Set<string>();
      if (user) {
        try {
          const prior = await getEpisodes(user.sub);
          for (const e of prior) existingIds.add(e.id);
          for (const e of ((globalThis as any).__lore_episodes ?? []) as Episode[]) {
            existingIds.add(e.id);
          }
        } catch (e) {
          console.warn("dedup preload failed (will generate without dedup):", e);
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
        for (const emailData of emailsData) {
          const epId = `${nl.id}-${emailData.id}`;
          // Already have this exact email as an episode — skip regeneration.
          if (existingIds.has(epId)) {
            skipped++;
            continue;
          }

          let tts;
          try {
            tts = await synthesize(emailData.text);
          } catch {
            continue; // skip one failed email, try the rest
          }
          existingIds.add(epId);
          episodeCount++;
          lastWordCount = tts.wordCount;
          lastGenMs = tts.generationTimeMs;
          episodes.push({
            id: epId,
            newsletter_id: nl.id,
            sender_name: nl.sender_name,
            sender_logo_url: nl.sender_logo_url,
            subject: emailData.subject,
            raw_text: emailData.text,
            audio_url: tts.audioUrl,
            audio_duration_s: tts.durationS,
            received_at: nl.last_received_at,
            words: tts.words,
            word_count: tts.wordCount,
            generation_time_ms: tts.generationTimeMs,
          });
          // Expose episodes incrementally so Library screen sees them live
          (globalThis as any).__lore_episodes = [
            ...(((globalThis as any).__lore_episodes ?? []) as Episode[]).filter(
              (e: Episode) => e.id !== epId
            ),
            ...episodes,
          ];
        }

        if (episodeCount === 0 && skipped > 0) {
          patch(i, { stage: "done", episodeCount: 0, error: "Already in library" });
        } else if (episodeCount === 0) {
          patch(i, { stage: "failed", error: "TTS failed" });
        } else {
          patch(i, { stage: "done", wordCount: lastWordCount, genMs: lastGenMs, episodeCount });
        }
      }

      if (user && episodes.length) {
        saveEpisodes(user.sub, episodes).catch((e) => {
          console.error("saveEpisodes failed", e);
        });
      }
      setDone(true);
    })();
  }, []);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.replace("/home"), 1200);
      return () => clearTimeout(t);
    }
  }, [done]);

  if (!list.length) return <Redirect href="/home" />;

  const doneCount = items.filter((it) => it.stage === "done").length;
  const failCount = items.filter((it) => it.stage === "failed").length;
  const activeItem = items.find(
    (it) => it.stage === "fetching" || it.stage === "generating"
  );
  const processingCount = items.filter(
    (it) => it.stage === "queued" || it.stage === "fetching" || it.stage === "generating"
  ).length;

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inner}>
          {/* ── Generating banner ── */}
          {!done ? (
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <ActivityIndicator color={C.teal} size="small" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Generating Audio</Text>
                <Text style={styles.bannerSub}>
                  Processing {list.length} newsletter
                  {list.length !== 1 ? "s" : ""} into premium audio.
                  They'll appear in your feed when ready.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.banner, styles.bannerDone]}>
              <Text style={styles.bannerDoneIcon}>✓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {doneCount} episode{doneCount !== 1 ? "s" : ""} ready!
                </Text>
                <Text style={styles.bannerSub}>Taking you to your feed…</Text>
              </View>
            </View>
          )}

          {/* Always-visible escape to Library */}
          <Pressable onPress={() => router.replace("/home")} style={styles.goLibrary}>
            <Text style={styles.goLibraryText}>Continue to Library →</Text>
          </Pressable>

          {/* ── Two-column layout ── */}
          <View style={styles.cols}>
            {/* Left: skeleton incoming content */}
            <View style={styles.leftCol}>
              <Text style={styles.sectionLabel}>Incoming Content</Text>
              <View style={styles.skeletonCards}>
                {list.slice(0, 4).map((nl, i) => {
                  const item = items[i];
                  const isReady = item?.stage === "done";
                  return (
                    <View key={nl.id} style={styles.skeletonCard}>
                      {isReady ? (
                        <View style={styles.skeletonReadyBadge}>
                          <Text style={styles.skeletonReadyText}>READY</Text>
                        </View>
                      ) : null}
                      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={40} />
                      <View style={{ gap: 6, flex: 1 }}>
                        {isReady ? (
                          <>
                            <Text style={styles.skeletonName} numberOfLines={1}>
                              {nl.sender_name}
                            </Text>
                            <Text style={styles.skeletonReady}>Audio ready</Text>
                          </>
                        ) : (
                          <>
                            <Skeleton height={10} width="70%" />
                            <Skeleton height={8} width="45%" />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Right: queue */}
            <View style={styles.rightCol}>
              <View style={styles.queueHeader}>
                <Text style={styles.sectionLabel}>Queue</Text>
                {processingCount > 0 && (
                  <View style={styles.queueBadge}>
                    <Text style={styles.queueBadgeText}>
                      {processingCount} Processing
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.qList}>
                {items.map((item, i) => (
                  <QueueItem key={item.newsletter.id} item={item} index={i} />
                ))}
              </View>
            </View>
          </View>

          {/* ── Recently played placeholder ── */}
          {done && doneCount > 0 && (
            <View>
              <Text style={styles.sectionLabel}>Just Generated</Text>
              <View style={styles.recentList}>
                {items
                  .filter((it) => it.stage === "done")
                  .map((it) => (
                    <View key={it.newsletter.id} style={styles.recentRow}>
                      <Avatar
                        name={it.newsletter.sender_name}
                        url={it.newsletter.sender_logo_url}
                        size={44}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.recentName} numberOfLines={1}>
                          {it.newsletter.sender_name}
                        </Text>
                        {it.wordCount ? (
                          <Text style={styles.recentMeta}>
                            {it.wordCount} words ·{" "}
                            {it.genMs
                              ? `${(it.genMs / 1000).toFixed(1)}s to generate`
                              : ""}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.readyPill}>
                        <Text style={styles.readyPillText}>READY</Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {done && (
        <View style={styles.doneBar}>
          <Pressable style={styles.doneBtn} onPress={() => router.replace("/home")}>
            <Text style={styles.doneBtnText}>Go to my feed →</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 20 },

  // banner
  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.surface, borderRadius: 14,
    padding: 16, borderWidth: 0.5, borderColor: C.border,
  },
  bannerDone: { backgroundColor: C.teal50, borderColor: C.teal },
  bannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.teal50, alignItems: "center", justifyContent: "center",
  },
  bannerDoneIcon: { fontSize: 20, color: C.teal, width: 36, textAlign: "center" },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  bannerSub: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },

  goLibrary: { alignSelf: "flex-end" },
  goLibraryText: { fontSize: 13, color: C.teal, fontWeight: "600" },

  // two columns
  cols: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  leftCol: { flex: 1.2, gap: 10 },
  rightCol: { flex: 1, gap: 8 },
  sectionLabel: { fontSize: 16, fontWeight: "700", color: C.ink },

  // skeleton cards
  skeletonCards: { gap: 10 },
  skeletonCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border, padding: 12,
    position: "relative",
  },
  skeletonReadyBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: C.teal50, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  skeletonReadyText: { fontSize: 9, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },
  skeletonName: { fontSize: 13, fontWeight: "600", color: C.ink },
  skeletonReady: { fontSize: 12, color: C.teal },

  // queue
  queueHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  queueBadge: {
    backgroundColor: C.teal, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3,
  },
  queueBadgeText: { fontSize: 11, fontWeight: "700", color: C.white },
  qList: { gap: 6 },
  qItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.white, borderRadius: 10,
    borderWidth: 0.5, borderColor: C.border, padding: 10,
  },
  qItemActive: { borderColor: C.teal, backgroundColor: C.teal50 },
  qThumb: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  qSpinner: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  qDone: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.teal, alignItems: "center", justifyContent: "center",
  },
  qDoneIcon: { color: C.white, fontWeight: "700", fontSize: 14 },
  qFail: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.coral50, alignItems: "center", justifyContent: "center",
  },
  qFailIcon: { color: C.coral, fontWeight: "700", fontSize: 14 },
  qQueue: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  qQueueIcon: { color: C.muted, fontSize: 14 },
  qLabel: { fontSize: 11, color: C.muted },
  qName: { fontSize: 13, fontWeight: "500", color: C.ink },

  // recently generated
  recentList: { marginTop: 8, gap: 8 },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border, padding: 12,
  },
  recentName: { fontSize: 14, fontWeight: "500", color: C.ink },
  recentMeta: { fontSize: 12, color: C.muted },
  readyPill: {
    backgroundColor: C.teal50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  readyPillText: { fontSize: 10, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },

  // done bar
  doneBar: {
    padding: 16, paddingBottom: 28, borderTopWidth: 0.5, borderColor: C.border,
    backgroundColor: C.bg,
  },
  doneBtn: {
    backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: "center",
  },
  doneBtnText: { color: C.white, fontWeight: "700", fontSize: 16 },
});
