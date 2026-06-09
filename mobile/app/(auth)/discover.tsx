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
const COL_GAP = 12;

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

  // Pair newsletters into rows of 2 for the grid
  const rows: [Newsletter, Newsletter | null][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    rows.push([filtered[i], filtered[i + 1] ?? null]);
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      {/* header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.h1}>
              We found {found.length} newsletters.
            </Text>
            <Text style={styles.sub}>
              Select the ones you'd like to convert into your audio feed.
            </Text>
          </View>
          <View style={styles.headerRight}>
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
        </View>
      </View>

      {/* grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inner}>
          {rows.map(([a, b], ri) => (
            <View key={ri} style={styles.row}>
              <NewsletterCard
                nl={a}
                selected={selected.has(a.id)}
                onToggle={() => toggle(a.id)}
              />
              {b ? (
                <NewsletterCard
                  nl={b}
                  selected={selected.has(b.id)}
                  onToggle={() => toggle(b.id)}
                />
              ) : (
                <View style={styles.cardSpacer} />
              )}
            </View>
          ))}
          {/* bottom padding for the sticky bar */}
          <View style={{ height: 90 }} />
        </View>
      </ScrollView>

      {/* sticky CTA */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyInner}>
          {selected.size > 0 && (
            <Text style={styles.selectedCount}>
              {selected.size} selected
            </Text>
          )}
          <Pressable
            style={[styles.cta, selected.size === 0 && styles.ctaOff]}
            disabled={selected.size === 0}
            onPress={start}
          >
            <Text style={styles.ctaText}>
              {selected.size === 0
                ? "Select newsletters to continue"
                : `Convert to Audio →`}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NewsletterCard({
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
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onToggle}
    >
      {/* radio */}
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected && <View style={styles.radioDot} />}
      </View>

      {/* avatar */}
      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={52} />

      {/* meta */}
      <Text style={styles.cardName} numberOfLines={2}>
        {nl.sender_name}
      </Text>
      <View style={styles.cardBadge}>
        <Text style={styles.cardFreq}>{nl.frequency.toUpperCase()}</Text>
        <Text style={styles.cardBadgeDot}>·</Text>
        <Text style={styles.cardRead}>{readMin} MIN READ</Text>
      </View>
    </Pressable>
  );
}

const CARD_W = `${(100 - COL_GAP / 4) / 2}%` as any;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },

  headerWrap: {
    borderBottomWidth: 0.5, borderColor: C.border, backgroundColor: C.bg,
  },
  headerInner: {
    maxWidth: MAX_W, alignSelf: "center", width: "100%",
    padding: 16, paddingBottom: 14, gap: 10,
  },
  h1: { fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: C.muted, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 10, height: 38,
    borderWidth: 0.5, borderColor: C.border,
  },
  searchIcon: { fontSize: 16, color: C.muted },
  searchInput: { flex: 1, fontSize: 14, color: C.ink },
  selectAll: { fontSize: 13, color: C.teal, fontWeight: "600", flexShrink: 0 },

  scroll: { paddingTop: 4 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 14, gap: COL_GAP },
  row: { flexDirection: "row", gap: COL_GAP },

  // card
  card: {
    flex: 1, backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    padding: 14, gap: 8, alignItems: "flex-start", position: "relative",
  },
  cardSelected: { borderColor: C.teal, backgroundColor: C.teal50 },
  cardSpacer: { flex: 1 },

  radio: {
    position: "absolute", top: 12, right: 12,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
    alignItems: "center", justifyContent: "center",
  },
  radioOn: { borderColor: C.teal, backgroundColor: C.teal },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.white },

  cardName: { fontSize: 15, fontWeight: "700", color: C.ink, marginTop: 4 },
  cardBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardFreq: { fontSize: 11, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },
  cardBadgeDot: { fontSize: 11, color: C.muted },
  cardRead: { fontSize: 11, color: C.muted, letterSpacing: 0.3 },

  // sticky bar
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
    shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  ctaOff: { backgroundColor: C.border, shadowOpacity: 0 },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 16 },
});
