import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { useAuth } from "../../store/authStore";
import { getFollows, unfollow } from "../../lib/db";
import { Newsletter } from "../../lib/types";
import Avatar from "../../components/Avatar";
import { FadeInUp, PressableScale } from "../../components/anim";

const MAX_W = 680;

export default function Profile() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  const clear = useAuth((s) => s.clear);
  const [follows, setFollows] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getFollows(user.sub)
      .then(setFollows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  function signOut() {
    clear();
    router.replace("/(auth)/onboarding");
  }

  function addMore() {
    router.push(accessToken ? "/(auth)/scan" : "/(auth)/gmail");
  }

  async function removeFollow(nl: Newsletter) {
    if (!user) return;
    await unfollow(user.sub, nl.id).catch(console.error);
    setFollows((prev) => prev.filter((f) => f.id !== nl.id));
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.wrap} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <PressableScale style={styles.primaryBtn} onPress={() => router.replace("/(auth)/onboarding")}>
            <Text style={styles.primaryBtnText}>Sign in with Gmail</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrap} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>

          {/* Identity card */}
          <View style={styles.identityCard}>
            <Avatar name={user.name} url={user.picture} size={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </View>

          {!accessToken && (
            <PressableScale style={styles.expiredBanner} onPress={() => router.push("/(auth)/gmail")}>
              <Text style={styles.expiredText}>Reconnect Gmail to generate new episodes →</Text>
            </PressableScale>
          )}

          {/* Newsletters */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionHeading}>My Newsletters</Text>
              <Text style={styles.count}>{follows.length} following</Text>
            </View>

            {!loading && follows.length === 0 && (
              <Text style={styles.emptyHint}>No newsletters yet. Tap Add to scan your inbox.</Text>
            )}

            {follows.map((nl, i) => (
              <FadeInUp key={nl.id} delay={Math.min(i, 8) * 60}>
                <View style={styles.nlRow}>
                  <Pressable
                    style={styles.nlLeft}
                    onPress={() => router.push(`/newsletter/${encodeURIComponent(nl.id)}`)}
                  >
                    <Avatar name={nl.sender_name} url={nl.sender_logo_url} size={40} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.nlName} numberOfLines={1}>{nl.sender_name}</Text>
                      <Text style={styles.nlMeta}>{nl.frequency}</Text>
                    </View>
                  </Pressable>
                  <Pressable style={styles.unfollowBtn} onPress={() => removeFollow(nl)}>
                    <Text style={styles.unfollowText}>Remove</Text>
                  </Pressable>
                </View>
              </FadeInUp>
            ))}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <PressableScale style={styles.primaryBtn} onPress={addMore}>
              <Text style={styles.primaryBtnText}>+ Scan for more newsletters</Text>
            </PressableScale>
            <PressableScale style={styles.outlineBtn} onPress={signOut}>
              <Text style={styles.outlineBtnText}>Sign out</Text>
            </PressableScale>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },
  inner: { maxWidth: MAX_W, alignSelf: "center", width: "100%", padding: 16, gap: 20 },

  identityCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.white, borderRadius: RADIUS.card,
    padding: 16,
    ...(SHADOW.card as object),
  },
  name: { fontSize: 18, fontWeight: "700", color: C.ink },
  email: { fontSize: 13, color: C.muted },

  expiredBanner: {
    backgroundColor: C.amber50, borderRadius: RADIUS.btn,
    padding: 12, borderWidth: 1, borderColor: C.amber,
  },
  expiredText: { fontSize: 13, color: C.amber, textAlign: "center" },

  section: { gap: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeading: { fontSize: 20, fontWeight: "700", color: C.ink, fontFamily: SERIF },
  count: { fontSize: 13, color: C.muted },
  emptyHint: { fontSize: 14, color: C.muted, textAlign: "center", paddingVertical: 16 },

  nlRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.white, borderRadius: RADIUS.card,
    paddingVertical: 10, paddingHorizontal: 12,
    gap: 10,
    ...(SHADOW.card as object),
  },
  nlLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  nlName: { fontSize: 14, fontWeight: "500", color: C.ink },
  nlMeta: { fontSize: 12, color: C.muted },
  unfollowBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  unfollowText: { fontSize: 12, color: C.coral, fontWeight: "600" },

  actions: { gap: 10, marginTop: 4 },
  primaryBtn: {
    backgroundColor: C.teal, borderRadius: RADIUS.pill,
    paddingVertical: 15, alignItems: "center",
  },
  primaryBtnText: { color: C.white, fontWeight: "700", fontSize: 15 },
  outlineBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: RADIUS.btn,
    paddingVertical: 15, alignItems: "center",
  },
  outlineBtnText: { color: C.muted, fontWeight: "600", fontSize: 15 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: C.ink, fontFamily: SERIF },
});
