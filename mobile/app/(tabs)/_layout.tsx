import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "../../components/MiniPlayer";
import { C, RADIUS, SHADOW } from "../../lib/theme";
import { useIsDesktop } from "../../lib/responsive";

const TABS = [
  { name: "home", label: "Home", icon: "⌂" },
  { name: "discover", label: "Discover", icon: "◈" },
  { name: "library", label: "Library", icon: "≣" },
  { name: "profile", label: "Profile", icon: "◎" },
] as const;

function TabButton({
  icon, label, active, onPress,
}: { icon: string; label: string; active: boolean; onPress: () => void }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 6 }).start();
  }, [active]);

  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Animated.View
        style={[styles.iconPill, {
          backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(225,245,238,0)", C.teal50] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        }]}
      >
        <Text style={[styles.icon, active && styles.iconActive]}>{icon}</Text>
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

// Pure custom tab bar — MiniPlayer floats above it as a detached card.
// Desktop web: the whole thing becomes a centered floating dock; mobile keeps
// the classic full-width bottom bar.
function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();

  const tabs = (
    <View style={styles.row}>
      {TABS.map((t) => (
        <TabButton
          key={t.name}
          icon={t.icon}
          label={t.label}
          active={pathname === `/${t.name}` || pathname.startsWith(`/${t.name}/`)}
          onPress={() => router.replace(`/${t.name}`)}
        />
      ))}
    </View>
  );

  if (desktop) {
    return (
      <View style={styles.dockWrap} pointerEvents="box-none">
        <View style={styles.dock}>
          <MiniPlayer />
          {tabs}
        </View>
      </View>
    );
  }

  return (
    <View>
      <MiniPlayer />
      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>{tabs}</View>
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
      <Tabs.Screen name="home2" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: C.bg,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  // Desktop floating dock
  dockWrap: {
    alignItems: "center",
    paddingBottom: 18,
    backgroundColor: "transparent",
  },
  dock: {
    width: 560,
    maxWidth: "94%",
    backgroundColor: C.bg,
    borderRadius: RADIUS.card,
    paddingTop: 6,
    overflow: "hidden",
    ...(SHADOW.float as object),
  },
  row: {
    flexDirection: "row",
    height: 56,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconPill: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  icon: { fontSize: 19, color: C.muted },
  iconActive: { color: C.teal },
  label: { fontSize: 10.5, color: C.muted },
  labelActive: { color: C.teal, fontWeight: "600" },
});
