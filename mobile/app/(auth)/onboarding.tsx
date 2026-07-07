import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { FadeInUp, PressableScale } from "../../components/anim";

const MAX_W = 680;

export default function Onboarding() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inner}>

          {/* ── hero ── */}
          <FadeInUp style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroEmoji}>📖</Text>
            </View>
            <Text style={styles.heroTitle}>Your library is{"\n"}whispering...</Text>
            <Text style={styles.heroSub}>
              It looks a bit quiet in here! Lore works best when it's filled
              with the stories, essays, and newsletters you love.{"\n"}
              Ready to give your ears something to think about?
            </Text>
          </FadeInUp>

          {/* ── two CTA cards ── */}
          <View style={styles.cards}>
            {/* Connect Gmail */}
            <FadeInUp delay={60} style={styles.cardCol}>
              <PressableScale
                style={styles.gmailCard}
                onPress={() => router.push("/(auth)/gmail")}
              >
                <View style={styles.cardIconWrap}>
                  <Text style={styles.cardIconGmail}>✉</Text>
                </View>
                <Text style={styles.cardTitle}>Connect Gmail</Text>
                <Text style={styles.cardSub}>
                  We'll scan for newsletter subscriptions and turn them into your
                  personal audio feed.
                </Text>
                <View style={styles.gmailBtn}>
                  <Text style={styles.gmailBtnText}>Connect Account →</Text>
                </View>
              </PressableScale>
            </FadeInUp>

            {/* Discover */}
            <FadeInUp delay={120} style={styles.cardCol}>
              <PressableScale
                style={styles.discoverCard}
                onPress={() => router.push("/(auth)/gmail")}
              >
                <View style={[styles.cardIconWrap, styles.cardIconWrapLight]}>
                  <Text style={styles.cardIconDiscover}>◎</Text>
                </View>
                <Text style={[styles.cardTitle, styles.cardTitleOnLight]}>Discover New</Text>
                <Text style={[styles.cardSub, styles.cardSubOnLight]}>
                  Not sure where to start? Connect Gmail and we'll find the best
                  newsletters already in your inbox.
                </Text>
                <View style={styles.discoverBtn}>
                  <Text style={styles.discoverBtnText}>Get Started ✦</Text>
                </View>
              </PressableScale>
            </FadeInUp>
          </View>

          {/* ── placeholder sections ── */}
          <FadeInUp delay={180} style={styles.placeholderSection}>
            <View style={styles.placeholderHeader}>
              <Text style={styles.placeholderLabel}>Latest for You</Text>
              <Text style={styles.placeholderNothing}>NOTHING HERE YET</Text>
            </View>
            <View style={styles.placeholderRow}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.placeholderCard} />
              ))}
            </View>
          </FadeInUp>

          <FadeInUp delay={240} style={styles.placeholderSection}>
            <Text style={styles.placeholderLabel}>Up Next</Text>
            <View style={styles.upNextList}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.upNextRow}>
                  <View style={styles.upNextThumb} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={[styles.shimmer, { width: "60%", height: 10 }]} />
                    <View style={[styles.shimmer, { width: "40%", height: 8 }]} />
                  </View>
                </View>
              ))}
            </View>
          </FadeInUp>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 20, gap: 28 },

  // hero
  hero: { alignItems: "center", gap: 14, paddingVertical: 8 },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.teal, alignItems: "center", justifyContent: "center",
    ...(SHADOW.glow(C.teal) as object),
  },
  heroEmoji: { fontSize: 36 },
  heroTitle: {
    fontSize: 32, fontWeight: "800", color: C.ink, fontFamily: SERIF,
    textAlign: "center", letterSpacing: -0.5, lineHeight: 40,
  },
  heroSub: {
    fontSize: 15, color: C.muted, textAlign: "center",
    lineHeight: 22, paddingHorizontal: 4,
  },

  // cards
  cards: { flexDirection: "row", gap: 12 },
  cardCol: { flex: 1 },
  gmailCard: {
    backgroundColor: C.ink, borderRadius: RADIUS.card,
    padding: 18, gap: 8,
    ...(SHADOW.card as object),
  },
  discoverCard: {
    backgroundColor: C.white, borderRadius: RADIUS.card,
    padding: 18, gap: 8,
    ...(SHADOW.card as object),
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  cardIconWrapLight: { backgroundColor: C.surface },
  cardIconGmail: { fontSize: 18, color: C.white },
  cardIconDiscover: { fontSize: 18, color: C.ink },
  cardTitle: { fontSize: 17, fontWeight: "700", color: C.white },
  cardTitleOnLight: { color: C.ink },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 18 },
  cardSubOnLight: { color: C.muted },
  gmailBtn: {
    backgroundColor: C.teal, borderRadius: RADIUS.pill,
    paddingVertical: 12, alignItems: "center", marginTop: 4,
    ...(SHADOW.glow(C.teal) as object),
  },
  gmailBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },
  discoverBtn: {
    borderWidth: 1.5, borderColor: C.indigo, borderRadius: RADIUS.pill,
    paddingVertical: 12, alignItems: "center", marginTop: 4,
  },
  discoverBtnText: { color: C.indigo, fontWeight: "700", fontSize: 14 },

  // placeholder sections
  placeholderSection: { gap: 12 },
  placeholderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  placeholderLabel: { fontSize: 17, fontWeight: "700", color: C.ink },
  placeholderNothing: { fontSize: 11, color: C.muted, letterSpacing: 0.8 },
  placeholderRow: { flexDirection: "row", gap: 12 },
  placeholderCard: {
    flex: 1, height: 120, borderRadius: RADIUS.card,
    backgroundColor: C.surface,
  },
  upNextList: { gap: 10 },
  upNextRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: RADIUS.card, padding: 12,
  },
  upNextThumb: {
    width: 44, height: 44, borderRadius: RADIUS.chip, backgroundColor: C.border,
  },
  shimmer: { backgroundColor: C.border, borderRadius: RADIUS.pill },
});
