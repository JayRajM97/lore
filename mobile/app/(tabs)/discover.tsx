import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  followCatalogNewsletter,
  unfollowNewsletter,
  feedEpisodeHashesFor,
} from "../../lib/discovery";
import SectionRow from "../../components/SectionRow";
import DiscoverCard from "../../components/DiscoverCard";
import { FadeInUp } from "../../components/anim";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<GlobalNewsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

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

  // Optimistically flip follow state + count, then reconcile on failure.
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

  const popular = useMemo(() => sortPopular(items).slice(0, 10), [items]);
  const trending = useMemo(() => sortTrending(items).slice(0, 10), [items]);
  const fresh = useMemo(() => sortNew(items).slice(0, 10), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = sortPopular(items);
    return q ? all.filter((n) => n.sender_name.toLowerCase().includes(q)) : all;
  }, [items, query]);

  const cardProps = (n: GlobalNewsletter) => ({
    newsletter: n,
    onPress: () => router.push(`/newsletter/${n.sender_hash}`),
    onFollow: () => onFollow(n),
    onUnfollow: () => onUnfollow(n),
  });

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={C.teal} />
      </View>
    );
  }

  const empty = items.length === 0;

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.teal} />
      }
    >
      <Text style={styles.h1}>Discover</Text>

      {empty ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No newsletters yet</Text>
          <Text style={styles.emptyBody}>
            Be the first — follow newsletters from your Gmail scan and they’ll appear here for
            everyone, with audio ready to play.
          </Text>
        </View>
      ) : (
        <>
          {popular.length > 0 && (
            <SectionRow title="Popular on Lore">
              {popular.map((n) => (
                <DiscoverCard key={n.sender_hash} variant="tile" {...cardProps(n)} />
              ))}
            </SectionRow>
          )}
          {trending.length > 0 && (
            <SectionRow title="Trending this week">
              {trending.map((n) => (
                <DiscoverCard key={n.sender_hash} variant="tile" {...cardProps(n)} />
              ))}
            </SectionRow>
          )}
          {fresh.length > 0 && (
            <SectionRow title="New to Lore">
              {fresh.map((n) => (
                <DiscoverCard key={n.sender_hash} variant="tile" {...cardProps(n)} />
              ))}
            </SectionRow>
          )}

          <View style={styles.allSection}>
            <Text style={styles.sectionTitle}>All Newsletters</Text>
            <TextInput
              style={styles.search}
              placeholder="Search newsletters"
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <View style={styles.list}>
              {filtered.map((n, i) => (
                <FadeInUp key={n.sender_hash} delay={Math.min(i, 8) * 60}>
                  <DiscoverCard variant="row" {...cardProps(n)} />
                </FadeInUp>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center" },
  content: { paddingVertical: 16, gap: 20, paddingBottom: 120, width: "100%", maxWidth: 900, alignSelf: "center" },
  h1: { fontSize: 24, fontWeight: "600", color: C.ink, paddingHorizontal: 16, fontFamily: SERIF },
  allSection: { gap: 12, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: C.ink, fontFamily: SERIF },
  search: {
    backgroundColor: C.white,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: C.ink,
    ...(SHADOW.card as object),
  },
  list: { gap: 10 },
  emptyBox: { marginHorizontal: 16, padding: 20, backgroundColor: C.surface, borderRadius: RADIUS.card, gap: 8, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: C.ink },
  emptyBody: { fontSize: 14, color: C.muted, lineHeight: 20, textAlign: "center" },
});
