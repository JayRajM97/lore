import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { api } from "../../lib/api";
import { Episode, Newsletter } from "../../lib/types";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import FrequencyBadge from "../../components/FrequencyBadge";
import EpisodeCard from "../../components/EpisodeCard";

export default function NewsletterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const [nl, setNl] = useState<Newsletter | undefined>();
  const [eps, setEps] = useState<Episode[]>([]);
  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const n = await api.getNewsletter(id);
    setNl(n);
    setFollowing(!!n?.is_following);
    setEps(await api.getNewsletterEpisodes(id));
  }
  useEffect(() => {
    load();
  }, [id]);

  async function toggleFollow() {
    if (!nl) return;
    if (following) await api.unfollowNewsletter(nl.id);
    else await api.followNewsletters([nl.id]);
    setFollowing(!following);
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      </View>

      <FlatList
        data={eps}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={C.teal}
          />
        }
        ListHeaderComponent={
          nl ? (
            <View style={styles.head}>
              <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={64} />
              <Text style={styles.name}>{nl.sender_name}</Text>
              <FrequencyBadge label={nl.frequency} />
              <Pressable style={[styles.follow, following && styles.followingBtn]} onPress={toggleFollow}>
                <Text style={[styles.followText, following && styles.followingText]}>
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
              <Text style={styles.allLabel}>All Episodes</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <EpisodeCard episode={item} onPressBody={() => play(item)} onPressPlay={() => play(item)} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  topbar: { paddingHorizontal: 16, paddingVertical: 8 },
  back: { fontSize: 16, color: C.teal },
  head: { alignItems: "center", gap: 8, paddingVertical: 12 },
  name: { fontSize: 20, fontWeight: "600", color: C.ink, marginTop: 4 },
  follow: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 9, borderRadius: 100, backgroundColor: C.teal },
  followingBtn: { backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border },
  followText: { color: C.teal50, fontWeight: "600" },
  followingText: { color: C.muted },
  allLabel: { alignSelf: "flex-start", fontSize: 13, fontWeight: "500", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 16 },
});
