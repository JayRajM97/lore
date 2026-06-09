import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { getEpisodes, getFollows, saveFollows, unfollow } from "../../lib/db";
import { Episode, Newsletter } from "../../lib/types";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import FrequencyBadge from "../../components/FrequencyBadge";
import EpisodeCard from "../../components/EpisodeCard";

export default function NewsletterDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const play = usePlayer((s) => s.play);

  const [nl, setNl] = useState<Newsletter | undefined>();
  const [eps, setEps] = useState<Episode[]>([]);
  const [following, setFollowing] = useState(false);

  const newsletterId = decodeURIComponent(id ?? "");

  useEffect(() => {
    if (!newsletterId) return;

    // Find newsletter metadata from follows or episode sender info.
    const loadData = async () => {
      const sessionEps: Episode[] = (globalThis as any).__lore_episodes ?? [];
      const sessionFollows: Newsletter[] = (globalThis as any).__lore_scan ?? [];

      // Episodes for this newsletter (match by newsletter_id = sender email).
      const matchEps = sessionEps.filter((e) => e.newsletter_id === newsletterId);
      setEps(matchEps);

      // Newsletter metadata — check scan results first, then Firestore.
      let found = sessionFollows.find((n) => n.id === newsletterId);
      if (!found && user) {
        const follows = await getFollows(user.sub).catch(() => [] as Newsletter[]);
        found = follows.find((n) => n.id === newsletterId);
      }

      if (!found && matchEps.length) {
        // Reconstruct minimal metadata from episode.
        found = {
          id: newsletterId,
          sender_email: newsletterId,
          sender_name: matchEps[0].sender_name,
          sender_logo_url: matchEps[0].sender_logo_url,
          frequency: "Weekly",
          last_received_at: matchEps[0].received_at,
          is_following: false,
        };
      }
      setNl(found);
      setFollowing(found?.is_following ?? false);

      // Also load persisted episodes from Firestore if session is empty.
      if (!matchEps.length && user) {
        const all = await getEpisodes(user.sub).catch(() => [] as Episode[]);
        setEps(all.filter((e) => e.newsletter_id === newsletterId));
      }
    };

    loadData();
  }, [newsletterId, user]);

  async function toggleFollow() {
    if (!nl || !user) return;
    if (following) {
      await unfollow(user.sub, nl.id).catch(() => {});
    } else {
      await saveFollows(user.sub, [nl]).catch(() => {});
    }
    setFollowing(!following);
  }

  function openPlayer(ep: Episode) {
    play(ep);
    router.push("/player");
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
        ListHeaderComponent={
          nl ? (
            <View style={styles.head}>
              <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={64} />
              <Text style={styles.name}>{nl.sender_name}</Text>
              <FrequencyBadge label={nl.frequency} />
              <Pressable
                style={[styles.follow, following && styles.followingBtn]}
                onPress={toggleFollow}
              >
                <Text style={[styles.followText, following && styles.followingText]}>
                  {following ? "Following" : "Follow"}
                </Text>
              </Pressable>
              {eps.length > 0 && <Text style={styles.allLabel}>All Episodes</Text>}
            </View>
          ) : (
            <View style={styles.head}>
              <Text style={styles.name}>{newsletterId}</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>No episodes yet</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <EpisodeCard
            episode={item}
            onPressBody={() => openPlayer(item)}
            onPressPlay={() => openPlayer(item)}
          />
        )}
        ListEmptyComponent={
          nl ? <Text style={styles.empty}>No episodes generated yet for this newsletter.</Text> : null
        }
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
  empty: { textAlign: "center", color: C.muted, fontSize: 14, marginTop: 40 },
});
