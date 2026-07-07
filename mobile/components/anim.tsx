import { ReactNode, useEffect, useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

// Native driver crashes on web for transform in some RNW paths; it's safe there
// to run on JS thread (DOM styles are cheap).
const NATIVE = false;

/**
 * Spotify-style pointer feedback: springs down to `to` scale while pressed,
 * lifts slightly on hover (desktop web), springs back on release/leave.
 */
export function PressableScale({
  children,
  style,
  to = 0.97,
  ...props
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; to?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressed = useRef(false);
  const hovered = useRef(false);

  const spring = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: NATIVE,
      speed: 40,
      bounciness: 5,
    }).start();

  const settle = () => spring(pressed.current ? to : hovered.current ? 1.015 : 1);

  return (
    <Pressable
      {...props}
      onPressIn={(e) => { pressed.current = true; settle(); props.onPressIn?.(e); }}
      onPressOut={(e) => { pressed.current = false; settle(); props.onPressOut?.(e); }}
      onHoverIn={(e) => { hovered.current = true; settle(); (props as any).onHoverIn?.(e); }}
      onHoverOut={(e) => { hovered.current = false; settle(); (props as any).onHoverOut?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Mount animation: fades in while sliding up 14px. Stagger lists by passing
 * `delay={i * 60}`.
 */
export function FadeInUp({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: NATIVE }),
      Animated.spring(ty, { toValue: 0, delay, useNativeDriver: NATIVE, speed: 16, bounciness: 6 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: ty }] }]}>
      {children}
    </Animated.View>
  );
}
