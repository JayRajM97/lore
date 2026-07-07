import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text } from "react-native";
import { C, RADIUS } from "../lib/theme";
import { PressableScale } from "./anim";

/**
 * Follow / Following toggle with its own busy state. The parent owns the actual
 * follow/unfollow side effects (Firestore + sidecar); this just reflects status
 * and shows a spinner while the async work runs.
 *
 * Not following = solid teal pill; following = soft teal50 pill. The pill does a
 * small spring pulse whenever the follow state flips.
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

  // Pulse on follow/unfollow flip (skipped on first render).
  const pulse = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    pulse.setValue(0.85);
    Animated.spring(pulse, {
      toValue: 1,
      useNativeDriver: false,
      speed: 24,
      bounciness: 14,
    }).start();
  }, [following, pulse]);

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

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <PressableScale
        onPress={handle}
        disabled={busy}
        style={[styles.pill, following ? styles.following : styles.follow, busy && styles.busy]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={following ? C.teal : C.white} />
        ) : (
          <Text style={[styles.text, following ? styles.textFollowing : styles.textFollow]}>
            {following ? "Following ✓" : label ?? "Follow"}
          </Text>
        )}
      </PressableScale>
    </Animated.View>
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
  follow: { backgroundColor: C.teal },
  following: { backgroundColor: C.teal50 },
  busy: { opacity: 0.7 },
  text: { fontSize: 13, fontWeight: "600" },
  textFollow: { color: C.white },
  textFollowing: { color: C.teal },
});
