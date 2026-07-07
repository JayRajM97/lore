import { Pressable, StyleSheet, Text, View } from "react-native";
import { Newsletter } from "../lib/types";
import { C, RADIUS, SHADOW } from "../lib/theme";
import { relativeDate } from "../lib/format";
import Avatar from "./Avatar";
import FrequencyBadge from "./FrequencyBadge";

export default function NewsletterCard({
  newsletter,
  selected,
  onToggle,
}: {
  newsletter: Newsletter;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onToggle}
    >
      <Avatar name={newsletter.sender_name} url={newsletter.sender_logo_url} size={44} />
      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {newsletter.sender_name}
        </Text>
        <View style={styles.meta}>
          <FrequencyBadge label={newsletter.frequency} />
          <Text style={styles.date}>· Last issue {relativeDate(newsletter.last_received_at)}</Text>
        </View>
      </View>
      <View style={[styles.check, selected && styles.checkOn]}>
        {selected && <Text style={styles.tick}>✓</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: RADIUS.card,
    // Border stays 1.5 (transparent) so toggling selection never shifts layout;
    // unselected cards read as soft shadowed cards instead of outlined ones.
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...(SHADOW.card as object),
  },
  cardOn: {
    borderColor: C.teal,
    backgroundColor: C.teal50,
  },
  center: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: "600", color: C.ink },
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { fontSize: 13, color: C.muted },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.teal, borderColor: C.teal },
  tick: { color: C.white, fontSize: 14, fontWeight: "700" },
});
