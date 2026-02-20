// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  // Navigation
  "house.fill": "home",
  "doc.text.fill": "description",
  "checkmark.seal.fill": "verified",
  "folder.fill": "folder",
  "person.fill": "person",
  // Actions
  "plus": "add",
  "paperplane.fill": "send",
  "chevron.right": "chevron-right",
  "chevron.left.forwardslash.chevron.right": "code",
  "arrow.left": "arrow-back",
  "xmark": "close",
  "checkmark": "check",
  "pencil": "edit",
  "trash.fill": "delete",
  "ellipsis": "more-horiz",
  // Status
  "clock.fill": "schedule",
  "bell.fill": "notifications",
  "exclamationmark.triangle.fill": "warning",
  "info.circle.fill": "info",
  // Search & Filter
  "magnifyingglass": "search",
  "line.3.horizontal.decrease": "filter-list",
  // Files
  "doc.fill": "insert-drive-file",
  "arrow.up.doc.fill": "upload-file",
  // Misc
  "building.2.fill": "business",
  "cart.fill": "shopping-cart",
  "dollarsign.circle.fill": "attach-money",
  "chart.bar.fill": "bar-chart",
  "gear": "settings",
  "phone.fill": "phone",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
