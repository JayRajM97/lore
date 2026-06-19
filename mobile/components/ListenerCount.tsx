import { Text } from "react-native";
import { C } from "../lib/theme";

/** 1200 -> "1.2k", 12000 -> "12k". */
export function formatListeners(count: number): string {
  if (count < 1000) return `${count} listeners`;
  if (count < 10000) return `${(count / 1000).toFixed(1)}k listeners`;
  return `${Math.floor(count / 1000)}k listeners`;
}

export default function ListenerCount({
  count,
  size = 12,
  color = C.muted,
}: {
  count: number;
  size?: number;
  color?: string;
}) {
  return (
    <Text style={{ fontSize: size, color }}>🎧 {formatListeners(count)}</Text>
  );
}
