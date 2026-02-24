import React from "react";
import { Text, View } from "react-native";
import type { RequestStatus } from "@/shared/types";
import { WORKFLOW_STEPS } from "@/shared/types";

const STATUS_ORDER: RequestStatus[] = [
  "aguardando_gerente",
  "aguardando_orcamento",
  "aguardando_controladoria",
  "aguardando_diretoria",
  "aguardando_ordem_compra",
  "aguardando_comprovante_pagamento",
  "aguardando_verificacao_compras",
  "concluida",
];

function getStepState(stepStatus: RequestStatus, currentStatus: RequestStatus): "done" | "active" | "pending" {
  if (currentStatus === "rejeitada" || currentStatus === "cancelada") {
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);
    const stepIdx = STATUS_ORDER.indexOf(stepStatus);
    if (stepIdx < currentIdx) return "done";
    return "pending";
  }
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

interface ApprovalTimelineProps {
  currentStatus: RequestStatus;
}

export function ApprovalTimeline({ currentStatus }: ApprovalTimelineProps) {
  const isCancelled = currentStatus === "cancelada" || currentStatus === "rejeitada";

  return (
    <View>
      {WORKFLOW_STEPS.map((ws, index) => {
        const state = getStepState(ws.status, currentStatus);
        const isLast = index === WORKFLOW_STEPS.length - 1;

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
