import { Pressable, StyleSheet, Text, View } from "react-native";
import { C, RADIUS, SHADOW } from "../lib/theme";

export type ViewMode = "cards" | "list";

// Cards ▦ / list ≣ segmented toggle used by Home and Library sections.
export default function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <View style={s.wrap}>
      {(["cards", "list"] as const).map((mode) => (
        <Pressable
          key={mode}
          onPress={() => onChange(mode)}
          style={[s.btn, value === mode && s.btnOn]}
          hitSlop={4}
        >
          <Text style={[s.icon, value === mode && s.iconOn]}>
            {mode === "cards" ? "▦" : "≣"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: RADIUS.pill,
    padding: 3,
    gap: 2,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  btnOn: { backgroundColor: C.white, ...(SHADOW.card as object) },
  icon: { fontSize: 13, color: C.muted },
  iconOn: { color: C.ink },
});
