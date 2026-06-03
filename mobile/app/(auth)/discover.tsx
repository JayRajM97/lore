import { useMemo, useState } from "react";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { saveFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { Newsletter } from "../../lib/types";
import NewsletterCard from "../../components/NewsletterCard";

const MAX_W = 640;

export default function Discover() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
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

  const allSelected = found.length > 0 && selected.size === found.length;

  function start() {
    const picked = found.filter((n) => selected.has(n.id));
    // Persist in the background — never block navigation on a Firestore write.
    if (user) {
      saveFollows(user.sub, picked).catch((e) =>
        console.error("saveFollows failed", e)
      );
    }
    (globalThis as any).__lore_generating = picked;
    router.replace("/(auth)/generating");
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>We found {found.length} newsletters</Text>
            <Text style={styles.sub}>Pick the ones you want to listen to</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setSelected(allSelected ? new Set() : new Set(found.map((n) => n.id)))
            }
          >
            <Text style={styles.selectAll}>{allSelected ? "Clear" : "Select all"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {found.map((item) => (
            <NewsletterCard
              key={item.id}
              newsletter={item}
              selected={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomInner}>
          <Pressable
            style={[styles.cta, selected.size === 0 && styles.ctaDisabled]}
            disabled={selected.size === 0}
            onPress={start}
          >
            <Text style={styles.ctaText}>
              {selected.size === 0
                ? "Select newsletters to continue"
                : `Start Listening · ${selected.size} selected`}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { borderBottomWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  headerInner: {
    width: "100%",
    maxWidth: MAX_W,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  h1: { fontSize: 24, fontWeight: "700", color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 15, color: C.muted, marginTop: 3 },
  selectAll: { color: C.teal, fontSize: 14, fontWeight: "600", paddingTop: 4 },
  scroll: { paddingVertical: 16, paddingBottom: 120 },
  list: { width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: 16, gap: 10 },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: C.bg,
    borderTopWidth: 0.5,
    borderColor: C.border,
  },
  bottomInner: { width: "100%", maxWidth: MAX_W, alignSelf: "center", paddingHorizontal: 16 },
  cta: {
    backgroundColor: C.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: C.teal,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaDisabled: { backgroundColor: C.border, shadowOpacity: 0 },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 16 },
});
