import { useEffect, useState } from "react";
import { Dimensions, Platform } from "react-native";

const DESKTOP_BREAKPOINT = 768;

/**
 * Returns true when the window width is >= 768px (desktop/tablet).
 * On native (iOS/Android) it always returns false.
 */
export function useBreakpoint(): { isDesktop: boolean; width: number } {
  const [width, setWidth] = useState(() => Dimensions.get("window").width);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT;
  return { isDesktop, width };
}
