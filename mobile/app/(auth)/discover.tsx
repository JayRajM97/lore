import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { saveFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { Newsletter } from "../../lib/types";
import { fetchRecentEmails, FetchedEmail } from "../../lib/gmail";
import { relativeDate } from "../../lib/format";
import Avatar from "../../components/Avatar";
import { FadeInUp, PressableScale } from "../../components/anim";

const MAX_W = 680;
const SCREEN_H = Dimensions.get("window").height;
const SHEET_H = Math.min(SCREEN_H * 0.82, 680);

// ─── Detail sheet ────────────────────────────────────────────────────────────

interface SheetProps {
  nl: Newsletter | null;
  selected: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  token: string | null;
}

function DetailSheet({ nl, selected, onToggleFollow, onClose, token }: SheetProps) {
  const [emails, setEmails] = useState<FetchedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;

  // Slide in when nl is set
  useEffect(() => {
    if (nl) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      // Fetch previews
      setEmails([]);
      setError(null);
      if (token) {
        setLoading(true);
        fetchRecentEmails(nl, token, 2)
          .then(setEmails)
          .catch(() => setError("Couldn't load email previews"))
          .finally(() => setLoading(false));
      } else {
        setError("Reconnect Gmail to see previews");
      }
    } else {
      slideAnim.setValue(SHEET_H);
    }
  }, [nl?.id]);

  function close() {
    Animated.timing(slideAnim, {
      toValue: SHEET_H,
      duration: 240,
      useNativeDriver: true,
    }).start(onClose);
  }

  if (!nl) return null;

  const readMin = nl.episode_count ? Math.max(3, Math.round(nl.episode_count * 1.5)) : 8;

  return (
    <Modal
      visible={!!nl}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      {/* Scrim */}
      <Pressable style={sheet.scrim} onPress={close} />

      {/* Sheet */}
      <Animated.View
        style={[sheet.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Handle */}
        <View style={sheet.handle} />

        {/* Header */}
        <View style={sheet.header}>
          <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={sheet.nameRow}>
              <Text style={sheet.name} numberOfLines={1}>{nl.sender_name}</Text>
              {nl.is_following && (
                <View style={sheet.followingBadge}>
                  <Text style={sheet.followingText}>Following</Text>
                </View>
              )}
            </View>
            <Text style={sheet.email} numberOfLines={1}>{nl.sender_email}</Text>
          </View>
          <Pressable onPress={close} style={sheet.closeBtn}>
            <Text style={sheet.closeX}>✕</Text>
          </Pressable>
        </View>

        {/* Meta row */}
        <View style={sheet.metaRow}>
          <View style={sheet.metaChip}>
            <Text style={sheet.metaIcon}>📅</Text>
            <Text style={sheet.metaLabel}>{nl.frequency}</Text>
          </View>
          <View style={sheet.metaChip}>
            <Text style={sheet.metaIcon}>🕐</Text>
            <Text style={sheet.metaLabel}>{readMin} min read</Text>
          </View>
          <View style={sheet.metaChip}>
            <Text style={sheet.metaIcon}>📬</Text>
            <Text style={sheet.metaLabel}>Last: {relativeDate(nl.last_received_at)}</Text>
          </View>
        </View>

        <View style={sheet.divider} />

        {/* Email previews */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sheet.previewsContent}
        >
          <Text style={sheet.previewsLabel}>Recent Issues</Text>

          {loading && (
            <View style={sheet.loadingWrap}>
              <ActivityIndicator color={C.indigo} />
              <Text style={sheet.loadingText}>Loading previews…</Text>
            </View>
          )}

          {error && !loading && (
            <Text style={sheet.errorText}>{error}</Text>
          )}

          {!loading && emails.map((email, i) => (
            <FadeInUp key={email.id} delay={Math.min(i, 8) * 60}>
              <EmailPreviewCard email={email} index={i} />
            </FadeInUp>
          ))}

          {!loading && !error && emails.length === 0 && (
            <Text style={sheet.errorText}>No recent issues found</Text>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Follow CTA */}
        <View style={sheet.footer}>
          <PressableScale
            style={[sheet.followBtn, selected && sheet.followBtnOn, selected && sheet.followGlow]}
            onPress={() => { onToggleFollow(); close(); }}
            to={0.95}
          >
            <Text style={[sheet.followBtnText, selected && sheet.followBtnTextOn]}>
              {selected ? "✓ Selected · Tap to deselect" : "Select this newsletter"}
            </Text>
          </PressableScale>
        </View>
      </Animated.View>
    </Modal>
  );
}

function EmailPreviewCard({ email, index }: { email: FetchedEmail; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = email.text.trim().replace(/\s+/g, " ").slice(0, 320);
  const hasMore = email.text.trim().length > 320;

  return (
    <PressableScale
      style={sheet.emailCard}
      onPress={() => setExpanded((e) => !e)}
    >
      <View style={sheet.emailCardHeader}>
        <View style={sheet.issueLabel}>
          <Text style={sheet.issueLabelText}>Issue {index === 0 ? "Latest" : "Previous"}</Text>
        </View>
      </View>
      <Text style={sheet.emailSubject} numberOfLines={2}>{email.subject}</Text>
      <Text style={sheet.emailPreview} numberOfLines={expanded ? undefined : 4}>
        {preview}{!expanded && hasMore ? "…" : ""}
      </Text>
      {hasMore && (
        <Text style={sheet.readMore}>{expanded ? "Show less" : "Read more"}</Text>
      )}
    </PressableScale>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function Discover() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.accessToken);
  const found: Newsletter[] = useMemo(
    () => (globalThis as any).__lore_scan ?? [],
    []
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(found.filter((n) => n.is_following).map((n) => n.id))
  );
  const [q, setQ] = useState("");
  const [viewingNl, setViewingNl] = useState<Newsletter | null>(null);

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
          <FadeInUp style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>Select Newsletters</Text>
              <Text style={styles.sub}>
                We found <Text style={styles.subBold}>{found.length}</Text> in your inbox
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
          </FadeInUp>
          <FadeInUp delay={60} style={styles.searchBox}>
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
          </FadeInUp>
        </View>
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inner}>
          {filtered.map((nl, i) => (
            <FadeInUp key={nl.id} delay={Math.min(i, 8) * 60}>
              <NewsletterRow
                nl={nl}
                selected={selected.has(nl.id)}
                onToggle={() => toggle(nl.id)}
                onView={() => setViewingNl(nl)}
              />
            </FadeInUp>
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
          <PressableScale
            style={[styles.cta, selected.size === 0 ? styles.ctaOff : styles.ctaGlow]}
            disabled={selected.size === 0}
            onPress={start}
            to={0.95}
          >
            <Text style={styles.ctaText}>
              {selected.size === 0
                ? "Select newsletters to continue"
                : "Follow Selected & Start Listening →"}
            </Text>
          </PressableScale>
        </View>
      </View>

      {/* Detail sheet */}
      <DetailSheet
        nl={viewingNl}
        selected={viewingNl ? selected.has(viewingNl.id) : false}
        onToggleFollow={() => viewingNl && toggle(viewingNl.id)}
        onClose={() => setViewingNl(null)}
        token={token}
      />
    </SafeAreaView>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function NewsletterRow({
  nl,
  selected,
  onToggle,
  onView,
}: {
  nl: Newsletter;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
}) {
  const readMin = nl.episode_count
    ? Math.max(3, Math.round(nl.episode_count * 1.5))
    : 8;

  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      {/* Tap body = select */}
      <Pressable style={styles.rowBody} onPress={onToggle}>
        <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={48} />
        <View style={styles.rowContent}>
          <View style={styles.rowNameRow}>
            <Text style={styles.rowName} numberOfLines={1}>{nl.sender_name}</Text>
            {nl.is_following && (
              <View style={styles.alreadyBadge}>
                <Text style={styles.alreadyText}>Subscribed</Text>
              </View>
            )}
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {nl.sender_email} · {nl.frequency.toUpperCase()}
          </Text>
        </View>
      </Pressable>

      {/* View button */}
      <Pressable style={styles.viewBtn} onPress={onView} hitSlop={6}>
        <Text style={styles.viewBtnText}>View</Text>
      </Pressable>

      {/* Checkbox — separate tap zone */}
      <Pressable style={[styles.checkbox, selected && styles.checkboxOn]} onPress={onToggle}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },

  headerWrap: { borderBottomWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  headerInner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, paddingBottom: 14, gap: 12 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  h1: { fontSize: 24, fontWeight: "800", color: C.ink, fontFamily: SERIF, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: C.muted, marginTop: 2 },
  subBold: { fontWeight: "700", color: C.ink },
  selectAll: { fontSize: 13, color: C.teal, fontWeight: "600", flexShrink: 0, paddingTop: 4 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: RADIUS.btn, paddingHorizontal: 12, height: 42 },
  searchIcon: { fontSize: 16, color: C.muted },
  searchInput: { flex: 1, fontSize: 14, color: C.ink },
  clearSearch: { fontSize: 14, color: C.muted, paddingHorizontal: 4 },

  scroll: { paddingTop: 8 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", paddingHorizontal: 16, gap: 8 },

  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.white, borderRadius: RADIUS.card, borderWidth: 1.5, borderColor: "transparent", paddingRight: 12, ...(SHADOW.card as object) },
  rowSelected: { borderColor: C.teal, backgroundColor: C.teal50 },
  rowBody: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowContent: { flex: 1, gap: 3 },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowName: { fontSize: 15, fontWeight: "700", color: C.ink },
  rowMeta: { fontSize: 12, color: C.muted },

  alreadyBadge: { backgroundColor: C.indigo + "22", borderRadius: RADIUS.pill, paddingHorizontal: 5, paddingVertical: 2 },
  alreadyText: { fontSize: 10, fontWeight: "700", color: C.indigo, letterSpacing: 0.3 },

  viewBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.btn, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  viewBtnText: { fontSize: 12, fontWeight: "600", color: C.muted },

  checkbox: { width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxOn: { borderColor: C.teal, backgroundColor: C.teal },
  checkmark: { color: C.white, fontSize: 13, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 15, color: C.muted },

  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopWidth: 0.5, borderColor: C.border, paddingTop: 10, paddingBottom: 28 },
  stickyInner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", paddingHorizontal: 16, gap: 6 },
  selectedCount: { fontSize: 13, color: C.muted, textAlign: "center" },
  cta: { backgroundColor: C.teal, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: "center" },
  ctaGlow: { ...(SHADOW.glow(C.teal) as object) },
  ctaOff: { backgroundColor: C.border },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 15 },
});

const sheet = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },

  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SHEET_H,
    backgroundColor: C.bg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    overflow: "hidden",
  },

  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },

  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 18, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  email: { fontSize: 13, color: C.muted },
  followingBadge: { backgroundColor: C.teal50, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 2 },
  followingText: { fontSize: 11, fontWeight: "700", color: C.teal },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  closeX: { fontSize: 12, color: C.muted, fontWeight: "700" },

  metaRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surface, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  metaIcon: { fontSize: 12 },
  metaLabel: { fontSize: 12, fontWeight: "500", color: C.ink },

  divider: { height: 0.5, backgroundColor: C.border, marginHorizontal: 20 },

  previewsContent: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  previewsLabel: { fontSize: 13, fontWeight: "700", color: C.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },

  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 20 },
  loadingText: { fontSize: 14, color: C.muted },
  errorText: { fontSize: 14, color: C.muted, paddingVertical: 16, textAlign: "center" },

  emailCard: { backgroundColor: C.white, borderRadius: RADIUS.card, padding: 16, gap: 8, ...(SHADOW.card as object) },
  emailCardHeader: { flexDirection: "row", alignItems: "center" },
  issueLabel: { backgroundColor: C.indigo + "18", borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  issueLabelText: { fontSize: 11, fontWeight: "700", color: C.indigo, letterSpacing: 0.3 },
  emailSubject: { fontSize: 15, fontWeight: "700", color: C.ink, lineHeight: 21 },
  emailPreview: { fontSize: 14, color: C.muted, lineHeight: 21 },
  readMore: { fontSize: 13, fontWeight: "600", color: C.teal },

  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, borderTopWidth: 0.5, borderColor: C.border },
  followBtn: { borderRadius: RADIUS.pill, paddingVertical: 15, alignItems: "center", borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  followBtnOn: { backgroundColor: C.teal, borderColor: C.teal },
  followGlow: { ...(SHADOW.glow(C.teal) as object) },
  followBtnText: { fontSize: 15, fontWeight: "700", color: C.muted },
  followBtnTextOn: { color: C.white },
});
