import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Newsletter, Episode } from "../../lib/types";
import { fetchLatestEmail } from "../../lib/gmail";
import { synthesize } from "../../lib/tts";
import { saveEpisodes } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import Avatar from "../../components/Avatar";

type Stage = "queued" | "fetching" | "generating" | "done" | "failed";

interface Item {
  newsletter: Newsletter;
  stage: Stage;
  error?: string;
  wordCount?: number;
  genMs?: number;
}

const STAGE_LABEL: Record<Stage, string> = {
  queued: "Queued",
  fetching: "Fetching email…",
  generating: "Generating audio…",
  done: "Done",
  failed: "Failed",
};

const MAX_W = 640;

export default function Generating() {
  const router = useRouter();
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const list: Newsletter[] = (globalThis as any).__lore_generating ?? [];

  const [items, setItems] = useState<Item[]>(
    () => list.map((nl) => ({ newsletter: nl, stage: "queued" as Stage }))
  );
  const [showSkip, setShowSkip] = useState(false);
  const [done, setDone] = useState(false);
  const ran = useRef(false);

  function patch(i: number, update: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...update } : it)));
  }

  useEffect(() => {
    if (ran.current || !list.length) return;
    ran.current = true;

    const skipT = setTimeout(() => setShowSkip(true), 12000);

    (async () => {
      const episodes: Episode[] = [];

      for (let i = 0; i < list.length; i++) {
        const nl = list[i];

        // ── 1. fetch email body ──
        patch(i, { stage: "fetching" });
        let emailData: { subject: string; text: string } | null = null;
        try {
          emailData = token ? await fetchLatestEmail(nl, token) : null;
        } catch (e: any) {
          patch(i, { stage: "failed", error: e?.message ?? "Gmail fetch failed" });
          continue;
        }
        if (!emailData) {
          patch(i, { stage: "failed", error: "No recent email found" });
          continue;
        }

        // ── 2. TTS synthesis ──
        patch(i, { stage: "generating" });
        let tts;
        try {
          tts = await synthesize(emailData.text);
        } catch (e: any) {
          patch(i, { stage: "failed", error: e?.message ?? "TTS failed" });
          continue;
        }

        patch(i, { stage: "done", wordCount: tts.wordCount, genMs: tts.generationTimeMs });
        episodes.push({
          id: `${nl.id}-${Date.now()}`,
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
      }

      // Store episodes for the immediate home feed, and persist to Firestore so
      // they survive reload and show up in the Library (fire-and-forget).
      (globalThis as any).__lore_episodes = episodes;
      if (user && episodes.length) {
        saveEpisodes(user.sub, episodes).catch((e) =>
          console.error("saveEpisodes failed", e)
        );
      }
      clearTimeout(skipT);
      setDone(true);
    })();

    return () => clearTimeout(skipT);
  }, []);

  // Auto-advance when all done (or if nothing to do)
  useEffect(() => {
    if (!list.length) {
      router.replace("/home");
      return;
    }
    if (done) {
      const t = setTimeout(() => router.replace("/home"), 800);
      return () => clearTimeout(t);
    }
  }, [done]);

  const doneCount = items.filter((it) => it.stage === "done").length;
  const failCount = items.filter((it) => it.stage === "failed").length;
  const progress = list.length ? (doneCount + failCount) / list.length : 0;
  const minutes = Math.max(1, Math.round(list.length * 2));

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <View style={styles.headInner}>
          <Text style={styles.h1}>Generating your feed</Text>
          <Text style={styles.sub}>
            {done
              ? `${doneCount} episode${doneCount !== 1 ? "s" : ""} ready`
              : `~${minutes} min · ${doneCount}/${list.length} done`}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {items.map(({ newsletter: nl, stage, error, wordCount, genMs }) => (
            <View key={nl.id} style={styles.row}>
              <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{nl.sender_name}</Text>
                {error ? (
                  <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
                ) : stage === "done" ? (
                  <Text style={styles.statusDone}>
                    {wordCount ? `${wordCount} words` : "Done"}
                    {genMs ? `  ·  ${(genMs / 1000).toFixed(1)}s` : ""}
                  </Text>
                ) : (
                  <Text style={styles.status}>{STAGE_LABEL[stage]}</Text>
                )}
              </View>
              {stage === "fetching" || stage === "generating" ? (
                <Text style={styles.spinner}>⟳</Text>
              ) : stage === "done" ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : stage === "failed" ? (
                <Text style={styles.failMark}>✕</Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {showSkip && !done && (
        <Pressable style={styles.skip} onPress={() => router.replace("/home")}>
          <Text style={styles.skipText}>Skip for now →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { borderBottomWidth: 0.5, borderColor: C.border },
  headInner: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    padding: 20,
    gap: 6,
  },
  h1: { fontSize: 24, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 15, color: C.muted },
  track: { height: 6, backgroundColor: C.border, borderRadius: 100, marginTop: 8, overflow: "hidden" },
  fill: { height: 6, backgroundColor: C.teal, borderRadius: 100 },
  scroll: { paddingVertical: 12, paddingBottom: 80 },
  list: { width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 12,
  },
  name: { fontSize: 15, fontWeight: "500", color: C.ink },
  status: { fontSize: 13, color: C.muted, marginTop: 2 },
  statusDone: { color: C.teal },
  errorText: { fontSize: 13, color: C.coral, marginTop: 2 },
  spinner: { fontSize: 18, color: C.muted },
  checkmark: { fontSize: 16, color: C.teal, fontWeight: "700" },
  failMark: { fontSize: 16, color: C.coral },
  skip: { alignItems: "center", paddingVertical: 20 },
  skipText: { color: C.teal, fontSize: 15, fontWeight: "500" },
});
