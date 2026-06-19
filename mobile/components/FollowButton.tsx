import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { C, RADIUS } from "../lib/theme";

type State = "follow" | "following";

/**
 * Follow / Following toggle with its own busy state. The parent owns the actual
 * follow/unfollow side effects (Firestore + sidecar); this just reflects status
 * and shows a spinner while the async work runs.
 */
export default function FollowButton({
  following,
  onFollow,
  onUnfollow,
  label,
}: {
  following: boolean;
  onFollow: () => Promise<void>;
  onUnfollow: () => Promise<void>;
  label?: string; // optional custom busy label, e.g. "Generating…"
}) {
  const [busy, setBusy] = useState(false);
  const state: State = following ? "following" : "follow";

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      await (following ? onUnfollow() : onFollow());
    } catch (e) {
      console.warn("[FollowButton]", e);
    } finally {
      setBusy(false);
    }
  }

  const filled = state === "following";
  return (
    <Pressable
      onPress={handle}
      disabled={busy}
      style={[styles.pill, filled ? styles.filled : styles.outline, busy && styles.busy]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={filled ? C.white : C.teal} />
      ) : (
        <Text style={[styles.text, filled ? styles.textFilled : styles.textOutline]}>
          {filled ? "Following ✓" : label ?? "Follow"}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 92,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  outline: { borderWidth: 1, borderColor: C.teal, backgroundColor: "transparent" },
  filled: { backgroundColor: C.teal },
  busy: { opacity: 0.7 },
  text: { fontSize: 13, fontWeight: "600" },
  textOutline: { color: C.teal },
  textFilled: { color: C.white },
});
