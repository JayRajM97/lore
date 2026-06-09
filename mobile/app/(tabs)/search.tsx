import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Episode, Newsletter } from "../../lib/types";
import { getEpisodes, getFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";

export default function Search() {
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const user = useAuth((s) => s.user);
  const [q, setQ] = useState("");
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([]);
  const [allFollows, setAllFollows] = useState<Newsletter[]>([]);

  useEffect(() => {
    const session: Episode[] = (globalThis as any).__lore_episodes ?? [];
    if (session.length) {
      setAllEpisodes(session);
    } else if (user) {
      getEpisodes(user.sub).then(setAllEpisodes).catch(() => {});
    }
    if (user) {
      getFollows(user.sub).then(setAllFollows).catch(() => {});
    }
  }, [user]);

  const newsletters = useMemo(
    () =>
      q
        ? allFollows.filter(
            (n) =>
              n.sender_name.toLowerCase().includes(q.toLowerCase()) ||
              n.sender_email.toLowerCase().includes(q.toLowerCase())
          )
        : [],
    [q, allFollows]
  );

  const episodes = useMemo(
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

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.searchBox}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search newsletters or episodes"
          placeholderTextColor={C.muted}
          style={styles.input}
          autoCorrect={false}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ("")} hitSlop={8}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        )}
      </View>

      {!q ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Search for newsletters or episodes</Text>
        </View>
      ) : (
        <FlatList
          data={episodes}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            newsletters.length ? (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <Text style={styles.section}>Newsletters</Text>
                {newsletters.map((n) => (
                  <Pressable
                    key={n.id}
                    style={styles.nlRow}
                    onPress={() => router.push(`/newsletter/${encodeURIComponent(n.id)}`)}
                  >
                    <Avatar name={n.sender_name} url={n.sender_logo_url} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nlName}>{n.sender_name}</Text>
                      <Text style={styles.nlMeta}>{n.frequency}</Text>
                    </View>
                  </Pressable>
                ))}
                {episodes.length > 0 && <Text style={[styles.section, { marginTop: 8 }]}>Episodes</Text>}
              </View>
            ) : episodes.length > 0 ? (
              <Text style={[styles.section, { marginBottom: 8 }]}>Episodes</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <EpisodeCard
              episode={item}
              onPressBody={() => openPlayer(item)}
              onPressPlay={() => openPlayer(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results for "{q}"</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, paddingHorizontal: 12, height: 44, borderRadius: 10, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border },
  icon: { fontSize: 18, color: C.muted },
  input: { flex: 1, fontSize: 15, color: C.ink },
  clear: { fontSize: 14, color: C.muted },
  section: { fontSize: 13, fontWeight: "500", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  nlRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12 },
  nlName: { fontSize: 15, fontWeight: "500", color: C.ink },
  nlMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, marginTop: 60 },
  emptyText: { fontSize: 15, color: C.muted, textAlign: "center" },
});
