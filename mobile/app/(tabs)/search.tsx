import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Episode, Newsletter } from "../../lib/types";
import { getEpisodes, getFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";

const MAX_W = 680;

export default function Discover() {
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState("");
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [allFollows, setAllFollows] = useState<Newsletter[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session: Episode[] = (globalThis as any).__lore_episodes ?? [];
    const load = async () => {
      if (session.length) {
        setAllEpisodes(session);
      } else if (user) {
        const eps = await getEpisodes(user.sub).catch(() => [] as Episode[]);
        setAllEpisodes(eps);
      }
      if (user) {
        const follows = await getFollows(user.sub).catch(() => [] as Newsletter[]);
        setAllFollows(follows);
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  const filteredNewsletters = useMemo(
    () =>
      q
        ? allFollows.filter((n) =>
            n.sender_name.toLowerCase().includes(q.toLowerCase()) ||
            n.sender_email.toLowerCase().includes(q.toLowerCase())
          )
        : [],
    [q, allFollows]
  );

  const filteredEpisodes = useMemo(
    () =>
      q
        ? allEpisodes.filter(
            (e) =>
              e.subject.toLowerCase().includes(q.toLowerCase()) ||
              e.sender_name.toLowerCase().includes(q.toLowerCase())
          )
        : [],
    [q, allEpisodes]
  );

  function openPlayer(ep: Episode) {
    play(ep);
    router.push("/player");
  }

  const isSearching = q.length > 0;

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search newsletters or episodes…"
            placeholderTextColor={C.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isSearching ? (
        /* ── Search results ── */
        <FlatList
          data={filteredEpisodes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10, maxWidth: MAX_W, alignSelf: "center", width: "100%" }}
          ListHeaderComponent={
            <>
              {filteredNewsletters.length > 0 && (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <Text style={styles.sectionLabel}>NEWSLETTERS</Text>
                  {filteredNewsletters.map((n) => (
                    <NlRow key={n.id} nl={n} onPress={() => {}} />
                  ))}
                </View>
              )}
              {filteredEpisodes.length > 0 && (
                <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>EPISODES</Text>
              )}
            </>
          }
          renderItem={({ item }) => (
            <EpisodeCard
              episode={item}
              onPressBody={() => openPlayer(item)}
              onPressPlay={() => openPlayer(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyCenter}>
              <Text style={styles.emptyText}>No results for "{q}"</Text>
            </View>
          }
        />
      ) : (
        /* ── Discovery mode ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.inner}>
            {/* My newsletters */}
            {allFollows.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionHeading}>My Newsletters</Text>
                  <Text style={styles.sectionCount}>{allFollows.length}</Text>
                </View>
                <View style={styles.nlList}>
                  {allFollows.map((nl) => (
                    <NlRow
                      key={nl.id}
                      nl={nl}
                      onPress={() => {}}
                      showEpisodeCount
                    />
                  ))}
                </View>
                <Pressable style={styles.addMoreBtn} onPress={() => router.push("/(auth)/scan")}>
                  <Text style={styles.addMoreText}>+ Scan for more newsletters</Text>
                </Pressable>
              </View>
            )}

            {/* Empty state */}
            {loaded && allFollows.length === 0 && (
              <View style={styles.emptyCenter}>
                <View style={styles.emptyIconWrap}>
                  <Text style={styles.emptyIcon}>◎</Text>
                </View>
                <Text style={styles.emptyHeading}>Discover newsletters</Text>
                <Text style={styles.emptySubtext}>
                  Connect Gmail to scan your inbox for newsletter subscriptions.
                </Text>
                <Pressable style={styles.connectBtn} onPress={() => router.push("/(auth)/gmail")}>
                  <Text style={styles.connectBtnText}>Connect Gmail</Text>
                </Pressable>
              </View>
            )}

            {/* Recently played */}
            {allEpisodes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Recent Episodes</Text>
                <View style={{ gap: 8 }}>
                  {allEpisodes.slice(0, 5).map((ep) => (
                    <EpisodeCard
                      key={ep.id}
                      episode={ep}
                      onPressBody={() => openPlayer(ep)}
                      onPressPlay={() => openPlayer(ep)}
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NlRow({
  nl,
  onPress,
  showEpisodeCount,
}: {
  nl: Newsletter;
  onPress: () => void;
  showEpisodeCount?: boolean;
}) {
  const readMin = nl.episode_count
    ? Math.max(3, Math.round(nl.episode_count * 1.5))
    : 8;

  return (
    <Pressable style={styles.nlRow} onPress={onPress}>
      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.nlName} numberOfLines={1}>{nl.sender_name}</Text>
        <Text style={styles.nlMeta}>
          {nl.frequency.toUpperCase()}
          {showEpisodeCount ? ` · ${readMin} MIN` : ""}
        </Text>
      </View>
      <View style={styles.nlFollowBadge}>
        <Text style={styles.nlFollowText}>Following</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: C.border },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 0.5, borderColor: C.border,
  },
  searchIcon: { fontSize: 18, color: C.muted },
  searchInput: { flex: 1, fontSize: 15, color: C.ink },
  clearIcon: { fontSize: 13, color: C.muted, paddingHorizontal: 4 },

  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 28 },
  section: { gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeading: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.2 },
  sectionCount: {
    backgroundColor: C.surface, borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 2,
    fontSize: 12, fontWeight: "600", color: C.muted,
  },
  sectionLabel: { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 1 },

  nlList: { gap: 8 },
  nlRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 0.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  nlName: { fontSize: 15, fontWeight: "600", color: C.ink },
  nlMeta: { fontSize: 12, color: C.muted },
  nlFollowBadge: {
    backgroundColor: C.teal50, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  nlFollowText: { fontSize: 11, fontWeight: "700", color: C.teal },

  addMoreBtn: {
    borderWidth: 1.5, borderColor: C.teal, borderStyle: "dashed",
    borderRadius: 12, paddingVertical: 12, alignItems: "center",
  },
  addMoreText: { fontSize: 14, color: C.teal, fontWeight: "600" },

  emptyCenter: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 12 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyIcon: { fontSize: 28, color: C.muted },
  emptyHeading: { fontSize: 20, fontWeight: "700", color: C.ink },
  emptySubtext: { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
  emptyText: { fontSize: 15, color: C.muted, textAlign: "center" },
  connectBtn: { backgroundColor: C.indigo, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 4 },
  connectBtnText: { color: C.white, fontWeight: "700", fontSize: 15 },
});
