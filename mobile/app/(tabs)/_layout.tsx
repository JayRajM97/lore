import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "../../components/MiniPlayer";
import { C } from "../../lib/theme";

const TABS = [
  { name: "home", label: "Home", icon: "⌂" },
  { name: "library", label: "Library", icon: "≣" },
  { name: "search", label: "Search", icon: "⌕" },
  { name: "profile", label: "Profile", icon: "◎" },
] as const;

// Pure custom tab bar — no @react-navigation/bottom-tabs internals.
// MiniPlayer sits above the tab buttons; safe-area insets pad the bottom.
function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
      <View style={styles.row}>
        {TABS.map((t) => {
          const active = pathname === `/${t.name}` || pathname.startsWith(`/${t.name}/`);
          return (
            <Pressable
              key={t.name}
              style={styles.tab}
              onPress={() => router.replace(`/${t.name}`)}
            >
              <Text style={[styles.icon, active && styles.iconActive]}>{t.icon}</Text>
              <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.bg,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  row: {
    flexDirection: "row",
    height: 50,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  icon: { fontSize: 20, color: C.muted },
  iconActive: { color: C.teal },
  label: { fontSize: 11, color: C.muted },
  labelActive: { color: C.teal, fontWeight: "600" },
});
