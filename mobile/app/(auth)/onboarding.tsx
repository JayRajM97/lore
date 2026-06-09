import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";

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
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroEmoji}>📖</Text>
            </View>
            <Text style={styles.heroTitle}>Your library is{"\n"}whispering...</Text>
            <Text style={styles.heroSub}>
              It looks a bit quiet in here! Lore works best when it's filled
              with the stories, essays, and newsletters you love.{"\n"}
              Ready to give your ears something to think about?
            </Text>
          </View>

          {/* ── two CTA cards ── */}
          <View style={styles.cards}>
            {/* Connect Gmail */}
            <Pressable
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
            </Pressable>

            {/* Discover */}
            <Pressable
              style={styles.discoverCard}
              onPress={() => router.push("/(auth)/gmail")}
            >
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardIconDiscover}>◎</Text>
              </View>
              <Text style={styles.cardTitle}>Discover New</Text>
              <Text style={styles.cardSub}>
                Not sure where to start? Connect Gmail and we'll find the best
                newsletters already in your inbox.
              </Text>
              <View style={styles.discoverBtn}>
                <Text style={styles.discoverBtnText}>Get Started ✦</Text>
              </View>
            </Pressable>
          </View>

          {/* ── placeholder sections ── */}
          <View style={styles.placeholderSection}>
            <View style={styles.placeholderHeader}>
              <Text style={styles.placeholderLabel}>Latest for You</Text>
              <Text style={styles.placeholderNothing}>NOTHING HERE YET</Text>
            </View>
            <View style={styles.placeholderRow}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.placeholderCard} />
              ))}
            </View>
          </View>

          <View style={styles.placeholderSection}>
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
          </View>
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
  },
  heroEmoji: { fontSize: 36 },
  heroTitle: {
    fontSize: 32, fontWeight: "800", color: C.ink,
    textAlign: "center", letterSpacing: -0.5, lineHeight: 38,
  },
  heroSub: {
    fontSize: 15, color: C.muted, textAlign: "center",
    lineHeight: 22, paddingHorizontal: 4,
  },

  // cards
  cards: { flexDirection: "row", gap: 12 },
  gmailCard: {
    flex: 1, backgroundColor: C.ink, borderRadius: 16,
    padding: 18, gap: 8,
  },
  discoverCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 18, gap: 8,
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  cardIconGmail: { fontSize: 18, color: C.white },
  cardIconDiscover: { fontSize: 18, color: C.ink },
  cardTitle: { fontSize: 17, fontWeight: "700", color: C.white },
  cardSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 18 },
  gmailBtn: {
    backgroundColor: C.teal, borderRadius: 10,
    paddingVertical: 12, alignItems: "center", marginTop: 4,
  },
  gmailBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },

  // discover card overrides for light bg
  discoverCard2: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1 },
  discoverBtn: {
    borderWidth: 1.5, borderColor: C.indigo, borderRadius: 10,
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
    flex: 1, height: 120, borderRadius: 14,
    backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
  },
  upNextList: { gap: 10 },
  upNextRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
  },
  upNextThumb: {
    width: 44, height: 44, borderRadius: 8, backgroundColor: C.border,
  },
  shimmer: { backgroundColor: C.border, borderRadius: 4 },
});
