import { useWindowDimensions } from "react-native";

// Breakpoint: below = phone layout (mweb/native), above = desktop web.
export const DESKTOP_MIN = 900;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_MIN;
}

// Content column widths.
export const CONTENT = {
  feed: 720,      // reading feeds (home, library, profile)
  feedWide: 1040, // desktop home with 3-col grid
  player: 560,    // now-playing column on desktop
  lyrics: 780,    // lyrics column on desktop
};
