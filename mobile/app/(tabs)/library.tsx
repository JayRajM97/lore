import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { getEpisodes, getFollows } from "../../lib/db";
import { Episode, Newsletter } from "../../lib/types";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";
import EpisodeTile from "../../components/EpisodeTile";
import ViewToggle, { ViewMode } from "../../components/ViewToggle";
import { FadeInUp, PressableScale } from "../../components/anim";
import { CONTENT } from "../../lib/responsive";
import { getPref, setPref } from "../../lib/prefs";
import { withProgress, listenedOf } from "../../lib/progress";

const TABS = ["Episodes", "Listened", "Following"] as const;

export default function Library() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const play = usePlayer((s) => s.play);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Episodes");
  const [view, setView] = useState<ViewMode>(() => getPref("view_library", "cards") as ViewMode);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [follows, setFollows] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  function changeView(v: ViewMode) {
    setView(v);
    setPref("view_library", v);
  }

  useEffect(() => {
    if (!user) {
      // Fall back to whatever this session just generated.
      setEpisodes(withProgress(((globalThis as any).__lore_episodes ?? []) as Episode[]));
      setLoading(false);
      return;
    }
    Promise.all([getEpisodes(user.sub), getFollows(user.sub)])
      .then(([eps, fol]) => {
        // Prefer Firestore; if empty, show in-memory episodes from this session.
        setEpisodes(withProgress(eps.length ? eps : ((globalThis as any).__lore_episodes ?? []) as Episode[]));
        setFollows(fol);
      })
      .catch((e) => {
        console.error("library load failed", e);
        setEpisodes(withProgress(((globalThis as any).__lore_episodes ?? []) as Episode[]));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const listened = listenedOf(episodes);

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.column}>
      <Text style={styles.h1}>Library</Text>
      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t}
                {t === "Episodes" && episodes.length > 0 ? ` · ${episodes.length}` : ""}
                {t === "Listened" && listened.length > 0 ? ` · ${listened.length}` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab !== "Following" && <ViewToggle value={view} onChange={changeView} />}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
        </View>
      ) : tab === "Episodes" || tab === "Listened" ? (
        <FlatList
          data={tab === "Episodes" ? episodes : listened}
          key={`${tab}-${view}`}
          numColumns={view === "cards" ? 2 : 1}
          keyExtractor={(e) => e.id}
          columnWrapperStyle={view === "cards" ? { gap: 12 } : undefined}
          contentContainerStyle={{ padding: 16, gap: view === "cards" ? 12 : 10 }}
          ListEmptyComponent={
            tab === "Episodes" ? (
              <EmptyState
                text="No episodes yet"
                sub="Generate audio from your newsletters to see them here."
                cta="Find newsletters"
                onCta={() => router.push("/(auth)/scan")}
              />
            ) : (
              <EmptyState
                text="Nothing listened yet"
                sub="Episodes you play show up here so you can pick up where you left off."
              />
            )
          }
          renderItem={({ item, index }) =>
            view === "cards" ? (
              <FadeInUp delay={Math.min(index, 8) * 50} style={{ flex: 1 }}>
                <EpisodeTile episode={item} onPress={() => { play(item); router.push("/player"); }} />
              </FadeInUp>
            ) : (
              <FadeInUp delay={Math.min(index, 8) * 50}>
                <EpisodeCard
                  episode={item}
                  onPressBody={() => { play(item); router.push("/player"); }}
                  onPressPlay={() => { play(item); router.push("/player"); }}
                />
              </FadeInUp>
            )
          }
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
          renderItem={({ item, index }) => (
            <FadeInUp delay={Math.min(index, 8) * 50} style={{ flex: 1 }}>
              <View style={styles.gridCard}>
                <Avatar name={item.sender_name} url={item.sender_logo_url} size={56} />
                <Text style={styles.gridName} numberOfLines={1}>{item.sender_name}</Text>
                <Text style={styles.gridMeta}>{item.frequency}</Text>
              </View>
            </FadeInUp>
          )}
        />
      )}
      </View>
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
        <PressableScale style={styles.emptyCta} onPress={onCta}>
          <Text style={styles.emptyCtaText}>{cta}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  column: { flex: 1, width: "100%", maxWidth: CONTENT.feed, alignSelf: "center" },
  h1: { fontSize: 26, fontWeight: "700", color: C.ink, paddingHorizontal: 16, paddingTop: 8, letterSpacing: -0.3, fontFamily: SERIF },
  tabsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: C.surface },
  tabOn: { backgroundColor: C.teal50, ...(SHADOW.card as object) },
  tabText: { fontSize: 13, color: C.muted, fontWeight: "500" },
  tabTextOn: { color: C.teal, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  gridCard: { backgroundColor: C.white, borderRadius: RADIUS.card, padding: 16, alignItems: "center", gap: 6, ...(SHADOW.card as object) },
  gridName: { fontSize: 14, fontWeight: "500", color: C.ink, marginTop: 4 },
  gridMeta: { fontSize: 12, color: C.muted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8, marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "600", color: C.ink, fontFamily: SERIF },
  emptySub: { fontSize: 14, color: C.muted, textAlign: "center" },
  emptyCta: { marginTop: 12, backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCtaText: { color: C.white, fontWeight: "600" },
});
