import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { useGoogleAuth, fetchGoogleUser } from "../../lib/auth";
import { useAuth } from "../../store/authStore";
import { signIntoFirebase } from "../../lib/firebaseAuth";

const FEATURES = [
  { icon: "⚡", label: "Smart Filtering", desc: "Only real newsletters — no notifications, no junk." },
  { icon: "✦", label: "Word Sync", desc: "Audio highlights every word as it's spoken." },
  { icon: "🔒", label: "Read-only access", desc: "We never read, store, or send your emails." },
];

export default function GmailConnect() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [request, response, promptAsync] = useGoogleAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type === "success") {
      const token = response.authentication?.accessToken;
      const idToken = response.authentication?.idToken;
      if (!token) {
        setError("No access token returned.");
        setBusy(false);
        return;
      }
      Promise.all([signIntoFirebase(idToken, token), fetchGoogleUser(token)])
        .then(([, user]) => {
          setSession(user, token);
          router.replace("/(auth)/scan");
        })
        .catch(() => {
          setError("Couldn't read your Google profile.");
          setBusy(false);
        });
    } else if (response?.type === "error" || response?.type === "dismiss") {
      setError(response.type === "error" ? "Couldn't connect Gmail. Try again." : null);
      setBusy(false);
    }
  }, [response]);

  async function connect() {
    setBusy(true);
    setError(null);
    await promptAsync();
  }

  return (
    <SafeAreaView style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>L</Text>
          </View>
          <Text style={styles.logoText}>Lore!</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Your personal podcast,{"\n"}from your inbox</Text>
          <Text style={styles.heroSub}>
            Connect Gmail once. Lore scans your newsletters and converts them into
            audio — ready to listen on your commute, run, or morning routine.
          </Text>
        </View>

        {/* Feature cards */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Error */}
        {error && (
          <Pressable onPress={connect}>
            <Text style={styles.error}>{error} Tap to retry.</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* CTA pinned to bottom */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, (busy || !request) && styles.ctaBusy]}
          onPress={connect}
          disabled={busy || !request}
        >
          {busy ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.ctaText}>Connect Gmail</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 16, gap: 32, paddingBottom: 16 },

  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.indigo, alignItems: "center", justifyContent: "center",
  },
  logoMarkText: { color: C.white, fontSize: 18, fontWeight: "800" },
  logoText: { fontSize: 20, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },

  hero: { gap: 12 },
  heroTitle: { fontSize: 32, fontWeight: "800", color: C.ink, letterSpacing: -0.6, lineHeight: 38 },
  heroSub: { fontSize: 15, color: C.muted, lineHeight: 22 },

  features: { gap: 16 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  featureIcon: { fontSize: 20 },
  featureText: { flex: 1, gap: 2 },
  featureLabel: { fontSize: 15, fontWeight: "700", color: C.ink },
  featureDesc: { fontSize: 13, color: C.muted, lineHeight: 18 },

  error: { fontSize: 14, color: C.coral, textAlign: "center" },

  footer: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  cta: {
    backgroundColor: C.indigo, borderRadius: 14,
    paddingVertical: 17, alignItems: "center",
    shadowColor: C.indigo, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
});
