import { StyleSheet, View } from "react-native";
import { C } from "../lib/theme";

// Static bar visualizer; fills teal up to `progress` (0..1), rest is border.
const BARS = Array.from({ length: 42 }, (_, i) =>
  6 + Math.round(28 * Math.abs(Math.sin(i * 0.7) + 0.4 * Math.sin(i * 1.9)))
);

export default function WaveformBars({ progress = 0 }: { progress?: number }) {
  return (
    <View style={styles.row}>
      {BARS.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            backgroundColor: i / BARS.length <= progress ? C.teal : C.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 40,
  },
});
