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
        for (const emailData of emailsData) {
          const epId = `${nl.id}-${emailData.id}`;
          if (existingIds.has(epId)) {
            skipped++;
            continue;
          }
          let tts;
          try {
            tts = await synthesize(emailData.text);
          } catch {
            continue;
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

        // Animate progress bar
        Animated.timing(progress, {
          toValue: (i + 1) / list.length,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      }

      if (user && episodes.length) {
        saveEpisodes(user.sub, episodes).catch((e) => console.error("saveEpisodes failed", e));
      }
      (globalThis as any).__lore_just_generated = true;
      setDone(true);
    })();
  }, []);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => router.replace("/home"), 1400);
      return () => clearTimeout(t);
    }
  }, [done]);

  if (!list.length) return <Redirect href="/home" />;

  const doneCount = items.filter((it) => it.stage === "done").length;
  const failCount = items.filter((it) => it.stage === "failed").length;
  const activeItem = items.find((it) => it.stage === "fetching" || it.stage === "generating");
  const progressPct = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>L</Text>
          </View>
          <Text style={styles.logoText}>Lore!</Text>
        </View>
        <Pressable onPress={() => router.replace("/home")} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip →</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>

          {/* ── Status banner ── */}
          {done ? (
            <View style={[styles.banner, styles.bannerDone]}>
              <View style={styles.bannerIconWrap}>
                <Text style={styles.bannerDoneIcon}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {doneCount} episode{doneCount !== 1 ? "s" : ""} ready!
                </Text>
                <Text style={styles.bannerSub}>Taking you to your feed…</Text>
              </View>
            </View>
          ) : (
            <View style={styles.banner}>
              <View style={styles.bannerIconWrap}>
                <ActivityIndicator color={C.indigo} size="small" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {activeItem
                    ? `Converting ${activeItem.newsletter.sender_name}…`
                    : "Generating audio"}
                </Text>
                <Text style={styles.bannerSub}>
                  {doneCount} of {list.length} done
                </Text>
              </View>
            </View>
          )}

          {/* ── Progress bar ── */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressPct }]} />
            </View>
            <Text style={styles.progressLabel}>{doneCount}/{list.length}</Text>
          </View>

          {/* ── Queue list ── */}
          <View style={styles.queueSection}>
            <Text style={styles.sectionLabel}>Queue</Text>
            <View style={styles.qList}>
              {items.map((item, i) => (
                <QueueRow key={item.newsletter.id} item={item} />
              ))}
            </View>
          </View>

          {/* ── Done results ── */}
          {done && doneCount > 0 && (
            <View style={styles.doneSection}>
              <Text style={styles.sectionLabel}>Just Generated</Text>
              <View style={styles.doneList}>
                {items
                  .filter((it) => it.stage === "done" && (it.episodeCount ?? 0) > 0)
                  .map((it) => (
                    <View key={it.newsletter.id} style={styles.doneRow}>
                      <Avatar
                        name={it.newsletter.sender_name}
                        url={it.newsletter.sender_logo_url}
                        size={44}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.doneName} numberOfLines={1}>
                          {it.newsletter.sender_name}
                        </Text>
                        <Text style={styles.doneMeta}>
                          {it.episodeCount} episode{(it.episodeCount ?? 0) !== 1 ? "s" : ""}
                          {it.genMs ? ` · ${(it.genMs / 1000).toFixed(1)}s` : ""}
                        </Text>
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

      {/* ── Bottom CTA when done ── */}
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

function QueueRow({ item }: { item: Item }) {
  const { newsletter: nl, stage, error } = item;
  const isActive = stage === "fetching" || stage === "generating";
  const isDone = stage === "done";
  const isFailed = stage === "failed";

  return (
    <View style={[styles.qRow, isActive && styles.qRowActive, isDone && styles.qRowDone]}>
      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.qName} numberOfLines={1}>{nl.sender_name}</Text>
        <Text style={[
          styles.qStatus,
          isActive && styles.qStatusActive,
          isDone && styles.qStatusDone,
          isFailed && styles.qStatusFail,
        ]}>
          {isActive
            ? stage === "fetching" ? "Fetching emails…" : "Converting to audio…"
            : isDone
            ? item.episodeCount === 0 ? "Already in library" : `${item.episodeCount} episode${(item.episodeCount ?? 0) !== 1 ? "s" : ""} ready`
            : isFailed
            ? error ?? "Failed"
            : "Waiting in queue"}
        </Text>
      </View>
      <View style={[styles.qBadge,
        isActive && styles.qBadgeActive,
        isDone && styles.qBadgeDone,
        isFailed && styles.qBadgeFail,
      ]}>
        {isActive
          ? <ActivityIndicator size="small" color={C.indigo} />
          : isDone
          ? <Text style={styles.qBadgeIcon}>✓</Text>
          : isFailed
          ? <Text style={styles.qBadgeIcon}>✕</Text>
          : <Text style={styles.qBadgeNum}>⏸</Text>
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 24 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: C.border },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.indigo, alignItems: "center", justifyContent: "center" },
  logoMarkText: { color: C.white, fontSize: 14, fontWeight: "800" },
  logoText: { fontSize: 17, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { fontSize: 14, color: C.teal, fontWeight: "600" },

  banner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  bannerDone: { backgroundColor: C.teal50, borderColor: C.teal },
  bannerIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: C.border },
  bannerDoneIcon: { fontSize: 18, color: C.teal },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: C.ink },
  bannerSub: { fontSize: 13, color: C.muted, marginTop: 2 },

  progressWrap: { gap: 6 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: C.border, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: C.indigo },
  progressLabel: { fontSize: 12, color: C.muted, textAlign: "right" },

  sectionLabel: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  queueSection: {},
  qList: { gap: 8 },

  qRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  qRowActive: { borderColor: C.indigo, backgroundColor: "#F5F4FF" },
  qRowDone: { borderColor: C.teal, backgroundColor: C.teal50 },
  qName: { fontSize: 15, fontWeight: "600", color: C.ink },
  qStatus: { fontSize: 12, color: C.muted },
  qStatusActive: { color: C.indigo },
  qStatusDone: { color: C.teal },
  qStatusFail: { color: C.coral },

  qBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: C.border },
  qBadgeActive: { borderColor: C.indigo },
  qBadgeDone: { backgroundColor: C.teal, borderColor: C.teal },
  qBadgeFail: { backgroundColor: C.coral50, borderColor: C.coral },
  qBadgeIcon: { fontSize: 14, fontWeight: "700", color: C.white },
  qBadgeNum: { fontSize: 14, color: C.muted },

  doneSection: {},
  doneList: { gap: 8 },
  doneRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 0.5, borderColor: C.border, padding: 12,
  },
  doneName: { fontSize: 14, fontWeight: "600", color: C.ink },
  doneMeta: { fontSize: 12, color: C.muted },
  readyPill: { backgroundColor: C.teal50, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  readyPillText: { fontSize: 10, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },

  doneBar: { padding: 16, paddingBottom: 28, borderTopWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  doneBtn: { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: "center", shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  doneBtnText: { color: C.white, fontWeight: "700", fontSize: 16 },
});
