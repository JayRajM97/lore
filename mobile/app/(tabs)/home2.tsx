/**
 * home2.tsx — Redesigned Home Feed (mweb-compatible, animated)
 * Swap with home.tsx when ready.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { Episode, Newsletter } from "../../lib/types";
import { humanDuration, relativeDate, greeting, episodeDate } from "../../lib/format";
import { getEpisodes, getFollows } from "../../lib/db";
import { useAuth } from "../../store/authStore";
import { usePlayer } from "../../store/playerStore";
import Avatar from "../../components/Avatar";

const GREEN = "#1DB954";
const MAX_W = 720;

// ─── Responsive breakpoint ────────────────────────────────────────────────────
function useIsMd() {
  const { width } = useWindowDimensions();
  return width >= 600;
}

// ─── Staggered fade + slide-up entrance ──────────────────────────────────────
function FadeSlide({
  delay = 0,
  children,
}: {
  delay?: number;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── Animated waveform ───────────────────────────────────────────────────────
const WAVE_H = [10, 18, 30, 14, 24, 9, 26, 12, 8, 20, 16, 28, 11, 21, 15, 24, 10, 18];

function Waveform({ progress = 0.4 }: { progress?: number }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const cutoff = Math.floor(WAVE_H.length * progress);
  return (
    <View style={wv.row}>
      {WAVE_H.map((h, i) =>
        i < cutoff ? (
          <Animated.View
            key={i}
            style={[wv.bar, { height: h, backgroundColor: GREEN, opacity: pulse }]}
          />
        ) : (
          <View key={i} style={[wv.bar, { height: h, backgroundColor: "#DFE1E6" }]} />
        )
      )}
    </View>
  );
}

const wv = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3, height: 36 },
  bar: { width: 3, borderRadius: 2 },
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: w as any,
        height: h,
        borderRadius: r,
        backgroundColor: C.surface,
        opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] }),
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <View style={{ gap: 20, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Skeleton w={80} h={22} r={6} />
        <Skeleton w={30} h={30} r={15} />
      </View>
      <View style={{ gap: 6 }}>
        <Skeleton w="70%" h={32} r={8} />
        <Skeleton w="50%" h={18} r={6} />
      </View>
      <Skeleton w="100%" h={160} r={18} />
      <View style={{ gap: 8 }}>
        <Skeleton w={80} h={20} r={6} />
        {[0, 1, 2].map((i) => <Skeleton key={i} w="100%" h={72} r={14} />)}
      </View>
    </View>
  );
}

// ─── Animated press scale ─────────────────────────────────────────────────────
function ScalePress({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, {
      toValue: 0.975,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }
  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Ready banner ─────────────────────────────────────────────────────────────
function ReadyBanner({ visible }: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View
      style={[
        s.readyBanner,
        {
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
        },
      ]}
    >
      <Text style={s.readyBannerIcon}>✓</Text>
      <Text style={s.readyBannerText}>Your audio is ready to listen</Text>
    </Animated.View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function Home2() {
  const router = useRouter();
  const user = useAuth((u) => u.user);
  const accessToken = useAuth((u) => u.accessToken);
  const play = usePlayer((p) => p.play);
  const isMd = useIsMd();

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [follows, setFollows] = useState<Newsletter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [filter, setFilter] = useState<"all" | "newsletters">("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [firestoreEps, fol] = await Promise.all([
        user
          ? getEpisodes(user.sub).catch(() => [] as Episode[])
          : Promise.resolve([] as Episode[]),
        user
          ? getFollows(user.sub).catch(() => [] as Newsletter[])
          : Promise.resolve([] as Newsletter[]),
      ]);
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
      if (!fol.length) {
        // No follows yet — run the full scan/discover flow
        router.push("/(auth)/scan");
        return;
      }
      (globalThis as any).__lore_generating = fol;
      router.push("/(auth)/generating");
    } finally {
      setSyncing(false);
    }
  }

  const featured = episodes[0] ?? null;
  const queue = episodes.slice(1, 4);
  const latest = episodes.slice(1);

  if (!loaded) {
    return (
      <SafeAreaView style={s.wrap} edges={["top"]}>
        <TopBar user={user} onSettings={() => router.push("/profile")} />
        <LoadingSkeleton />
      </SafeAreaView>
    );
    // syncing not wired here — loading state, user can't interact
  }

  if (!user) {
    return (
      <SafeAreaView style={s.wrap} edges={["top"]}>
        <EmptyDashboard
          onConnect={() => router.push("/(auth)/gmail")}
          onSettings={() => router.push("/profile")}
        />
      </SafeAreaView>
    );
  }

  if (episodes.length === 0) {
    return (
      <SafeAreaView style={s.wrap} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.inner}>
            <TopBar
            user={user}
            onSettings={() => router.push("/profile")}
            onSync={syncLatest}
            syncing={syncing}
          />
            {!accessToken && (
              <FadeSlide delay={80}>
                <TokenBanner onPress={() => router.push("/(auth)/gmail")} />
              </FadeSlide>
            )}
            <FadeSlide delay={140}>
              <NoEpisodesState
                follows={follows}
                onGenerate={() => router.push("/(auth)/scan")}
              />
            </FadeSlide>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.wrap} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.inner}>

          {/* Top bar */}
          <TopBar
            user={user}
            onSettings={() => router.push("/profile")}
            onSync={syncLatest}
            syncing={syncing}
          />

          <ReadyBanner visible={showReadyBanner} />

          {!accessToken && (
            <FadeSlide delay={60}>
              <TokenBanner onPress={() => router.push("/(auth)/gmail")} />
            </FadeSlide>
          )}

          {/* Greeting */}
          <FadeSlide delay={80}>
            <View style={s.greetWrap}>
              <Text style={s.greetText}>{greeting()}.</Text>
              <Text style={s.greetSub}>Ready to dive back into your reading queue?</Text>
            </View>
          </FadeSlide>

          {/* Featured */}
          {featured && (
            <FadeSlide delay={160}>
              <ContinueCard ep={featured} onPlay={() => openPlayer(featured)} />
            </FadeSlide>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <FadeSlide delay={240}>
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionHeading}>Queue</Text>
                  <Pressable onPress={() => router.push("/library")}>
                    <Text style={s.viewAll}>View All</Text>
                  </Pressable>
                </View>
                <View style={s.queueList}>
                  {queue.map((ep, i) => (
                    <FadeSlide key={ep.id} delay={260 + i * 60}>
                      <QueueItem ep={ep} onPress={() => openPlayer(ep)} />
                    </FadeSlide>
                  ))}
                </View>
              </View>
            </FadeSlide>
          )}

          {/* Latest articles */}
          {latest.length > 0 && (
            <FadeSlide delay={360}>
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionHeading}>Latest Articles</Text>
                  <View style={s.filterRow}>
                    <Pressable
                      style={[s.filterChip, filter === "all" && s.filterChipOn]}
                      onPress={() => setFilter("all")}
                    >
                      <Text style={[s.filterChipText, filter === "all" && s.filterChipTextOn]}>
                        All
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[s.filterChip, filter === "newsletters" && s.filterChipOn]}
                      onPress={() => setFilter("newsletters")}
                    >
                      <Text
                        style={[
                          s.filterChipText,
                          filter === "newsletters" && s.filterChipTextOn,
                        ]}
                      >
                        Newsletters
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={s.divider} />
                {/* 2-col on md+, single col on mobile */}
                <View style={[s.articleGrid, isMd && s.articleGridMd]}>
                  {latest.slice(0, 6).map((ep, i) => (
                    <FadeSlide key={ep.id} delay={380 + i * 50}>
                      <ArticleCard
                        ep={ep}
                        onPlay={() => openPlayer(ep)}
                        fullWidth={!isMd}
                      />
                    </FadeSlide>
                  ))}
                </View>
              </View>
            </FadeSlide>
          )}

          {/* My Newsletters */}
          {follows.length > 0 && (
            <FadeSlide delay={460}>
              <View style={s.section}>
                <Text style={s.sectionHeading}>My Newsletters</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10 }}
                >
                  {follows.map((nl) => (
                    <Pressable
                      key={nl.id}
                      style={s.nlPill}
                      onPress={() =>
                        router.push(`/newsletter/${encodeURIComponent(nl.id)}`)
                      }
                    >
                      <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={28} />
                      <Text style={s.nlPillName} numberOfLines={1}>
                        {nl.sender_name}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={[s.nlPill, s.nlAddPill]}
                    onPress={() => router.push("/(auth)/scan")}
                  >
                    <View style={s.nlAddCircle}>
                      <Text style={s.nlAddPlus}>+</Text>
                    </View>
                    <Text style={s.nlPillName}>Add more</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </FadeSlide>
          )}

          <View style={{ height: 16 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({
  user,
  onSettings,
  onSync,
  syncing,
}: {
  user: any;
  onSettings: () => void;
  onSync?: () => void;
  syncing?: boolean;
}) {
  return (
    <View style={s.topBar}>
      <Text style={s.topBarLogo}>Lore!</Text>
      <View style={s.topBarRight}>
        {onSync && (
          <Pressable style={s.syncBtn} onPress={onSync} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator size="small" color={C.teal} />
            ) : (
              <Text style={s.syncBtnText}>↻ Sync</Text>
            )}
          </Pressable>
        )}
        <Pressable onPress={onSettings} style={s.topBarAvatarWrap}>
          <Avatar name={user?.name ?? "?"} url={user?.picture} size={30} />
        </Pressable>
      </View>
    </View>
  );
}

function TokenBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={s.tokenBanner} onPress={onPress}>
      <Text style={s.tokenText}>Reconnect Gmail to generate new episodes →</Text>
    </Pressable>
  );
}

