import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { GlobalNewsletter } from "../../lib/types";
import {
  currentUid,
  fetchCatalog,
  getFollowing,
  sortPopular,
  sortTrending,
  sortNew,
  sortMostEpisodes,
  followCatalogNewsletter,
  unfollowNewsletter,
  feedEpisodeHashesFor,
  topicOf,
  TOPICS,
  Topic,
} from "../../lib/discovery";
import { useAuth } from "../../store/authStore";
import DiscoverCard from "../../components/DiscoverCard";
import { FadeInUp, PressableScale } from "../../components/anim";

// Discover v2: topic chips + four titled grids (Popular / Trending / New /
// Binge-worthy) + one search across everything. Searching for something we
// don't have explains how to get it onto Lore.
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState<GlobalNewsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);

  const load = useCallback(async () => {
    const uid = currentUid();
    try {
      const following = uid ? await getFollowing(uid) : [];
      const catalog = await fetchCatalog(following);
      setItems(catalog);
    } catch (e) {
      console.warn("[discover] load failed:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setLocal = (id: string, patch: Partial<GlobalNewsletter>) =>
    setItems((prev) => prev.map((n) => (n.sender_hash === id ? { ...n, ...patch } : n)));

  const onFollow = async (n: GlobalNewsletter) => {
    const uid = currentUid();
    if (!uid) throw new Error("Not signed in");
    setLocal(n.sender_hash, { is_following: true, follower_count: (n.follower_count ?? 0) + 1 });
    try {
      await followCatalogNewsletter(uid, n.sender_hash);
    } catch (e) {
      setLocal(n.sender_hash, { is_following: false, follower_count: n.follower_count });
      throw e;
    }
  };

  const onUnfollow = async (n: GlobalNewsletter) => {
    const uid = currentUid();
    if (!uid) throw new Error("Not signed in");
    setLocal(n.sender_hash, { is_following: false, follower_count: Math.max(0, (n.follower_count ?? 1) - 1) });
    try {
      const hashes = await feedEpisodeHashesFor(uid, n.sender_hash);
      await unfollowNewsletter(uid, n.sender_hash, hashes);
    } catch (e) {
      setLocal(n.sender_hash, { is_following: true, follower_count: n.follower_count });
      throw e;
    }
  };

  const cardProps = (n: GlobalNewsletter) => ({
    newsletter: n,
    onPress: () => router.push(`/newsletter/${n.sender_hash}`),
    onFollow: () => onFollow(n),
    onUnfollow: () => onUnfollow(n),
  });

  // Chip filter applies everywhere; search overrides section view.
  const byTopic = useMemo(
    () => (topic ? items.filter((n) => topicOf(n) === topic) : items),
    [items, topic]
  );
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const results = useMemo(
    () => (searching ? sortPopular(byTopic).filter((n) => n.sender_name.toLowerCase().includes(q) || n.sender_email.toLowerCase().includes(q)) : []),
    [byTopic, q, searching]
  );

  const sections = useMemo(
    () => [
      { title: "Popular on Lore", data: sortPopular(byTopic).slice(0, 4) },
      { title: "Trending this week", data: sortTrending(byTopic).slice(0, 4) },
      { title: "New to Lore", data: sortNew(byTopic).slice(0, 4) },
      { title: "Binge-worthy", data: sortMostEpisodes(byTopic).filter((n) => (n.episode_count ?? 0) > 1).slice(0, 4) },
    ],
    [byTopic]
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  function goGetIt() {
    router.push(user ? "/(auth)/scan" : "/(auth)/gmail");
  }

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} />
      }
    >
      <Text style={styles.h1}>Discover</Text>

      {/* Search everything */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.search}
          placeholder="Search all newsletters…"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {searching && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Topic chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={topic === null} onPress={() => setTopic(null)} />
        {TOPICS.map((t) => (
          <Chip key={t} label={t} active={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
        ))}
      </ScrollView>

      {searching ? (
        results.length > 0 ? (
          <View style={styles.grid}>
            {results.map((n, i) => (
              <FadeInUp key={n.sender_hash} delay={Math.min(i, 8) * 40} style={styles.slot}>
                <DiscoverCard variant="row" {...cardProps(n)} />
              </FadeInUp>
            ))}
          </View>
        ) : (
          <FadeInUp style={styles.missing}>
            <Text style={styles.missingTitle}>"{query.trim()}" isn't on Lore yet</Text>
            <Text style={styles.missingBody}>
              Lore converts any newsletter that lands in your inbox. Subscribe to it
              with your Gmail address, then sync — we'll fetch it and turn it into
              audio automatically.
            </Text>
            <PressableScale style={styles.missingBtn} to={0.95} onPress={goGetIt}>
              <Text style={styles.missingBtnTxt}>{user ? "Scan my inbox" : "Connect Gmail"}</Text>
            </PressableScale>
          </FadeInUp>
        )
      ) : byTopic.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Be the first — follow newsletters from your Gmail scan and they'll appear
            here for everyone, with audio ready to play.
          </Text>
        </View>
      ) : (
        sections
          .filter((s) => s.data.length > 0)
          .map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.grid}>
                {section.data.map((n, i) => (
                  <FadeInUp key={n.sender_hash} delay={Math.min(i, 8) * 40} style={styles.slot}>
                    <DiscoverCard variant="row" {...cardProps(n)} />
                  </FadeInUp>
                ))}
              </View>
            </View>
          ))
      )}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  content: { paddingVertical: 16, gap: 16, paddingBottom: 120, width: "100%", maxWidth: 900, alignSelf: "center", paddingHorizontal: 16 },
  h1: { fontSize: 26, fontWeight: "700", color: C.ink, fontFamily: SERIF },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.white, borderRadius: RADIUS.pill,
    paddingHorizontal: 16, height: 46,
    ...(SHADOW.card as object),
  },
  searchIcon: { fontSize: 17, color: C.muted },
  search: { flex: 1, fontSize: 15, color: C.ink },
  clear: { fontSize: 14, color: C.muted, paddingHorizontal: 4 },

  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.pill, backgroundColor: C.surface,
  },
  chipOn: { backgroundColor: C.teal },
  chipTxt: { fontSize: 13, fontWeight: "600", color: C.muted },
  chipTxtOn: { color: C.white },

  section: { gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: C.ink, fontFamily: SERIF },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  slot: { width: "47%", flexGrow: 1, minWidth: 240 },

  missing: {
    backgroundColor: C.white, borderRadius: RADIUS.card, padding: 22, gap: 10,
    alignItems: "center", marginTop: 8,
    ...(SHADOW.card as object),
  },
  missingTitle: { fontSize: 18, fontWeight: "700", color: C.ink, fontFamily: SERIF, textAlign: "center" },
  missingBody: { fontSize: 14, color: C.muted, lineHeight: 21, textAlign: "center" },
  missingBtn: {
    marginTop: 6, backgroundColor: C.teal, borderRadius: RADIUS.pill,
    paddingHorizontal: 24, paddingVertical: 13,
    ...(SHADOW.glow(C.teal) as object),
  },
  missingBtnTxt: { color: C.white, fontWeight: "700", fontSize: 14.5 },

  emptyBox: { padding: 20, backgroundColor: C.surface, borderRadius: RADIUS.card, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.ink },
  emptyBody: { fontSize: 14, color: C.muted, lineHeight: 20 },
});
