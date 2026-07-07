import { Image, StyleSheet, Text, View } from "react-native";
import { C } from "../lib/theme";
import { initials } from "../lib/format";

export default function Avatar({
  name,
  url,
  size = 44,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  // Spotify-show-art "squircle" rather than a full circle.
  const radius = size * 0.32;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: C.teal50,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: C.teal, fontWeight: "600" },
});
