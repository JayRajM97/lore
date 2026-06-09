import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { C } from "../../lib/theme";
import { useGoogleAuth, fetchGoogleUser } from "../../lib/auth";
import { useAuth } from "../../store/authStore";
import { signIntoFirebase } from "../../lib/firebaseAuth";

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
      // Sign into Firebase so Storage security rules (request.auth != null) pass
      signIntoFirebase(idToken, token);
      fetchGoogleUser(token)
        .then((user) => {
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
      <View style={styles.body}>
        <Text style={styles.logo}>Lore</Text>
        <Text style={styles.h1}>Connect your Gmail</Text>
        <Text style={styles.p}>We scan the last 30 days and turn your newsletters into audio.</Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, (busy || !request) && { opacity: 0.7 }]}
          onPress={connect}
          disabled={busy || !request}
        >
          {busy ? <ActivityIndicator color={C.teal50} /> : <Text style={styles.ctaText}>Connect Gmail</Text>}
        </Pressable>
        <Text style={styles.reassure}>🔒 Read-only access. We only see newsletters.</Text>
        {error && (
          <Pressable onPress={connect}>
            <Text style={styles.error}>{error}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, justifyContent: "space-between" },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  logo: { fontSize: 22, fontWeight: "700", color: C.indigo, marginBottom: 12 },
  h1: { fontSize: 28, fontWeight: "600", color: C.ink },
  p: { fontSize: 16, color: C.muted, lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 36, gap: 12 },
  cta: { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  ctaText: { color: C.teal50, fontWeight: "600", fontSize: 16 },
  reassure: { textAlign: "center", fontSize: 13, color: C.muted },
  error: { textAlign: "center", fontSize: 13, color: C.coral, marginTop: 4 },
});
