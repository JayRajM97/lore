import { useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import { RADIUS } from "../lib/theme";

const MIN = 1.0;
const MAX = 2.0;
const STEP = 0.1;

// Playback-speed slider: 1.0x → 2.0x in 0.1 steps. Pure PanResponder (no
// native dep), themed via the player's palette.
export default function SpeedSlider({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (v: number) => void;
  colors: { accent: string; track: string; txt: string; mut: string };
}) {
  const trackW = useRef(0);

  function valueFromX(x: number) {
    const frac = Math.min(Math.max(x / (trackW.current || 1), 0), 1);
    const raw = MIN + frac * (MAX - MIN);
    return Math.min(MAX, Math.max(MIN, Math.round(raw / STEP) * STEP));
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
      onPanResponderRelease: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
    })
  ).current;

  const frac = (value - MIN) / (MAX - MIN);
  const ticks = Array.from({ length: 11 }, (_, i) => MIN + i * STEP);

  return (
    <View style={s.wrap}>
      <Text style={[s.big, { color: colors.txt }]}>{value.toFixed(1)}×</Text>
      <View
        style={s.hit}
        onLayout={(e) => { trackW.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={[s.track, { backgroundColor: colors.track }]} pointerEvents="none">
          <View style={[s.fill, { backgroundColor: colors.accent, width: `${frac * 100}%` }]} />
          {ticks.map((t, i) => (
            <View
              key={i}
              style={[s.tick, { left: `${(i / 10) * 100}%`, backgroundColor: t <= value ? colors.accent : colors.mut, opacity: 0.5 }]}
            />
          ))}
          <View style={[s.thumb, { left: `${frac * 100}%`, backgroundColor: colors.accent }]} />
        </View>
      </View>
      <View style={s.labels}>
        <Text style={[s.label, { color: colors.mut }]}>1.0×</Text>
        <Text style={[s.label, { color: colors.mut }]}>1.5×</Text>
        <Text style={[s.label, { color: colors.mut }]}>2.0×</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  big: { fontSize: 22, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"] },
  hit: { height: 36, justifyContent: "center" },
  track: { height: 6, borderRadius: 3, position: "relative" },
  fill: { position: "absolute", left: 0, top: 0, height: 6, borderRadius: 3 },
  tick: { position: "absolute", top: -3, width: 2, height: 12, borderRadius: 1, marginLeft: -1 },
  thumb: {
    position: "absolute", width: 22, height: 22, borderRadius: RADIUS.pill,
    top: -8, marginLeft: -11,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 11, fontWeight: "600" },
});
