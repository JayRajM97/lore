import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { C } from "../lib/theme";

// Bar visualizer; fills teal up to `progress` (0..1), rest is border. Bars
// gently oscillate between ~45% and 100% of their base height.
const BARS = Array.from({ length: 42 }, (_, i) =>
  6 + Math.round(28 * Math.abs(Math.sin(i * 0.7) + 0.4 * Math.sin(i * 1.9)))
);

// A small pool of looping phase values shared across bars (bar i uses phase
// i % PHASES) — staggered starts + different periods keep neighbours out of
// sync without running 42 separate JS-driven loops.
const PHASES = 6;

export default function WaveformBars({ progress = 0 }: { progress?: number }) {
  const phases = useRef(
    Array.from({ length: PHASES }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Height can't run on the native driver.
    const loops = phases.map((v, p) =>
      Animated.sequence([
        Animated.delay(p * 110),
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, {
              toValue: 1,
              duration: 420 + p * 70,
              useNativeDriver: false,
            }),
            Animated.timing(v, {
              toValue: 0,
              duration: 420 + p * 70,
              useNativeDriver: false,
            }),
          ])
        ),
      ])
    );
    loops.forEach((l) => l.start());
    return () => {
      loops.forEach((l) => l.stop());
      phases.forEach((v) => v.stopAnimation());
    };
  }, [phases]);

  return (
    <View style={styles.row}>
      {BARS.map((h, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            height: phases[i % PHASES].interpolate({
              inputRange: [0, 1],
              outputRange: [Math.max(4, Math.round(h * 0.45)), h],
            }),
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
