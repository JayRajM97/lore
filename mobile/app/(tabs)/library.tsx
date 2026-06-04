import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { getEpisodes, getFollows } from "../../lib/db";
import { Episode, Newsletter } from "../../lib/types";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";

const TABS = ["Episodes", "Following"] as const;

export default function Library() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const play = usePlayer((s) => s.play);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Episodes");

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [follows, setFollows] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Fall back to whatever this session just generated.
      setEpisodes((globalThis as any).__lore_episodes ?? []);
      setLoading(false);
      return;
    }
    Promise.all([getEpisodes(user.sub), getFollows(user.sub)])
      .then(([eps, fol]) => {
        // Prefer Firestore; if empty, show in-memory episodes from this session.
        setEpisodes(eps.length ? eps : (globalThis as any).__lore_episodes ?? []);
        setFollows(fol);
      })
      .catch((e) => {
        console.error("library load failed", e);
        setEpisodes((globalThis as any).__lore_episodes ?? []);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <Text style={styles.h1}>Library</Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t}
              {t === "Episodes" && episodes.length > 0 ? ` · ${episodes.length}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
        </View>
      ) : tab === "Episodes" ? (
        <FlatList
          data={episodes}
          key="episodes"
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <EmptyState
              text="No episodes yet"
              sub="Generate audio from your newsletters to see them here."
              cta="Find newsletters"
              onCta={() => router.push("/(auth)/scan")}
            />
          }
          renderItem={({ item }) => (
            <EpisodeCard
              episode={item}
              onPressBody={() => play(item)}
              onPressPlay={() => play(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={follows}
          key="grid"
          numColumns={2}
          keyExtractor={(n) => n.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<EmptyState text="Not following anyone yet" sub="Follow newsletters to see them here." />}
          renderItem={({ item }) => (
            <View style={styles.gridCard}>
              <Avatar name={item.sender_name} url={item.sender_logo_url} size={56} />
              <Text style={styles.gridName} numberOfLines={1}>{item.sender_name}</Text>
              <Text style={styles.gridMeta}>{item.frequency}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({
  text,
  sub,
  cta,
  onCta,
}: {
  text: string;
  sub?: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
      {sub && <Text style={styles.emptySub}>{sub}</Text>}
      {cta && onCta && (
        <Pressable style={styles.emptyCta} onPress={onCta}>
          <Text style={styles.emptyCtaText}>{cta}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { fontSize: 24, fontWeight: "700", color: C.ink, paddingHorizontal: 16, paddingTop: 8, letterSpacing: -0.3 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: C.surface },
  tabOn: { backgroundColor: C.teal50 },
  tabText: { fontSize: 13, color: C.muted, fontWeight: "500" },
  tabTextOn: { color: C.teal },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridCard: { flex: 1, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 16, alignItems: "center", gap: 6 },
  gridName: { fontSize: 14, fontWeight: "500", color: C.ink, marginTop: 4 },
  gridMeta: { fontSize: 12, color: C.muted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8, marginTop: 80 },
  emptyText: { fontSize: 17, fontWeight: "600", color: C.ink },
  emptySub: { fontSize: 14, color: C.muted, textAlign: "center" },
  emptyCta: { marginTop: 12, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCtaText: { color: C.white, fontWeight: "600" },
});
