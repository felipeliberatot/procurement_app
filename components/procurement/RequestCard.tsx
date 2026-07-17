import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from "react-native";
import { StatusBadge, UrgencyBadge, DeadlineTimer } from "./Badges";
import { useColors } from "@/hooks/use-colors";
import type { RequestStatus, UrgencyLevel } from "@/shared/types";
import { WORKFLOW_STEPS, WORKFLOW_STEPS_URGENT } from "@/shared/types";

// Mapa de cores por status para a barra lateral
const STATUS_BAR_COLOR: Record<string, string> = {
  rascunho: "#9BA1A6",
  aguardando_gerente: "#F59E0B",
  aguardando_orcamento: "#F59E0B",
  aguardando_controladoria: "#F59E0B",
  aguardando_diretoria: "#F59E0B",
  aguardando_ordem_compra: "#0a7ea4",
  aguardando_aprovacao_compra: "#0a7ea4",
  aguardando_comprovante_pagamento: "#0a7ea4",
  aguardando_verificacao_compras: "#0a7ea4",
  concluida: "#22C55E",
  parcialmente_concluida: "#F59E0B",
  rejeitada: "#EF4444",
  cancelada: "#9BA1A6",
};

// Ícone por status
const STATUS_ICON: Record<string, string> = {
  rascunho: "📝",
  aguardando_gerente: "👔",
  aguardando_orcamento: "💰",
  aguardando_controladoria: "🏦",
  aguardando_diretoria: "🏛️",
  aguardando_ordem_compra: "🛒",
  aguardando_aprovacao_compra: "💳",
  aguardando_comprovante_pagamento: "🧾",
  aguardando_verificacao_compras: "🔍",
  concluida: "✅",
  parcialmente_concluida: "⚠️",
  rejeitada: "❌",
  cancelada: "🚫",
};

function getStepInfo(status: string, urgencyLevel?: string): { current: number; total: number } {
  const isUrgent = urgencyLevel === "urgente" || urgencyLevel === "emergencial";
  const steps = isUrgent ? WORKFLOW_STEPS_URGENT : WORKFLOW_STEPS;
  const idx = steps.findIndex(s => s.status === status);
  if (idx < 0) return { current: 0, total: steps.length };
  return { current: idx + 1, total: steps.length };
}

const MAX_ITEMS_VISIBLE = 3;

interface RequestItem {
  id: number;
  description: string;
  quantity: string | number;
  unit: string;
  totalPrice?: string | null;
  itemStatus?: string | null;
  fulfilledQty?: string | null;
}

interface RequestCardProps {
  request: {
    id: number;
    requestNumber: string;
    department: string;
    application: string;
    requesterName?: string | null;
    urgencyLevel: string;
    status: string;
    totalEstimatedValue?: string | null;
    orderValue?: string | null;
    deadlineAt?: Date | string | null;
    createdAt: Date | string;
    items?: RequestItem[];
  };
  onPress: () => void;
  /** Se fornecido, exibe botões de ação rápida Aprovar/Rejeitar no card */
  onApprove?: () => void;
  onReject?: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  /** Quando true, mostra apenas o botão Aprovar (etapas sem rejeição direta) */
  approveOnly?: boolean;
  /** Callback para botão de edição (sem reiniciar fluxo) */
  onEdit?: () => void;
}

