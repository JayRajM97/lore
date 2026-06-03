import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { api } from "../../lib/api";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";
import EpisodeCard from "../../components/EpisodeCard";

const TABS = ["Following", "Saved", "Downloaded"] as const;

export default function Library() {
  const router = useRouter();
  const play = usePlayer((s) => s.play);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Following");

  const following = api.getFollowing();
  const saved = api.getSaved();

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <Text style={styles.h1}>Library</Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "Following" && (
        <FlatList
          data={following}
          key="grid"
          numColumns={2}
          keyExtractor={(n) => n.id}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={<EmptyState text="Follow newsletters to see them here" />}
          renderItem={({ item }) => (
            <Pressable style={styles.gridCard} onPress={() => router.push(`/newsletter/${item.id}`)}>
              <Avatar name={item.sender_name} url={item.sender_logo_url} size={56} />
              <Text style={styles.gridName} numberOfLines={1}>{item.sender_name}</Text>
              <Text style={styles.gridMeta}>{item.episode_count ?? 0} episodes</Text>
            </Pressable>
          )}
        />
      )}

      {tab === "Saved" && (
        <FlatList
          data={saved}
          key="saved"
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<EmptyState text="Bookmark episodes to find them here" />}
          renderItem={({ item }) => (
            <EpisodeCard
              episode={item}
              onPressBody={() => router.push(`/newsletter/${item.newsletter_id}`)}
              onPressPlay={() => play(item)}
            />
          )}
        />
      )}

      {tab === "Downloaded" && <EmptyState text="Download episodes to listen offline" />}
    </SafeAreaView>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  h1: { fontSize: 24, fontWeight: "600", color: C.ink, paddingHorizontal: 16, paddingTop: 8 },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: C.surface },
  tabOn: { backgroundColor: C.teal50 },
  tabText: { fontSize: 13, color: C.muted, fontWeight: "500" },
  tabTextOn: { color: C.teal },
  gridCard: { flex: 1, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 16, alignItems: "center", gap: 6 },
  gridName: { fontSize: 14, fontWeight: "500", color: C.ink, marginTop: 4 },
  gridMeta: { fontSize: 12, color: C.muted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15, color: C.muted, textAlign: "center" },
});
