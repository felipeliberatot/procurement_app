import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { RequestStatus, UrgencyLevel } from "@/shared/types";
import { STATUS_LABELS, URGENCY_LABELS } from "@/shared/types";
import { useColors } from "@/hooks/use-colors";

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<RequestStatus, { bg: string; text: string }> = {
  rascunho:                  { bg: "bg-muted/20",   text: "text-muted" },
  aguardando_gerente:        { bg: "bg-warning/15", text: "text-warning" },
  aguardando_orcamento:      { bg: "bg-warning/15", text: "text-warning" },
  aguardando_controladoria:  { bg: "bg-warning/15", text: "text-warning" },
  aguardando_diretoria:      { bg: "bg-warning/15", text: "text-warning" },
  aguardando_ordem_compra:   { bg: "bg-primary/15", text: "text-primary" },
  aguardando_financeiro:     { bg: "bg-primary/15", text: "text-primary" },
  concluida:                 { bg: "bg-success/15", text: "text-success" },
  rejeitada:                 { bg: "bg-error/15",   text: "text-error" },
  cancelada:                 { bg: "bg-muted/20",   text: "text-muted" },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
  return (
    <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>
        {STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  );
}

// ─── UrgencyBadge ─────────────────────────────────────────────────────────────

const URGENCY_STYLE: Record<UrgencyLevel, { bg: string; text: string; icon: string }> = {
  normal:      { bg: "bg-primary/15", text: "text-primary", icon: "🔵" },
  urgente:     { bg: "bg-warning/15", text: "text-warning", icon: "🟡" },
  emergencial: { bg: "bg-error/15",   text: "text-error",   icon: "🔴" },
};

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const style = URGENCY_STYLE[level];
  return (
    <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${style.bg}`}>
      <Text className="text-xs">{style.icon}</Text>
      <Text className={`text-xs font-semibold ${style.text}`}>
        {URGENCY_LABELS[level]}
      </Text>
    </View>
  );
}

// ─── DeadlineTimer ────────────────────────────────────────────────────────────

function getTimeRemaining(deadline: Date | string | null): string {
  if (!deadline) return "—";
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Vencido";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export function DeadlineTimer({ deadline }: { deadline: Date | string | null }) {
  const [label, setLabel] = useState(() => getTimeRemaining(deadline));
  const colors = useColors();

  useEffect(() => {
    const interval = setInterval(() => {
      setLabel(getTimeRemaining(deadline));
    }, 60000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isExpired = label === "Vencido";
  const isUrgent = !isExpired && label.includes("h") && !label.includes("d");

  return (
    <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${isExpired ? "bg-error/15" : isUrgent ? "bg-warning/15" : "bg-muted/10"}`}>
      <Text className="text-xs">⏱</Text>
      <Text className={`text-xs font-medium ${isExpired ? "text-error" : isUrgent ? "text-warning" : "text-muted"}`}>
        {label}
      </Text>
    </View>
  );
}
