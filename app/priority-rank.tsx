import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const STATUS_LABELS: Record<string, string> = {
  aguardando_gerente: "Aguardando Gerente",
  aguardando_orcamento: "Aguardando Orçamento",
  aguardando_controladoria: "Aguardando Controladoria",
  aguardando_diretoria: "Aguardando Diretoria",
  aguardando_ordem_compra: "Aguardando OC",
  aguardando_aprovacao_ceo: "Aguardando CEO",
  aguardando_aprovacao_compra: "Aguardando Compras",
  aguardando_comprovante_pagamento: "Aguardando Pagamento",
  aguardando_verificacao_compras: "Verificação Final",
  concluida: "Concluída",
  cancelada: "Cancelada",
  rejeitada: "Rejeitada",
};

const STATUS_COLORS: Record<string, string> = {
  aguardando_gerente: "#0EA5E9",
  aguardando_orcamento: "#8B5CF6",
  aguardando_controladoria: "#F59E0B",
  aguardando_diretoria: "#EF4444",
  aguardando_ordem_compra: "#06B6D4",
  aguardando_aprovacao_ceo: "#DC2626",
  aguardando_aprovacao_compra: "#06B6D4",
  aguardando_comprovante_pagamento: "#10B981",
  aguardando_verificacao_compras: "#10B981",
  concluida: "#22C55E",
  cancelada: "#9CA3AF",
  rejeitada: "#EF4444",
};

export default function PriorityRankScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const userName = (user as any)?.name ?? "";
  const canManage = ["willian camilo", "rafael"].some((n) => userName.toLowerCase().includes(n));

  const { data: priorityList, isLoading } = trpc.requests.listPriority.useQuery();

  const [localList, setLocalList] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (priorityList) {
      setLocalList([...priorityList]);
      setIsDirty(false);
    }
  }, [priorityList]);

  const reorderMutation = trpc.requests.reorderPriority.useMutation({
    onSuccess: () => {
      utils.requests.listPriority.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsDirty(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const setPriorityMutation = trpc.requests.setPriority.useMutation({
    onSuccess: () => {
      utils.requests.listPriority.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const moveItem = (index: number, direction: "up" | "down") => {
    if (!canManage) return;
    const newList = [...localList];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setLocalList(newList);
    setIsDirty(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveOrder = () => {
    const orderedIds = localList.map((r) => r.id);
    reorderMutation.mutate({ orderedIds });
  };

  const removeFromPriority = (item: any) => {
    const msg = `Remover "${item.requestNumber}" da lista de prioridades?`;
    const doRemove = () => setPriorityMutation.mutate({ requestId: item.id, isPriority: false });
    if (Platform.OS === "web") {
      if (window.confirm(msg)) doRemove();
    } else {
      Alert.alert("Remover Prioridade", msg, [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border,
      }}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>← Voltar</Text>
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>🔴 Rank de Prioridades</Text>
        {isDirty && canManage ? (
          <TouchableOpacity
            onPress={saveOrder}
            disabled={reorderMutation.isPending}
            style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            {reorderMutation.isPending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Salvar</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Info banner */}
      <View style={{
        margin: 12,
        backgroundColor: "#EF444410",
        borderWidth: 1,
        borderColor: "#EF444430",
        borderRadius: 12,
        padding: 12,
      }}>
        <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "700", marginBottom: 4 }}>
          🔴 Solicitações Prioritárias
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
          {canManage
            ? "Use as setas ▲▼ para reordenar o rank. Toque em Salvar para confirmar a nova ordem."
            : "Lista de solicitações marcadas como prioritárias, ordenadas por urgência."}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : localList.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, marginBottom: 8, textAlign: "center" }}>
            Nenhuma prioridade definida
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
            Abra uma solicitação e toque em "Definir como Prioritária" para adicioná-la aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={localList}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const statusColor = STATUS_COLORS[item.status] ?? "#9CA3AF";
            const statusLabel = STATUS_LABELS[item.status] ?? item.status;
            return (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                marginBottom: 10,
                borderWidth: 1.5,
                borderColor: "#EF444430",
                overflow: "hidden",
              }}>
                {/* Rank badge + conteúdo */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Rank number */}
                  <View style={{
                    width: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#EF444415",
                    alignSelf: "stretch",
                    borderRightWidth: 1,
                    borderRightColor: "#EF444430",
                  }}>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: "#EF4444" }}>#{index + 1}</Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, padding: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 11, color: colors.muted, fontFamily: "monospace" }}>{item.requestNumber}</Text>
                      <View style={{ backgroundColor: `${statusColor}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor }}>{statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }} numberOfLines={2}>
                      {item.application}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.department}</Text>
                    {item.requesterName && (
                      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>👤 {item.requesterName}</Text>
                    )}
                    {item.prioritySetBy && (
                      <Text style={{ fontSize: 10, color: "#EF4444", marginTop: 4 }}>
                        🔴 Prioridade definida por {item.prioritySetBy}
                      </Text>
                    )}
                  </View>

                  {/* Controles */}
                  {canManage && (
                    <View style={{ paddingRight: 8, gap: 4, alignItems: "center", justifyContent: "center" }}>
                      <TouchableOpacity
                        onPress={() => moveItem(index, "up")}
                        disabled={index === 0}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          backgroundColor: index === 0 ? colors.border : `${colors.primary}20`,
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 16, color: index === 0 ? colors.muted : colors.primary }}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveItem(index, "down")}
                        disabled={index === localList.length - 1}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          backgroundColor: index === localList.length - 1 ? colors.border : `${colors.primary}20`,
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 16, color: index === localList.length - 1 ? colors.muted : colors.primary }}>▼</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeFromPriority(item)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          backgroundColor: "#EF444415",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 14 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Tap to open */}
                <Pressable
                  onPress={() => router.push(`/request/${item.id}` as any)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.border,
                    paddingVertical: 8,
                    alignItems: "center",
                    backgroundColor: `${colors.primary}08`,
                  })}
                >
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Ver Solicitação →</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
