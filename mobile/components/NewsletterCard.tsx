import { Pressable, StyleSheet, Text, View } from "react-native";
import { Newsletter } from "../lib/types";
import { C } from "../lib/theme";
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
    <Pressable style={styles.card} onPress={onToggle}>
      <Avatar name={newsletter.sender_name} url={newsletter.sender_logo_url} size={44} />
      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {newsletter.sender_name}
        </Text>
        <Text style={styles.date}>Last issue {relativeDate(newsletter.last_received_at)}</Text>
        <View style={{ marginTop: 6 }}>
          <FrequencyBadge label={newsletter.frequency} />
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
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    padding: 12,
  },
  center: { flex: 1 },
  name: { fontSize: 15, fontWeight: "500", color: C.ink },
  date: { fontSize: 13, color: C.muted, marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.teal, borderColor: C.teal },
  tick: { color: C.white, fontSize: 14, fontWeight: "700" },
});
