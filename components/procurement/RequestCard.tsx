import React from "react";
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from "react-native";
import { StatusBadge, UrgencyBadge, DeadlineTimer } from "./Badges";
import { useColors } from "@/hooks/use-colors";
import type { RequestStatus, UrgencyLevel } from "@/shared/types";

interface RequestItem {
  id: number;
  description: string;
  quantity: string | number;
  unit: string;
  totalPrice?: string | null;
}

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
}: RequestCardProps) {
  const colors = useColors();
  const showActions = !!onApprove;
  const hasItems = request.items && request.items.length > 0;

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
        }}
      >
        {/* Faixa de destaque para cards com ação pendente */}
        {showActions && (
          <View style={{ backgroundColor: `${colors.warning}15`, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12 }}>⏳</Text>
            <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "700" }}>AGUARDANDO SUA AÇÃO</Text>
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
            </View>
            <StatusBadge status={request.status as RequestStatus} />
          </View>

          {/* Itens da solicitação */}
          {hasItems && (
            <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                📦 Itens Solicitados
              </Text>
              {request.items!.map((item, index) => (
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
                  {item.totalPrice && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, flexShrink: 0 }}>
                      {formatCurrency(item.totalPrice)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Rodapé com urgência e valor */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UrgencyBadge level={request.urgencyLevel as UrgencyLevel} />
              {request.deadlineAt && <DeadlineTimer deadline={request.deadlineAt} />}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 11, color: colors.muted }}>Valor est.</Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>
                {formatCurrency(request.totalEstimatedValue)}
              </Text>
            </View>
          </View>

          {/* Botões de ação rápida */}
          {showActions && (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
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
          )}
        </View>
      </View>
    </Pressable>
  );
}
