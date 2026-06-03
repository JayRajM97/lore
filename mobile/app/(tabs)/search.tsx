import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { MOCK_EPISODES, MOCK_NEWSLETTERS } from "../../lib/mockData";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";

export default function Search() {
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const [q, setQ] = useState("");

  const newsletters = useMemo(
    () => (q ? MOCK_NEWSLETTERS.filter((n) => n.sender_name.toLowerCase().includes(q.toLowerCase())) : []),
    [q]
  );
  const episodes = useMemo(
    () => (q ? MOCK_EPISODES.filter((e) => e.subject.toLowerCase().includes(q.toLowerCase())) : []),
    [q]
  );

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
              <View style={{ gap: 8, marginBottom: 8 }}>
                <Text style={styles.section}>Newsletters</Text>
                {newsletters.map((n) => (
                  <Pressable key={n.id} style={styles.nlRow} onPress={() => router.push(`/newsletter/${n.id}`)}>
                    <Avatar name={n.sender_name} url={n.sender_logo_url} size={40} />
                    <Text style={styles.nlName}>{n.sender_name}</Text>
                  </Pressable>
                ))}
                <Text style={styles.section}>Episodes</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <EpisodeCard
              episode={item}
              onPressBody={() => router.push(`/newsletter/${item.newsletter_id}`)}
              onPressPlay={() => play(item)}
            />
          )}
          ListEmptyComponent={<Text style={styles.noRes}>No episodes found</Text>}
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
  section: { fontSize: 13, fontWeight: "500", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  nlRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12 },
  nlName: { fontSize: 15, fontWeight: "500", color: C.ink },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15, color: C.muted },
  noRes: { fontSize: 15, color: C.muted, textAlign: "center", padding: 20 },
});
