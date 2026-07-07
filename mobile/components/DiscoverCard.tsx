import { StyleSheet, Text, View } from "react-native";
import { C, RADIUS, SHADOW } from "../lib/theme";
import { PressableScale } from "./anim";
import { GlobalNewsletter } from "../lib/types";
import Avatar from "./Avatar";
import FrequencyBadge from "./FrequencyBadge";
import FollowButton from "./FollowButton";
import ListenerCount from "./ListenerCount";

/**
 * Public-catalog newsletter card. Distinct from NewsletterCard (the onboarding
 * checkbox card). `tile` = compact horizontal-scroll card; `row` = full-width.
 */
export default function DiscoverCard({
  newsletter,
  onPress,
  onFollow,
  onUnfollow,
  followLabel,
  variant = "row",
}: {
  newsletter: GlobalNewsletter;
  onPress?: () => void;
  onFollow: () => Promise<void>;
  onUnfollow: () => Promise<void>;
  followLabel?: string;
  variant?: "tile" | "row";
}) {
  const tile = variant === "tile";
  return (
    // NOTE: PressableScale puts `style` on its inner view; width 230 (tile) still
    // sizes the outer Pressable since Pressable hugs content.
    <PressableScale onPress={onPress} style={[styles.card, tile ? styles.tile : styles.row]}>
      <View style={styles.header}>
        <Avatar name={newsletter.sender_name} url={newsletter.logo_url} size={48} />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {newsletter.sender_name}
          </Text>
          {newsletter.frequency ? <FrequencyBadge label={newsletter.frequency} /> : null}
        </View>
      </View>

      <View style={styles.footer}>
        <ListenerCount count={newsletter.follower_count ?? 0} />
        <FollowButton
          following={!!newsletter.is_following}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          label={followLabel}
        />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 14,
    ...(SHADOW.card as object),
  },
  tile: { width: 230, marginRight: 12 },
  row: {},
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  meta: { flex: 1, gap: 6 },
  name: { fontSize: 15, fontWeight: "500", color: C.ink },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
