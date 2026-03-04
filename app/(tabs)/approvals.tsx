import { ScreenContainer } from "@/components/screen-container";
import { RequestCard } from "@/components/procurement/RequestCard";
import { EmptyState } from "@/components/procurement/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProcurementRole, RequestStatus } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

const ROLE_DESCRIPTIONS: Record<ProcurementRole, string> = {
  solicitante: "Você não tem pendências de aprovação.",
  gerente: "Solicitações aguardando sua aprovação como Gerente de Unidade.",
  orcamento: "Solicitações aguardando orçamento, emissão de OC ou verificação final.",
  controladoria: "Solicitações aguardando aprovação da Controladoria.",
  diretoria: "Solicitações aguardando aprovação da Diretoria.",
  financeiro: "Solicitações aguardando comprovante de pagamento.",
  admin: "Todas as solicitações pendentes no sistema.",
};

// Etapas que só têm ação especial (sem botão Rejeitar direto)
const APPROVE_ONLY_STATUSES: RequestStatus[] = [
  "aguardando_orcamento",
  "aguardando_ordem_compra",
  "aguardando_comprovante_pagamento",
  "aguardando_verificacao_compras",
];

// ─── Modal de Rejeição Rápida ─────────────────────────────────────────────────
function QuickRejectModal({
  visible,
  requestNumber,
  onClose,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  requestNumber: string;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isLoading: boolean;
}) {
  const colors = useColors();
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      Alert.alert("Motivo obrigatório", "Informe o motivo da rejeição para continuar.");
      return;
    }
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={handleClose} disabled={isLoading}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Rejeitar Solicitação</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: `${colors.error}10`, borderWidth: 1, borderColor: `${colors.error}30`, borderRadius: 16, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 24 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14, marginBottom: 4 }}>{requestNumber}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                A solicitação voltará para o solicitante corrigir. Informe claramente o motivo.
              </Text>
            </View>
          </View>

          <View>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
              Motivo da Rejeição *
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Descreva o motivo da rejeição..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                minHeight: 120,
                textAlignVertical: "top",
              }}
              autoFocus
            />
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading || !reason.trim()}
            style={{
              backgroundColor: reason.trim() ? colors.error : colors.border,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>❌</Text>
                <Text style={{ color: reason.trim() ? "white" : colors.muted, fontWeight: "700", fontSize: 15 }}>
                  Confirmar Rejeição
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Tela Principal ───────────────────────────────────────────────────────────
export default function ApprovalsScreen() {
  const { isAuthenticated, user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const isMasterUser = (user as any)?.approvalLevel === "master";
  // Para exibição: master usa descrição de admin (vê tudo)
  const displayRole: ProcurementRole = isMasterUser ? "admin" : userRole;
  const utils = trpc.useUtils();

  const [rejectTarget, setRejectTarget] = useState<{ id: number; requestNumber: string } | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const { data: pending, isLoading, refetch, isRefetching } = trpc.requests.pendingForMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const invalidateAll = () => {
    utils.requests.pendingForMe.invalidate();
    utils.requests.all.invalidate();
    utils.requests.myRequests.invalidate();
    utils.requests.dashboardStats.invalidate();
  };

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      invalidateAll();
      setApprovingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => {
      setApprovingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao aprovar", e.message);
    },
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      invalidateAll();
      setRejectTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onError: (e) => {
      Alert.alert("Erro ao rejeitar", e.message);
    },
  });

  const handleQuickApprove = (item: any) => {
    // Alert.alert callbacks não funcionam na web — aprovar diretamente
    setApprovingId(item.id);
    approveMutation.mutate({ requestId: item.id });
  };

  const handleQuickReject = (item: any) => {
    setRejectTarget({ id: item.id, requestNumber: item.requestNumber });
  };

  const renderItem = ({ item }: { item: any }) => {
    const status = item.status as RequestStatus;
    const isApproveOnly = APPROVE_ONLY_STATUSES.includes(status);
    const isApproving = approvingId === item.id && approveMutation.isPending;
    const isRejecting = rejectTarget?.id === item.id && rejectMutation.isPending;
    return (
      <View style={isDesktop ? { flex: 1 } : {}}>
        <RequestCard
          request={item}
          onPress={() => router.push(`/request/${item.id}` as any)}
          onApprove={!isApproveOnly ? () => handleQuickApprove(item) : undefined}
          onReject={!isApproveOnly ? () => handleQuickReject(item) : undefined}
          isApproving={isApproving}
          isRejecting={isRejecting}
        />
      </View>
    );
  };

  return (
    <ScreenContainer>
      <View style={{ paddingHorizontal: isDesktop ? 24 : 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: isDesktop ? 24 : 22, fontWeight: "800", color: colors.foreground }}>Aprovações</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {isMasterUser ? "Master — Todas as etapas" : (ROLE_LABELS[userRole] ?? "Usuário")}
        </Text>
        {pending && pending.length > 0 && (
          <View style={{ marginTop: 8, backgroundColor: `${colors.warning}18`, borderWidth: 1, borderColor: `${colors.warning}40`, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12, color: colors.warning, fontWeight: "700" }}>
              ⚠️ {pending.length} solicitação{pending.length !== 1 ? "ões" : ""} aguardando sua ação
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={pending ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={isDesktop
            ? { padding: 20, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1, maxWidth: 1000, alignSelf: "center" as any, width: "100%" }
            : { padding: 16, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }
          }
          onRefresh={refetch}
          refreshing={isRefetching}
          numColumns={isDesktop ? 2 : 1}
          key={isDesktop ? "desktop" : "mobile"}
          columnWrapperStyle={isDesktop ? { gap: 16 } : undefined}
          ListEmptyComponent={
            <EmptyState
              title="Nenhuma aprovação pendente"
              description={ROLE_DESCRIPTIONS[displayRole]}
              icon="✅"
            />
          }
          renderItem={renderItem}
        />
      )}

      {/* Modal de rejeição rápida */}
      <QuickRejectModal
        visible={!!rejectTarget}
        requestNumber={rejectTarget?.requestNumber ?? ""}
        onClose={() => setRejectTarget(null)}
        onConfirm={(comment) => {
          if (rejectTarget) {
            rejectMutation.mutate({ requestId: rejectTarget.id, comment });
          }
        }}
        isLoading={rejectMutation.isPending}
      />
    </ScreenContainer>
  );
}
