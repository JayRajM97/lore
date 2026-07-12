import { Image, StyleSheet, Text, View } from "react-native";
import { initials } from "../lib/format";

// Rich cover-art tile. Uses the sender logo when present; otherwise paints a
// deterministic colored "album cover" from the name (varied + saturated so a
// shelf of logo-less newsletters still looks like real artwork).
const COVERS: [string, string][] = [
  ["#0F6E56", "#0A3D2B"], // teal
  ["#534AB7", "#2E2870"], // indigo
  ["#D85A30", "#8F3417"], // coral
  ["#BA7517", "#7A4A0C"], // amber
  ["#1E6091", "#0F3B5C"], // ocean
  ["#7B2D8E", "#4A1657"], // plum
  ["#2C7A4B", "#17472A"], // fern
  ["#B23A48", "#6E1F29"], // rose
];

function coverColors(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COVERS[Math.abs(h) % COVERS.length];
}

export default function CoverArt({
  name,
  url,
  size,
  radius,
}: {
  name: string;
  url?: string | null;
  size: number;
  radius?: number;
}) {
  const r = radius ?? Math.round(size * 0.14);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: "#E7E5DD" }}
        resizeMode="cover"
      />
    );
  }

  const [base, deep] = coverColors(name);
  return (
    <View
      style={[
        s.fallback,
        { width: size, height: size, borderRadius: r, backgroundColor: base },
      ]}
    >
      {/* offset disc adds a subtle two-tone gradient feel without a gradient lib */}
      <View
        style={{
          position: "absolute",
          right: -size * 0.22,
          bottom: -size * 0.22,
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.5,
          backgroundColor: deep,
          opacity: 0.7,
        }}
      />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.32 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