function formatCurrency(value?: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function RequestCard({
  request,
  onPress,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  approveOnly,
  onEdit,
}: RequestCardProps) {
  const colors = useColors();
  const showActions = !!onApprove;
  const hasItems = request.items && request.items.length > 0;
  const totalItems = request.items?.length ?? 0;
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? request.items : request.items?.slice(0, MAX_ITEMS_VISIBLE);
  const hiddenCount = totalItems - MAX_ITEMS_VISIBLE;

  const barColor = STATUS_BAR_COLOR[request.status] ?? "#9BA1A6";
  const statusIcon = STATUS_ICON[request.status] ?? "📋";
  const stepInfo = getStepInfo(request.status, request.urgencyLevel);
  const isDone = request.status === "concluida" || request.status === "parcialmente_concluida";
  const isTerminal = isDone || request.status === "rejeitada" || request.status === "cancelada";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: showActions ? 1.5 : 1,
          borderColor: showActions ? `${colors.warning}50` : colors.border,
          borderRadius: 16,
          marginBottom: 12,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        {/* Barra colorida lateral indicando status */}
        <View style={{ width: 5, backgroundColor: barColor, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />

        <View style={{ flex: 1 }}>
        {/* Faixa de destaque para cards com ação pendente */}
        {showActions && (
          <View style={{ backgroundColor: `${colors.warning}15`, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12 }}>⏳</Text>
            <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "700" }}>AGUARDANDO SUA AÇÃO</Text>
          </View>
        )}
        {/* Indicador de etapa */}
        {!isTerminal && stepInfo.current > 0 && (
          <View style={{ backgroundColor: `${barColor}12`, paddingHorizontal: 14, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 0.5, borderBottomColor: `${barColor}30` }}>
            <Text style={{ fontSize: 11 }}>{statusIcon}</Text>
            <Text style={{ fontSize: 11, color: barColor, fontWeight: "700", flex: 1 }}>
              ETAPA {stepInfo.current}/{stepInfo.total}
            </Text>
            {/* Mini barra de progresso */}
            <View style={{ width: 60, height: 4, backgroundColor: `${barColor}25`, borderRadius: 2, overflow: "hidden" }}>
              <View style={{ width: `${(stepInfo.current / stepInfo.total) * 100}%`, height: "100%", backgroundColor: barColor, borderRadius: 2 }} />
            </View>
          </View>
        )}

        <View style={{ padding: 14 }}>
          {/* Cabeçalho */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>{request.requestNumber}</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginTop: 2 }} numberOfLines={2}>
                {request.application}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{request.department}</Text>
              {/* Nome do solicitante */}
              {request.requesterName && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.muted }}>👤</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{request.requesterName}</Text>
                </View>
              )}
            </View>
            <StatusBadge status={request.status as RequestStatus} />
          </View>

          {/* Itens da solicitação */}
          {hasItems && (
            <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                📦 Itens Solicitados ({totalItems})
              </Text>
              {visibleItems!.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    paddingTop: index > 0 ? 6 : 0,
                    marginTop: index > 0 ? 6 : 0,
                    borderTopWidth: index > 0 ? 0.5 : 0,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "500", color: colors.foreground }} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      {item.quantity} {item.unit}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {item.totalPrice && (
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>
                        {formatCurrency(item.totalPrice)}
                      </Text>
                    )}
                    {/* Badge de status do item: comprado=verde, pendente/parcial=amarelo */}
                    {item.itemStatus && (
                      <View style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 20,
                        backgroundColor: item.itemStatus === "comprado" ? "#22C55E20" : "#F59E0B20",
                        borderWidth: 1,
                        borderColor: item.itemStatus === "comprado" ? "#22C55E" : "#F59E0B",
                      }}>
                        <Text style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: item.itemStatus === "comprado" ? "#22C55E" : "#F59E0B",
                        }}>
                          {item.itemStatus === "comprado" ? "Comprado" : "Pendente"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              {/* Botão Ver mais / Ver menos */}
              {totalItems > MAX_ITEMS_VISIBLE && (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); setExpanded(prev => !prev); }}
                  style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
                    {expanded ? "▲ Ver menos" : `▼ Ver mais ${hiddenCount} ${hiddenCount === 1 ? "item" : "itens"}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Rodapé com urgência e valor */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UrgencyBadge level={request.urgencyLevel as UrgencyLevel} />
              {request.deadlineAt && <DeadlineTimer deadline={request.deadlineAt} />}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {(() => {
                    const afterOC = ["aguardando_aprovacao_ceo", "aguardando_aprovacao_compra", "aguardando_comprovante_pagamento", "aguardando_verificacao_compras", "parcialmente_concluida", "concluida"].includes(request.status ?? "");
                    const displayValue = afterOC
                      ? (request.orderValue ?? request.totalEstimatedValue)
                      : request.totalEstimatedValue;
                    if (displayValue) {
                      return (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 11, color: afterOC ? colors.success : colors.warning, fontWeight: "600" }}>{afterOC ? "Valor da OC" : "Valor Estimado"}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: afterOC ? colors.success : colors.foreground }}>
                            {formatCurrency(displayValue)}
                          </Text>
                        </View>
                      );
                    }
                    if (afterOC) {
                      return (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Valor da OC</Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>Sem valor</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
            </View>
          </View>

          {/* Botões de ação rápida */}
          {showActions && (
            <View style={{ gap: 10, marginTop: 12 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Botão Rejeitar — só aparece quando não é approveOnly */}
              {!approveOnly && (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); onReject?.(); }}
                  disabled={isRejecting || isApproving}
                  style={{
                    flex: 1,
                    backgroundColor: `${colors.error}12`,
                    borderWidth: 1.5,
                    borderColor: `${colors.error}40`,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                    opacity: (isRejecting || isApproving) ? 0.6 : 1,
                  }}
                >
                  {isRejecting ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <>
                      <Text style={{ fontSize: 14 }}>❌</Text>
                      <Text style={{ color: colors.error, fontWeight: "700", fontSize: 13 }}>Rejeitar</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Botão Aprovar */}
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation?.(); onApprove?.(); }}
                disabled={isApproving || isRejecting}
                style={{
                  flex: approveOnly ? 1 : 2,
                  backgroundColor: colors.success,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 5,
                  opacity: (isApproving || isRejecting) ? 0.6 : 1,
                  shadowColor: colors.success,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                {isApproving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={{ fontSize: 14 }}>✅</Text>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Aprovar</Text>
                  </>
                )}
              </TouchableOpacity>
              </View>

              {/* Botão Editar (sem reiniciar fluxo) — só aparece quando onEdit é fornecido */}
              {onEdit && (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
                  disabled={isApproving || isRejecting}
                  style={{
                    backgroundColor: `${colors.primary}12`,
                    borderWidth: 1.5,
                    borderColor: `${colors.primary}40`,
                    borderRadius: 10,
                    paddingVertical: 9,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 5,
                    opacity: (isApproving || isRejecting) ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>✏️</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Editar Dados (sem reiniciar fluxo)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        </View>
      </View>
    </Pressable>
  );
}
