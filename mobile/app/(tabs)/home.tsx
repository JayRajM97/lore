import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Episode, Newsletter } from "../../lib/types";
import { humanDuration } from "../../lib/format";
import { getEpisodes, getFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";

const MAX_W = 720;

export default function Home() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  const play = usePlayer((s) => s.play);

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [follows, setFollows] = useState<Newsletter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [firestoreEps, fol] = await Promise.all([
        user ? getEpisodes(user.sub).catch(() => [] as Episode[]) : Promise.resolve([] as Episode[]),
        user ? getFollows(user.sub).catch(() => [] as Newsletter[]) : Promise.resolve([] as Newsletter[]),
      ]);
      // Session episodes that haven't been flushed to Firestore yet (still generating)
      const sessionEps: Episode[] = (globalThis as any).__lore_episodes ?? [];
      const inFirestore = new Set(firestoreEps.map((e) => e.id));
      const sessionOnly = sessionEps.filter((e) => !inFirestore.has(e.id));
      setEpisodes([...firestoreEps, ...sessionOnly]);
      setFollows(fol);
      setLoaded(true);
      if ((globalThis as any).__lore_just_generated) {
        (globalThis as any).__lore_just_generated = false;
        setShowReadyBanner(true);
        setTimeout(() => setShowReadyBanner(false), 4000);
      }
    };
    load();
  }, [user]);

  function openPlayer(ep: Episode) {
    play(ep);
    router.push("/player");
  }

  async function syncLatest() {
    if (syncing) return;
    if (!accessToken) { router.push("/(auth)/gmail"); return; }
    setSyncing(true);
    try {
      const fol = user ? await getFollows(user.sub).catch(() => [] as Newsletter[]) : [];
      if (!fol.length) { router.push("/(auth)/scan"); return; }
      (globalThis as any).__lore_generating = fol;
      router.push("/(auth)/generating");
    } finally {
      setSyncing(false);
    }
  }

  const featured = episodes[0] ?? null;
  const upNext = episodes.slice(1, 4);
  const latest = episodes.slice(1);

  const gmailConnected = !!user;

  // ── EMPTY STATE ──
  if (loaded && !gmailConnected) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <EmptyDashboard
          user={user}
          onConnect={() => router.push("/(auth)/gmail")}
          onSettings={() => router.push("/profile")}
        />
      </SafeAreaView>
    );
  }

  if (loaded && episodes.length === 0) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.inner}>
            <HomeHeader user={user} onSettings={() => router.push("/profile")} onSync={syncLatest} syncing={syncing} />
            {!accessToken && (
              <Pressable style={styles.tokenBanner} onPress={() => router.push("/(auth)/gmail")}>
                <Text style={styles.tokenText}>Reconnect Gmail to generate new episodes →</Text>
              </Pressable>
            )}
            {/* Newsletter row */}
            {follows.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>MY NEWSLETTERS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {follows.map((nl) => (
                    <Pressable key={nl.id} style={styles.nlPill}
                      onPress={() => router.push(`/newsletter/${encodeURIComponent(nl.id)}`)}>
                      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={32} />
                      <Text style={styles.nlPillName} numberOfLines={1}>{nl.sender_name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.emptyPodcasts}>
              <Text style={styles.emptyIcon}>🎧</Text>
              <Text style={styles.emptyTitle}>No podcasts yet</Text>
              <Text style={styles.emptySub}>Select newsletters and generate audio to fill your feed.</Text>
              <Pressable style={styles.generateBtn} onPress={() => router.push("/(auth)/scan")}>
                <Text style={styles.generateBtnText}>Generate podcasts</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── POPULATED STATE ──
  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          <HomeHeader user={user} onSettings={() => router.push("/profile")} onSync={syncLatest} syncing={syncing} />

          {showReadyBanner && (
            <View style={styles.readyBanner}>
              <Text style={styles.readyBannerIcon}>✓</Text>
              <Text style={styles.readyBannerText}>Your audio is ready to listen</Text>
            </View>
          )}

          {!accessToken && (
            <Pressable style={styles.tokenBanner} onPress={() => router.push("/(auth)/gmail")}>
              <Text style={styles.tokenText}>Reconnect Gmail to generate new episodes →</Text>
            </Pressable>
          )}

          {/* Featured episode — large card */}
          {featured && (
            <View style={styles.featuredCard}>
              {/* newsletter label */}
              <View style={styles.featuredTop}>
                <View style={styles.featuredSource}>
                  <Avatar name={featured.sender_name} url={featured.sender_logo_url} size={20} />
                  <Text style={styles.featuredSourceName}>{featured.sender_name.toUpperCase()}</Text>
                  <Text style={styles.featuredDot}>·</Text>
                  <Text style={styles.featuredDuration}>{humanDuration(featured.audio_duration_s)}</Text>
                </View>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>New</Text>
                </View>
              </View>
              <Text style={styles.featuredTitle} numberOfLines={3}>{featured.subject}</Text>
              {featured.raw_text && (
                <Text style={styles.featuredPreview} numberOfLines={2}>
                  {featured.raw_text.slice(0, 120)}…
                </Text>
              )}
              <Pressable style={styles.playNowBtn} onPress={() => openPlayer(featured)}>
                <Text style={styles.playNowIcon}>▶</Text>
                <Text style={styles.playNowText}>Play Now</Text>
              </Pressable>
            </View>
          )}

          {/* Up Next row */}
          {upNext.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionHeading}>Up Next</Text>
                <Pressable onPress={() => router.push("/library")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              <View style={styles.upNextList}>
                {upNext.map((ep) => (
                  <Pressable key={ep.id} style={styles.upNextRow} onPress={() => openPlayer(ep)}>
                    <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={44} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.upNextSender} numberOfLines={1}>{ep.sender_name}</Text>
                      <Text style={styles.upNextTitle} numberOfLines={1}>{ep.subject}</Text>
                    </View>
                    <View style={styles.readyTag}>
                      <Text style={styles.readyTagText}>READY</Text>
                    </View>
                    <Text style={styles.upNextDur}>{humanDuration(ep.audio_duration_s)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Latest Converted grid */}
          {latest.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionHeading}>Latest Converted</Text>
                <Pressable onPress={() => router.push("/library")}>
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>
              <View style={styles.latestGrid}>
                {latest.slice(0, 6).map((ep) => (
                  <Pressable key={ep.id} style={styles.latestCard} onPress={() => openPlayer(ep)}>
                    <Text style={styles.latestSource} numberOfLines={1}>
                      {ep.sender_name.toUpperCase()}
                    </Text>
                    <Text style={styles.latestTitle} numberOfLines={3}>{ep.subject}</Text>
                    {ep.raw_text && (
                      <Text style={styles.latestPreview} numberOfLines={2}>
                        {ep.raw_text.slice(0, 80)}…
                      </Text>
                    )}
                    <View style={styles.latestMeta}>
                      <Text style={styles.latestDur}>⏱ {humanDuration(ep.audio_duration_s)}</Text>
                      <Pressable onPress={() => openPlayer(ep)}>
                        <View style={styles.latestPlayBtn}>
                          <Text style={styles.latestPlayIcon}>▶</Text>
                        </View>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* My Newsletters row */}
          {follows.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>My Newsletters</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {follows.map((nl) => (
                  <Pressable key={nl.id} style={styles.nlPill}
                    onPress={() => router.push(`/newsletter/${encodeURIComponent(nl.id)}`)}>
                    <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={32} />
                    <Text style={styles.nlPillName} numberOfLines={1}>{nl.sender_name}</Text>
                  </Pressable>
                ))}
                <Pressable style={[styles.nlPill, styles.nlAddPill]} onPress={() => router.push("/(auth)/scan")}>
                  <View style={styles.nlAddCircle}><Text style={styles.nlAddPlus}>+</Text></View>
                  <Text style={styles.nlPillName}>Add more</Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeHeader({
  user,
  onSettings,
  onSync,
  syncing,
}: {
  user: any;
  onSettings: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <View style={styles.header}>
      <Avatar name={user?.name ?? "?"} url={user?.picture} size={36} />
      <Text style={styles.headerLogo}>Lore!</Text>
      <View style={styles.headerRight}>
        <Pressable style={styles.syncBtn} onPress={onSync} disabled={syncing}>
          {syncing
            ? <ActivityIndicator size="small" color={C.teal} />
            : <Text style={styles.syncBtnText}>↻</Text>}
        </Pressable>
        <Pressable style={styles.settingsBtn} onPress={onSettings}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyDashboard({ user, onConnect, onSettings }: { user: any; onConnect: () => void; onSettings: () => void }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.inner}>
        <HomeHeader user={user} onSettings={onSettings} onSync={() => onConnect()} syncing={false} />
        <View style={styles.emptyHero}>
          <View style={styles.emptyHeroIcon}><Text style={{ fontSize: 36 }}>📖</Text></View>
          <Text style={styles.emptyHeroTitle}>Your library is{"\n"}whispering...</Text>
          <Text style={styles.emptyHeroSub}>
            It looks a bit quiet in here! Lore works best when it's filled
            with the stories, essays, and newsletters you love.
          </Text>
        </View>
        <View style={styles.cards}>
          <Pressable style={styles.gmailCard} onPress={onConnect}>
            <Text style={styles.cardIconLabel}>✉</Text>
            <Text style={styles.cardTitle}>Connect Gmail</Text>
            <Text style={styles.cardSub}>We'll scan for newsletter subscriptions and turn them into your personal audio feed.</Text>
            <View style={styles.gmailBtn}><Text style={styles.gmailBtnText}>Connect Account →</Text></View>
          </Pressable>
          <Pressable style={styles.discoverCard} onPress={onConnect}>
            <Text style={[styles.cardIconLabel, { color: C.ink }]}>◎</Text>
            <Text style={[styles.cardTitle, { color: C.ink }]}>Discover New</Text>
            <Text style={[styles.cardSub, { color: C.muted }]}>Connect Gmail and we'll find the best newsletters already in your inbox.</Text>
            <View style={styles.discoverBtn}><Text style={styles.discoverBtnText}>Get Started ✦</Text></View>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeading}>Latest for You</Text>
            <Text style={styles.nothingYet}>NOTHING HERE YET</Text>
          </View>
          <View style={styles.placeholderRow}>
            <View style={styles.placeholderCard} />
            <View style={styles.placeholderCard} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 24 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLogo: { fontSize: 20, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.teal50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.teal },
  syncBtnText: { fontSize: 17, color: C.teal, fontWeight: "700" },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: C.border },
  settingsIcon: { fontSize: 16, color: C.muted },

  readyBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.teal50, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.teal },
  readyBannerIcon: { fontSize: 16, color: C.teal },
  readyBannerText: { fontSize: 14, fontWeight: "600", color: C.teal },

  tokenBanner: { backgroundColor: C.amber50, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.amber },
  tokenText: { fontSize: 13, color: C.amber, textAlign: "center" },

  section: { gap: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: C.muted, letterSpacing: 1.2 },
  sectionHeading: { fontSize: 20, fontWeight: "700", color: C.ink, letterSpacing: -0.2 },
  viewAll: { fontSize: 13, color: C.teal, fontWeight: "600" },
  nothingYet: { fontSize: 11, color: C.muted, letterSpacing: 0.8 },

  // featured card
  featuredCard: {
    backgroundColor: C.ink, borderRadius: 20, padding: 20, gap: 12,
  },
  featuredTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredSource: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredSourceName: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 0.8 },
  featuredDot: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  featuredDuration: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  newBadge: { backgroundColor: C.teal, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  newBadgeText: { fontSize: 11, fontWeight: "700", color: C.white },
  featuredTitle: { fontSize: 26, fontWeight: "800", color: C.white, lineHeight: 32, letterSpacing: -0.4 },
  featuredPreview: { fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 20 },
  playNowBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.teal, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 20, alignSelf: "flex-start",
  },
  playNowIcon: { color: C.white, fontSize: 14 },
  playNowText: { color: C.white, fontWeight: "700", fontSize: 15 },

  // up next
  upNextList: { gap: 8 },
  upNextRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.white, borderRadius: 12,
    borderWidth: 0.5, borderColor: C.border, padding: 12,
  },
  upNextSender: { fontSize: 12, color: C.muted },
  upNextTitle: { fontSize: 14, fontWeight: "500", color: C.ink },
  readyTag: { backgroundColor: C.teal50, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  readyTagText: { fontSize: 9, fontWeight: "700", color: C.teal, letterSpacing: 0.5 },
  upNextDur: { fontSize: 12, color: C.muted },

  // latest converted grid
  latestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  latestCard: {
    width: "47%", backgroundColor: C.white, borderRadius: 14,
    borderWidth: 0.5, borderColor: C.border, padding: 14, gap: 6,
  },
  latestSource: { fontSize: 10, fontWeight: "700", color: C.teal, letterSpacing: 0.8 },
  latestTitle: { fontSize: 14, fontWeight: "700", color: C.ink, lineHeight: 19 },
  latestPreview: { fontSize: 12, color: C.muted, lineHeight: 16 },
  latestMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  latestDur: { fontSize: 12, color: C.muted },
  latestPlayBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.teal,
    alignItems: "center", justifyContent: "center",
  },
  latestPlayIcon: { fontSize: 10, color: C.teal, marginLeft: 1 },

  // newsletter pills
  nlPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.white, borderRadius: 100,
    borderWidth: 0.5, borderColor: C.border,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  nlPillName: { fontSize: 13, fontWeight: "500", color: C.ink },
  nlAddPill: { borderStyle: "dashed" },
  nlAddCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.surface, alignItems: "center", justifyContent: "center",
  },
  nlAddPlus: { fontSize: 18, color: C.muted },

  // empty states
  emptyPodcasts: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: C.ink },
  emptySub: { fontSize: 14, color: C.muted, textAlign: "center" },
  generateBtn: { marginTop: 8, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  generateBtnText: { color: C.white, fontWeight: "600" },

  // empty dashboard
  emptyHero: { alignItems: "center", gap: 12, paddingVertical: 8 },
  emptyHeroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.teal, alignItems: "center", justifyContent: "center",
  },
  emptyHeroTitle: {
    fontSize: 30, fontWeight: "800", color: C.ink,
    textAlign: "center", letterSpacing: -0.4, lineHeight: 36,
  },
  emptyHeroSub: { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },

  cards: { flexDirection: "row", gap: 12 },
  gmailCard: { flex: 1, backgroundColor: C.ink, borderRadius: 16, padding: 16, gap: 8 },
  discoverCard: { flex: 1, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 8 },
  cardIconLabel: { fontSize: 22, color: C.white },
  cardTitle: { fontSize: 15, fontWeight: "700", color: C.white },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 17 },
  gmailBtn: { backgroundColor: C.teal, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  gmailBtnText: { color: C.white, fontWeight: "700", fontSize: 13 },
  discoverBtn: { borderWidth: 1.5, borderColor: C.indigo, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  discoverBtnText: { color: C.indigo, fontWeight: "700", fontSize: 13 },

  placeholderRow: { flexDirection: "row", gap: 12 },
  placeholderCard: { flex: 1, height: 110, borderRadius: 14, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border },
});
