import React from "react";
import { Pressable, Text, View } from "react-native";
import { StatusBadge, UrgencyBadge, DeadlineTimer } from "./Badges";
import type { RequestStatus, UrgencyLevel } from "@/shared/types";

interface RequestCardProps {
  request: {
    id: number;
    requestNumber: string;
    department: string;
    application: string;
    urgencyLevel: string;
    status: string;
    totalEstimatedValue?: string | null;
    deadlineAt?: Date | string | null;
    createdAt: Date | string;
  };
  onPress: () => void;
}

function formatCurrency(value?: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RequestCard({ request, onPress }: RequestCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      <View className="bg-surface border border-border rounded-2xl p-4 mb-3">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 mr-2">
            <Text className="text-xs text-muted font-mono">{request.requestNumber}</Text>
            <Text className="text-sm font-semibold text-foreground mt-0.5" numberOfLines={2}>
              {request.application}
            </Text>
            <Text className="text-xs text-muted mt-0.5">{request.department}</Text>
          </View>
          <StatusBadge status={request.status as RequestStatus} />
        </View>
        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
          <View className="flex-row items-center gap-2">
            <UrgencyBadge level={request.urgencyLevel as UrgencyLevel} />
            {request.deadlineAt && (
              <DeadlineTimer deadline={request.deadlineAt} />
            )}
          </View>
          <View className="items-end">
            <Text className="text-xs text-muted">Valor est.</Text>
            <Text className="text-sm font-bold text-foreground">
              {formatCurrency(request.totalEstimatedValue)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
