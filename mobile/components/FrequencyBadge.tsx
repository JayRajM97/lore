import { StyleSheet, Text, View } from "react-native";
import { C } from "../lib/theme";

export default function FrequencyBadge({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: C.surface,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: { color: C.muted, fontSize: 12, fontWeight: "500" },
});