// ─── Continue Listening card ──────────────────────────────────────────────────
function ContinueCard({ ep, onPlay }: { ep: Episode; onPlay: () => void }) {
  const progress =
    ep.playback_position_s && ep.audio_duration_s
      ? ep.playback_position_s / ep.audio_duration_s
      : 0.35;
  const remaining =
    ep.playback_position_s && ep.audio_duration_s
      ? humanDuration(ep.audio_duration_s - ep.playback_position_s)
      : humanDuration(ep.audio_duration_s);

  return (
    <ScalePress onPress={onPlay} style={s.continueCard}>
      {/* Top row */}
      <View style={s.cardTopRow}>
        <View style={s.inProgressBadge}>
          <Text style={s.inProgressText}>
            {ep.playback_position_s
              ? `In Progress · ${remaining} remaining`
              : "New"}
          </Text>
        </View>
        <View style={s.cardCatBadge}>
          <Text style={s.cardCatText}>{ep.sender_name.split(" ")[0]}</Text>
        </View>
      </View>

      {/* Sender */}
      <View style={s.cardSenderRow}>
        <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={20} />
        <Text style={s.cardSenderName}>{ep.sender_name.toUpperCase()}</Text>
        <Text style={s.cardSenderDot}>·</Text>
        <Text style={s.cardDuration}>{humanDuration(ep.audio_duration_s)}</Text>
      </View>

      {/* Title */}
      <Text style={s.cardTitle} numberOfLines={3}>{ep.subject}</Text>

      {/* Preview */}
      {ep.raw_text && (
        <Text style={s.cardPreview} numberOfLines={2}>
          {ep.raw_text.slice(0, 130)}…
        </Text>
      )}

      {/* Play + waveform */}
      <View style={s.cardBottomRow}>
        <View style={s.playBtn}>
          <Text style={s.playBtnIcon}>▶</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Waveform progress={progress} />
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
      </View>
    </ScalePress>
  );
}

