import React from "react";
import { Text, View } from "react-native";
import type { RequestStatus } from "@/shared/types";
import { getWorkflowSteps } from "@/shared/types";

function getStepState(
  stepStatus: RequestStatus,
  currentStatus: RequestStatus,
  statusOrder: RequestStatus[]
): "done" | "active" | "pending" {
  const currentIdx = statusOrder.indexOf(currentStatus);
  const stepIdx = statusOrder.indexOf(stepStatus);
  if (currentStatus === "rejeitada" || currentStatus === "cancelada") {
    if (stepIdx < currentIdx) return "done";
    return "pending";
  }
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

interface ApprovalTimelineProps {
  currentStatus: RequestStatus;
  urgencyLevel?: string;
}

export function ApprovalTimeline({ currentStatus, urgencyLevel }: ApprovalTimelineProps) {
  const isCancelled = currentStatus === "cancelada" || currentStatus === "rejeitada";
  const workflowSteps = getWorkflowSteps(urgencyLevel);
  const statusOrder = workflowSteps.map(ws => ws.status);

  return (
    <View>
      {workflowSteps.map((ws, index) => {
        const state = getStepState(ws.status, currentStatus, statusOrder);
        const isLast = index === workflowSteps.length - 1;

        return (
          <View key={ws.step} className="flex-row">
            {/* Indicator */}
            <View className="items-center mr-3" style={{ width: 32 }}>
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  state === "done"
                    ? "bg-success"
                    : state === "active"
                    ? isCancelled ? "bg-error" : "bg-primary"
                    : "bg-border"
                }`}
              >
                <Text className="text-white text-xs font-bold">
                  {state === "done" ? "✓" : state === "active" && isCancelled ? "✕" : String(index + 1)}
                </Text>
              </View>
              {!isLast && (
                <View
                  className={`w-0.5 flex-1 mt-1 mb-1 ${state === "done" ? "bg-success" : "bg-border"}`}
                  style={{ minHeight: 20 }}
                />
              )}
            </View>

            {/* Content */}
            <View className={`flex-1 ${isLast ? "pb-0" : "pb-4"}`}>
              <Text
                className={`text-sm font-semibold ${
                  state === "done"
                    ? "text-success"
                    : state === "active"
                    ? isCancelled ? "text-error" : "text-primary"
                    : "text-muted"
                }`}
              >
                {ws.label}
              </Text>
              {ws.role && (
                <Text className="text-xs text-muted mt-0.5">
                  {state === "active" ? "Aguardando ação" : state === "done" ? "Concluído" : "Pendente"}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
