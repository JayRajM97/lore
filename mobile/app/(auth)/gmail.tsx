import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, RADIUS, SERIF, SHADOW } from "../../lib/theme";
import { FadeInUp, PressableScale } from "../../components/anim";
import { Platform } from "react-native";
import { useGoogleAuth, WEB_REDIRECT_URI, NATIVE_REDIRECT_URI } from "../../lib/auth";
import { exchangeCode } from "../../lib/tokens";
import { GOOGLE_IOS_CLIENT_ID } from "../../lib/config";
import { useAuth } from "../../store/authStore";
import { signIntoFirebase } from "../../lib/firebaseAuth";

// Google's consent screen shows Gmail access as an UNCHECKED checkbox for
// unverified apps — users often miss it. Verify the grant before proceeding.
async function hasGmailScope(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
      const finish = async () => {
        // Code flow on BOTH platforms: the sidecar exchanges the code, stores
        // the refresh token, returns access token + identity. Connect once.
        const code = (response as any).params?.code;
        if (!code) throw new Error("No auth code returned");
        const isWeb = Platform.OS === "web";
        const r = await exchangeCode(
          code,
          isWeb ? WEB_REDIRECT_URI : NATIVE_REDIRECT_URI,
          request?.codeVerifier ?? undefined,
          isWeb ? undefined : GOOGLE_IOS_CLIENT_ID
        );
        // Guard: token valid but Gmail checkbox not ticked on the consent
        // screen → tell the user exactly what to fix instead of failing later.
        if (!(await hasGmailScope(r.accessToken))) {
          setError("Google didn't grant Gmail access. Tap Connect again and tick the Gmail checkbox on the consent screen.");
          setBusy(false);
          return;
        }
        await signIntoFirebase(r.idToken ?? undefined, r.accessToken).catch(() => {});
        setSession(r.user, r.accessToken);
        router.replace("/(auth)/scan");
      };
      finish().catch((e) => {
        setError(`Couldn't connect Gmail (${String(e?.message ?? e).slice(0, 80)}). Try again.`);
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
        <FadeInUp style={styles.hero}>
          <Text style={styles.heroTitle}>Your personal podcast,{"\n"}from your inbox</Text>
          <Text style={styles.heroSub}>
            Connect Gmail once. Lore scans your newsletters and converts them into
            audio — ready to listen on your commute, run, or morning routine.
          </Text>
        </FadeInUp>

        {/* Feature cards */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <FadeInUp key={f.label} delay={120 + Math.min(i, 8) * 60} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </FadeInUp>
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
        <PressableScale
          style={[styles.cta, (busy || !request) && styles.ctaBusy]}
          onPress={connect}
          disabled={busy || !request}
          to={0.95}
        >
          {busy ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.ctaText}>Connect Gmail</Text>
          )}
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 16, gap: 32, paddingBottom: 16 },

  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoMark: {
    width: 36, height: 36, borderRadius: RADIUS.chip,
    backgroundColor: C.indigo, alignItems: "center", justifyContent: "center",
  },
  logoMarkText: { color: C.white, fontSize: 18, fontWeight: "800" },
  logoText: { fontSize: 20, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },

  hero: { gap: 12 },
  heroTitle: { fontSize: 32, fontWeight: "800", color: C.ink, fontFamily: SERIF, letterSpacing: -0.6, lineHeight: 40 },
  heroSub: { fontSize: 15, color: C.muted, lineHeight: 22 },

  features: { gap: 16 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: RADIUS.chip,
    backgroundColor: C.white,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
    ...(SHADOW.card as object),
  },
  featureIcon: { fontSize: 20 },
  featureText: { flex: 1, gap: 2 },
  featureLabel: { fontSize: 15, fontWeight: "700", color: C.ink },
  featureDesc: { fontSize: 13, color: C.muted, lineHeight: 18 },

  error: { fontSize: 14, color: C.coral, textAlign: "center" },

  footer: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  cta: {
    backgroundColor: C.indigo, borderRadius: RADIUS.pill,
    paddingVertical: 17, alignItems: "center",
    ...(SHADOW.glow(C.indigo) as object),
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: { color: C.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
});
