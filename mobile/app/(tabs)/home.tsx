import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { api } from "../../lib/api";
import { Episode } from "../../lib/types";
import { greeting, mmss } from "../../lib/format";
import { usePlayer } from "../../store/playerStore";
import EpisodeCard from "../../components/EpisodeCard";
import Avatar from "../../components/Avatar";

export default function Home() {
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const [feed, setFeed] = useState<Episode[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const real: Episode[] | undefined = (globalThis as any).__lore_episodes;
    if (real && real.length > 0) {
      setFeed(real);
      setLoaded(true);
    } else {
      api.getFeed().then((f) => {
        setFeed(f);
        setLoaded(true);
      });
    }
  }, []);

  const continueEp = feed.find(
    (e) => (e.playback_position_s ?? 0) > 0 && !e.is_completed
  );

  function openPlayer(ep: Episode) {
    play(ep);
    router.push("/player");
  }

  if (loaded && feed.length === 0) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <Empty onDiscover={() => router.push("/(auth)/scan")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <FlatList
        data={feed}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 6 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            {continueEp && (
              <View>
                <Text style={styles.section}>Continue Listening</Text>
                <ContinueCard ep={continueEp} onResume={() => openPlayer(continueEp)} />
              </View>
            )}
            <Text style={styles.section}>Latest Episodes</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            onPressBody={() => router.push(`/newsletter/${item.newsletter_id}`)}
            onPressPlay={() => {
              play(item);
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ContinueCard({ ep, onResume }: { ep: Episode; onResume: () => void }) {
  const progress = ep.audio_duration_s ? (ep.playback_position_s ?? 0) / ep.audio_duration_s : 0;
  return (
    <Pressable style={styles.continueCard} onPress={onResume}>
      <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={48} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.continueTitle} numberOfLines={1}>{ep.subject}</Text>
        <Text style={styles.continueMeta}>
          {mmss(ep.playback_position_s ?? 0)} / {mmss(ep.audio_duration_s)}
        </Text>
        <View style={styles.cTrack}>
          <View style={[styles.cFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <View style={styles.resume}>
        <Text style={styles.resumeIcon}>▶</Text>
      </View>
    </Pressable>
  );
}

function Empty({ onDiscover }: { onDiscover: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyArt}>📭</Text>
      <Text style={styles.emptyText}>Your feed is empty.</Text>
      <Text style={styles.emptySub}>Follow some newsletters to get started.</Text>
      <Pressable style={styles.emptyCta} onPress={onDiscover}>
        <Text style={styles.emptyCtaText}>Find newsletters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  greeting: { fontSize: 18, fontWeight: "500", color: C.ink },
  section: { fontSize: 13, fontWeight: "500", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  continueCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  continueTitle: { fontSize: 15, fontWeight: "500", color: C.ink },
  continueMeta: { fontSize: 12, color: C.muted, fontVariant: ["tabular-nums"] },
  cTrack: { height: 3, backgroundColor: C.border, borderRadius: 100, marginTop: 2 },
  cFill: { height: 3, backgroundColor: C.teal },
  resume: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  resumeIcon: { color: C.white, fontSize: 16, marginLeft: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  emptyArt: { fontSize: 48 },
  emptyText: { fontSize: 17, fontWeight: "500", color: C.ink },
  emptySub: { fontSize: 15, color: C.muted, textAlign: "center" },
  emptyCta: { marginTop: 12, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCtaText: { color: C.teal50, fontWeight: "600" },
});
