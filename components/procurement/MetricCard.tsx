import React from "react";
import { Text, View } from "react-native";

type ColorToken = "primary" | "warning" | "success" | "error" | "muted";

const COLOR_MAP: Record<ColorToken, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  success: { bg: "bg-success/10", text: "text-success" },
  error:   { bg: "bg-error/10",   text: "text-error" },
  muted:   { bg: "bg-muted/10",   text: "text-muted" },
};

interface MetricCardProps {
  label: string;
  value: number | string;
  icon?: string;
  color?: ColorToken;
}

export function MetricCard({ label, value, icon, color = "primary" }: MetricCardProps) {
  const colors = COLOR_MAP[color];
  return (
    <View className={`flex-1 rounded-2xl p-3 border border-border bg-surface`}>
      {icon && (
        <View className={`w-8 h-8 rounded-xl ${colors.bg} items-center justify-center mb-2`}>
          <Text className="text-base">{icon}</Text>
        </View>
      )}
      <Text className={`text-2xl font-bold ${colors.text}`}>{value}</Text>
      <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>{label}</Text>
    </View>
  );
}
