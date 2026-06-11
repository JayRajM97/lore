import { useMemo, useState } from "react";
import {
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
import { saveFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { Newsletter } from "../../lib/types";
import Avatar from "../../components/Avatar";

const MAX_W = 680;

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
  const [q, setQ] = useState("");

  const filtered = q
    ? found.filter((n) => n.sender_name.toLowerCase().includes(q.toLowerCase()))
    : found;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allSelected = found.length > 0 && selected.size === found.length;

  async function start() {
    const picked = found.filter((n) => selected.has(n.id));
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
      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerInner}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>Select Newsletters</Text>
              <Text style={styles.sub}>
                We found <Text style={styles.subBold}>{found.length}</Text> newsletters in your inbox
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() =>
                setSelected(
                  allSelected ? new Set() : new Set(found.map((n) => n.id))
                )
              }
            >
              <Text style={styles.selectAll}>
                {allSelected ? "Clear all" : "Select all"}
              </Text>
            </Pressable>
          </View>
          {/* Search */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search newsletters..."
              placeholderTextColor={C.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")}>
                <Text style={styles.clearSearch}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inner}>
          {filtered.map((nl) => (
            <NewsletterRow
              key={nl.id}
              nl={nl}
              selected={selected.has(nl.id)}
              onToggle={() => toggle(nl.id)}
            />
          ))}
          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No newsletters match "{q}"</Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyInner}>
          {selected.size > 0 && (
            <Text style={styles.selectedCount}>{selected.size} selected</Text>
          )}
          <Pressable
            style={[styles.cta, selected.size === 0 && styles.ctaOff]}
            disabled={selected.size === 0}
            onPress={start}
          >
            <Text style={styles.ctaText}>
              {selected.size === 0
                ? "Select newsletters to continue"
                : "Follow Selected & Start Listening →"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NewsletterRow({
  nl,
  selected,
  onToggle,
}: {
  nl: Newsletter;
  selected: boolean;
  onToggle: () => void;
}) {
  const readMin = nl.episode_count
    ? Math.max(3, Math.round(nl.episode_count * 1.5))
    : 8;

  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onToggle}
    >
      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={48} />
      <View style={styles.rowContent}>
        <Text style={styles.rowName} numberOfLines={1}>
          {nl.sender_name}
        </Text>
        <Text style={styles.rowMeta}>
          {nl.frequency.toUpperCase()} · {readMin} MIN READ
        </Text>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxOn]}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },

  headerWrap: {
    borderBottomWidth: 0.5, borderColor: C.border, backgroundColor: C.bg,
  },
  headerInner: {
    maxWidth: MAX_W, alignSelf: "center", width: "100%",
    padding: 16, paddingBottom: 14, gap: 12,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  h1: { fontSize: 24, fontWeight: "800", color: C.ink, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: C.muted, marginTop: 2 },
  subBold: { fontWeight: "700", color: C.ink },
  selectAll: { fontSize: 13, color: C.teal, fontWeight: "600", flexShrink: 0, paddingTop: 4 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, height: 42,
    borderWidth: 0.5, borderColor: C.border,
  },
  searchIcon: { fontSize: 16, color: C.muted },
  searchInput: { flex: 1, fontSize: 14, color: C.ink },
  clearSearch: { fontSize: 14, color: C.muted, paddingHorizontal: 4 },

  scroll: { paddingTop: 8 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", paddingHorizontal: 16, gap: 8 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.white, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  rowSelected: { borderColor: C.teal, backgroundColor: C.teal50 },
  rowContent: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: "700", color: C.ink },
  rowMeta: { fontSize: 12, color: C.muted, letterSpacing: 0.3 },

  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  checkboxOn: { borderColor: C.teal, backgroundColor: C.teal },
  checkmark: { color: C.white, fontSize: 13, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 15, color: C.muted },

  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg, borderTopWidth: 0.5, borderColor: C.border,
    paddingTop: 10, paddingBottom: 28,
  },
  stickyInner: {
    maxWidth: MAX_W, alignSelf: "center", width: "100%",
    paddingHorizontal: 16, gap: 6,
  },
  selectedCount: { fontSize: 13, color: C.muted, textAlign: "center" },
  cta: {
    backgroundColor: C.teal, borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
    shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  ctaOff: { backgroundColor: C.border, shadowOpacity: 0 },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 15 },
});
