import { Platform, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply.
   * On Android defaults to ["top", "left", "right", "bottom"] to avoid
   * conflicts with the navigation/gesture bar.
   * On iOS defaults to ["top", "left", "right"] because the Tab Bar handles bottom.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
}

/**
 * A container component that properly handles SafeArea and background colors
 * for both iOS and Android (including edge-to-edge navigation bar).
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges,
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  // Android: include bottom to avoid gesture/navigation bar overlap.
  // iOS: bottom is handled by the Tab Bar, so we skip it by default.
  const defaultEdges: Edge[] =
    Platform.OS === "android"
      ? ["top", "left", "right", "bottom"]
      : ["top", "left", "right"];

  const resolvedEdges = edges ?? defaultEdges;

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      style={Platform.OS === "web" ? { height: "100vh" as any, overflow: "hidden" as any } : undefined}
      {...props}
    >
      <SafeAreaView
        edges={resolvedEdges}
        className={cn("flex-1", safeAreaClassName)}
        style={[
          Platform.OS === "web" ? { flex: 1, overflow: "hidden" as any } : undefined,
          style,
        ]}
      >
        <View
          className={cn("flex-1", className)}
          style={Platform.OS === "web" ? { flex: 1, overflow: "auto" as any } : undefined}
        >
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}