// ─── Queue item ───────────────────────────────────────────────────────────────
function QueueItem({ ep, onPress }: { ep: Episode; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start()
      }
    >
      <Animated.View style={[s.queueRow, { transform: [{ scale }] }]}>
        <View style={s.queueThumb}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={60} />
          <View style={s.queueThumbOverlay}>
            <Text style={s.queueThumbPlay}>▶</Text>
          </View>
        </View>
        <View style={s.queueInfo}>
          <Text style={s.queueSender} numberOfLines={1}>{ep.sender_name}</Text>
          <Text style={s.queueTitle} numberOfLines={2}>{ep.subject}</Text>
          <View style={s.queueMeta}>
            <Text style={s.queueDur}>{humanDuration(ep.audio_duration_s)}</Text>
            {ep.received_at ? <Text style={s.queueDate}>{episodeDate(ep.received_at)}</Text> : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({
  ep,
  onPlay,
  fullWidth,
}: {
  ep: Episode;
  onPlay: () => void;
  fullWidth?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      onPress={onPlay}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start()
      }
      style={fullWidth ? undefined : { flex: 1 }}
    >
      <Animated.View style={[s.articleCard, { transform: [{ scale }] }]}>
        {/* Header */}
        <View style={s.articleHeader}>
          <Avatar name={ep.sender_name} url={ep.sender_logo_url} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={s.articleSource} numberOfLines={1}>{ep.sender_name}</Text>
            <Text style={s.articleDate}>{episodeDate(ep.received_at)}</Text>
          </View>
          <View style={s.articleMore}>
            <Text style={s.articleMoreText}>⋯</Text>
          </View>
        </View>

        {/* Content */}
        <Text style={s.articleTitle} numberOfLines={2}>{ep.subject}</Text>
        {ep.raw_text && (
          <Text style={s.articlePreview} numberOfLines={2}>
            {ep.raw_text.slice(0, 100)}…
          </Text>
        )}

        {/* Footer */}
        <View style={s.articleFooter}>
          <View style={s.durationChip}>
            <Text style={s.durationChipText}>⏱ {humanDuration(ep.audio_duration_s)}</Text>
          </View>
          <View style={s.listenBtn}>
            <Text style={s.listenBtnIcon}>▶</Text>
            <Text style={s.listenBtnText}>Listen</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── No episodes ──────────────────────────────────────────────────────────────
function NoEpisodesState({
  follows,
  onGenerate,
}: {
  follows: Newsletter[];
  onGenerate: () => void;
}) {
  return (
    <View style={{ gap: 20 }}>
      {follows.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionHeading}>My Newsletters</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {follows.map((nl) => (
              <View key={nl.id} style={s.nlPill}>
                <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={28} />
                <Text style={s.nlPillName} numberOfLines={1}>{nl.sender_name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={s.noEpHero}>
        <Text style={s.noEpEmoji}>🎧</Text>
        <Text style={s.noEpTitle}>No podcasts yet</Text>
        <Text style={s.noEpSub}>
          Select newsletters and generate audio to fill your feed.
        </Text>
        <Pressable style={s.generateBtn} onPress={onGenerate}>
          <Text style={s.generateBtnText}>Generate podcasts</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Empty dashboard (no Gmail) ───────────────────────────────────────────────
function EmptyDashboard({
  onConnect,
  onSettings,
}: {
  onConnect: () => void;
  onSettings: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <View style={s.inner}>
        <TopBar user={null} onSettings={onSettings} />

        <FadeSlide delay={80}>
          <View style={s.greetWrap}>
            <Text style={s.greetText}>{greeting()}.</Text>
            <Text style={s.greetSub}>Connect Gmail to start listening.</Text>
          </View>
        </FadeSlide>

        <FadeSlide delay={160}>
          <View style={s.emptyCards}>
            <Pressable style={s.gmailCard} onPress={onConnect}>
              <Text style={s.emptyCardIcon}>✉</Text>
              <Text style={s.emptyCardTitle}>Connect Gmail</Text>
              <Text style={s.emptyCardSub}>
                We'll scan for newsletters and turn them into your personal audio feed.
              </Text>
              <View style={s.gmailCta}>
                <Text style={s.gmailCtaText}>Connect Account →</Text>
              </View>
            </Pressable>
            <Pressable style={s.discoverCard} onPress={onConnect}>
              <Text style={[s.emptyCardIcon, { color: C.ink }]}>◎</Text>
              <Text style={[s.emptyCardTitle, { color: C.ink }]}>Discover New</Text>
              <Text style={[s.emptyCardSub, { color: C.muted }]}>
                Connect Gmail and we'll find the best newsletters already in your inbox.
              </Text>
              <View style={s.discoverCta}>
                <Text style={s.discoverCtaText}>Get Started ✦</Text>
              </View>
            </Pressable>
          </View>
        </FadeSlide>

        <FadeSlide delay={240}>
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionHeading}>Latest for You</Text>
              <Text style={s.nothingYet}>NOTHING HERE YET</Text>
            </View>
            <View style={s.placeholderGrid}>
              <View style={s.placeholderCard} />
              <View style={s.placeholderCard} />
            </View>
          </View>
        </FadeSlide>
      </View>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: {
    maxWidth: MAX_W,
    alignSelf: "center",
    width: "100%",
    padding: 16,
    gap: 20,
    // mweb: ensure full-width on narrow and centered on wide
    ...(Platform.OS === "web" ? { paddingHorizontal: 24 } : {}),
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  topBarLogo: {
    fontSize: 22,
    fontWeight: "800",
    color: C.indigo,
    letterSpacing: -0.5,
  },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  topBarIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: C.border,
  },
  topBarIconText: { fontSize: 17, color: C.muted },
  topBarAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: C.border,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: C.teal50,
    borderWidth: 1,
    borderColor: C.teal,
    minWidth: 72,
    justifyContent: "center",
  },
  syncBtnText: { fontSize: 13, fontWeight: "700", color: C.teal },

  // Banners
  readyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: GREEN,
  },
  readyBannerIcon: { fontSize: 16, color: GREEN },
  readyBannerText: { fontSize: 14, fontWeight: "600", color: GREEN },

  tokenBanner: {
    backgroundColor: C.amber50,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.amber,
  },
  tokenText: { fontSize: 13, color: C.amber, textAlign: "center" },

  // Greeting
  greetWrap: { gap: 4 },
  greetText: {
    fontSize: 34,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.6,
    lineHeight: 40,
  },
  greetSub: { fontSize: 16, color: C.muted, lineHeight: 24 },

  // Sections
  section: { gap: 12 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  viewAll: { fontSize: 13, color: GREEN, fontWeight: "600" },
  nothingYet: { fontSize: 11, color: C.muted, letterSpacing: 0.8 },
  divider: { height: 0.5, backgroundColor: C.border },

  // Filter chips
  filterRow: { flexDirection: "row", gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  filterChipOn: { backgroundColor: C.ink },
  filterChipText: { fontSize: 12, fontWeight: "600", color: C.muted },
  filterChipTextOn: { color: C.white },

  // Continue card (dark)
  continueCard: {
    backgroundColor: C.ink,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    shadowColor: C.ink,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inProgressBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inProgressText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.2,
  },
  cardCatBadge: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardCatText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
  },
  cardSenderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardSenderName: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
  },
  cardSenderDot: { color: "rgba(255,255,255,0.25)", fontSize: 12 },
  cardDuration: { fontSize: 11, color: "rgba(255,255,255,0.4)" },
  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: C.white,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  cardPreview: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    lineHeight: 20,
  },
  cardBottomRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    flexShrink: 0,
  },
  playBtnIcon: { color: "#000", fontSize: 18, marginLeft: 2 },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 4,
  },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: GREEN },

  // Queue
  queueList: { gap: 10 },
  queueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 14,
  },
  queueThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  queueThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  queueThumbPlay: { color: C.white, fontSize: 14 },
  queueInfo: { flex: 1, gap: 3, paddingTop: 2 },
  queueSender: {
    fontSize: 12,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 0.2,
  },
  queueTitle: { fontSize: 15, fontWeight: "600", color: C.ink, lineHeight: 20 },
  queueMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  queueDur: { fontSize: 12, color: C.muted },
  queueDate: { fontSize: 12, color: C.muted },

  // Article grid — responsive
  articleGrid: { gap: 12 },
  articleGridMd: { flexDirection: "row", flexWrap: "wrap" },
  articleCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  articleHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  articleSource: { fontSize: 13, fontWeight: "700", color: C.ink },
  articleDate: { fontSize: 11, color: C.muted, marginTop: 1 },
  articleMore: { padding: 4 },
  articleMoreText: { fontSize: 16, color: C.muted },
  articleTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.ink,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  articlePreview: { fontSize: 14, color: C.muted, lineHeight: 20 },
  articleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.surface,
    paddingTop: 10,
    marginTop: 2,
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.surface,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  durationChipText: { fontSize: 12, color: C.ink, fontWeight: "500" },
  listenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.border,
  },
  listenBtnIcon: { fontSize: 12, color: C.ink },
  listenBtnText: { fontSize: 14, fontWeight: "600", color: C.ink },

  // Newsletter pills
  nlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: C.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nlPillName: { fontSize: 13, fontWeight: "500", color: C.ink },
  nlAddPill: { borderStyle: "dashed" },
  nlAddCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  nlAddPlus: { fontSize: 18, color: C.muted },

  // No episodes
  noEpHero: { alignItems: "center", gap: 10, paddingVertical: 28 },
  noEpEmoji: { fontSize: 44 },
  noEpTitle: { fontSize: 18, fontWeight: "700", color: C.ink },
  noEpSub: { fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 },
  generateBtn: {
    marginTop: 4,
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  generateBtnText: { color: C.white, fontWeight: "700", fontSize: 15 },

  // Empty dashboard
  emptyCards: { flexDirection: "row", gap: 12 },
  gmailCard: {
    flex: 1,
    backgroundColor: C.ink,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  discoverCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  emptyCardIcon: { fontSize: 22, color: C.white },
  emptyCardTitle: { fontSize: 15, fontWeight: "700", color: C.white },
  emptyCardSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 17 },
  gmailCta: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  gmailCtaText: { color: C.white, fontWeight: "700", fontSize: 13 },
  discoverCta: {
    borderWidth: 1.5,
    borderColor: C.indigo,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 4,
  },
  discoverCtaText: { color: C.indigo, fontWeight: "700", fontSize: 13 },

  placeholderGrid: { flexDirection: "row", gap: 12 },
  placeholderCard: {
    flex: 1,
    height: 110,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.border,
  },
});
