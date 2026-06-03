import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { api } from "../../lib/api";
import { Newsletter } from "../../lib/types";
import NewsletterCard from "../../components/NewsletterCard";

export default function Discover() {
  const router = useRouter();
  const found: Newsletter[] = useMemo(
    () => (globalThis as any).__lore_scan ?? [],
    []
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(found.filter((n) => n.is_following).map((n) => n.id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allSelected = selected.size === found.length;

  async function start() {
    await api.followNewsletters([...selected]);
    (globalThis as any).__lore_generating = found.filter((n) => selected.has(n.id));
    router.replace("/(auth)/generating");
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>We found {found.length} newsletters</Text>
          <Text style={styles.sub}>Pick the ones you want to listen to</Text>
        </View>
        <Pressable onPress={() => setSelected(allSelected ? new Set() : new Set(found.map((n) => n.id)))}>
          <Text style={styles.selectAll}>{allSelected ? "Clear" : "Select All"}</Text>
        </Pressable>
      </View>

      <FlatList
        data={found}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <NewsletterCard newsletter={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} />
        )}
      />

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.cta, selected.size === 0 && styles.ctaDisabled]}
          disabled={selected.size === 0}
          onPress={start}
        >
          <Text style={styles.ctaText}>Start Listening ({selected.size} selected)</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  h1: { fontSize: 22, fontWeight: "500", color: C.ink },
  sub: { fontSize: 15, color: C.muted, marginTop: 2 },
  selectAll: { color: C.teal, fontSize: 14, fontWeight: "500", paddingTop: 4 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: C.bg, borderTopWidth: 0.5, borderColor: C.border },
  cta: { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: C.teal50, fontWeight: "600", fontSize: 16 },
});
