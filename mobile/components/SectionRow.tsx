import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { C } from "../lib/theme";

/** Titled horizontal-scroll section used by the Discover screen. */
export default function SectionRow({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 17, fontWeight: "600", color: C.ink, paddingHorizontal: 16 },
  rowContent: { paddingHorizontal: 16, paddingRight: 4 },
});
