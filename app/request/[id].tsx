import { ScreenContainer } from "@/components/screen-container";
import { StatusBadge, UrgencyBadge, DeadlineTimer } from "@/components/procurement/Badges";
import { ApprovalTimeline } from "@/components/procurement/ApprovalTimeline";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RequestStatus, ProcurementRole } from "@/shared/types";
import { STEP_LABELS } from "@/shared/types";

const ROLE_CAN_ACT: Record<RequestStatus, ProcurementRole[]> = {
  rascunho: ["solicitante", "admin"],
  aguardando_gerente: ["gerente", "admin"],
  aguardando_orcamento: ["orcamento", "admin"],
  aguardando_controladoria: ["controladoria", "admin"],
  aguardando_diretoria: ["diretoria", "admin"],
  aguardando_ordem_compra: ["orcamento", "admin"],
  aguardando_comprovante_pagamento: ["financeiro", "admin"],
  aguardando_verificacao_compras: ["orcamento", "admin"],
  concluida: [],
  rejeitada: ["solicitante", "admin"],
  cancelada: [],
};

// Etapas que têm apenas ação especial (sem botões simples de aprovar/rejeitar)
const STATUS_APPROVE_ONLY: RequestStatus[] = [
  "aguardando_orcamento",
  "aguardando_ordem_compra",
  "aguardando_comprovante_pagamento",
  "aguardando_verificacao_compras",
];

function formatCurrency(value?: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Modal de Rejeição ────────────────────────────────────────────────────────
function RejectModal({
  visible,
  onClose,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Rejeitar Solicitação</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: `${colors.error}10`, borderWidth: 1, borderColor: `${colors.error}30`, borderRadius: 16, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 24 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14, marginBottom: 4 }}>Atenção</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                A solicitação voltará para o solicitante corrigir. Informe claramente o motivo para que ele possa ajustar e reenviar.
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

// ─── Modal de Aprovação com comentário opcional ───────────────────────────────
function ApproveModal({
  visible,
  onClose,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  isLoading: boolean;
}) {
  const colors = useColors();
  const [comment, setComment] = useState("");

  const handleConfirm = () => {
    onConfirm(comment.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Aprovar Solicitação</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: `${colors.success}10`, borderWidth: 1, borderColor: `${colors.success}30`, borderRadius: 16, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 24 }}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.success, fontWeight: "700", fontSize: 14, marginBottom: 4 }}>Confirmar Aprovação</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                A solicitação avançará para a próxima etapa do fluxo de compras.
              </Text>
            </View>
          </View>

          <View>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
              Comentário (opcional)
            </Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Adicione um comentário à aprovação..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                minHeight: 100,
                textAlignVertical: "top",
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: colors.success,
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
                <Text style={{ fontSize: 18 }}>✅</Text>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                  Confirmar Aprovação
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
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();
  const insets = useSafeAreaInsets();

  const [orderNumber, setOrderNumber] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [budgetFileName, setBudgetFileName] = useState<string | null>(null);
  const [paymentProofFileName, setPaymentProofFileName] = useState<string | null>(null);
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentRejectModal, setShowPaymentRejectModal] = useState(false);

  const requestId = parseInt(id ?? "0");

  const { data: request, isLoading } = trpc.requests.getById.useQuery(
    { id: requestId },
    { enabled: isAuthenticated && !!id }
  );

  const { data: history } = trpc.requests.history.useQuery(
    { requestId },
    { enabled: isAuthenticated && !!id }
  );

  const invalidateAll = () => {
    utils.requests.getById.invalidate({ id: requestId });
    utils.requests.history.invalidate({ requestId });
    utils.requests.all.invalidate();
    utils.requests.myRequests.invalidate();
    utils.requests.dashboardStats.invalidate();
    utils.requests.pendingForMe.invalidate();
  };

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowApproveModal(false);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro", e.message);
    },
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setShowRejectModal(false);
      setShowPaymentRejectModal(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const uploadFileMutation = trpc.requests.uploadFile.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ PDF anexado com sucesso!", "O orçamento já está disponível para visualização.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao anexar", e.message);
    },
  });

  const uploadPaymentProofMutation = trpc.requests.uploadPaymentProof.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Comprovante anexado!", "O comprovante de pagamento foi registrado com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao anexar comprovante", e.message);
    },
  });

  const uploadInvoiceMutation = trpc.requests.uploadInvoice.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Nota fiscal anexada!", "A nota fiscal foi registrada com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao anexar nota fiscal", e.message);
    },
  });

  const finalizeOCMutation = trpc.requests.finalizeOC.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ OC Finalizada!", "A Ordem de Compra foi encerrada com sucesso e habilitada nos Malotes.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao finalizar OC", e.message);
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!request) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-4xl mb-4">🔍</Text>
          <Text className="text-lg font-semibold text-foreground text-center">Solicitação não encontrada</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4">
            <Text className="text-primary">← Voltar</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const currentStatus = request.status as RequestStatus;
  const canAct = ROLE_CAN_ACT[currentStatus]?.includes(userRole) ?? false;
  const isRejected = currentStatus === "rejeitada";
  const isCancelled = currentStatus === "cancelada";
  const isDone = currentStatus === "concluida";
  const isApproveOnly = STATUS_APPROVE_ONLY.includes(currentStatus);

  // Determina se deve mostrar botões fixos de aprovar/rejeitar
  const showFixedButtons = canAct && !isDone && !isCancelled && !isRejected && !isApproveOnly;
  const showFixedApproveOnly = canAct && !isDone && !isCancelled && isApproveOnly;
  const bottomBarHeight = 80 + (insets.bottom > 0 ? insets.bottom : 16);

  const handlePickBudget = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setBudgetFileName(file.name);
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      uploadFileMutation.mutate({
        requestId: request.id,
        fileName: file.name,
        base64,
        mimeType: file.mimeType ?? "application/pdf",
      });
    } catch (err) {
      console.error("[PDF Upload]", err);
      Alert.alert("Erro", "Não foi possível selecionar ou ler o arquivo.");
    }
  };

  const handleIssueOrder = () => {
    if (!paymentInfo.trim()) { Alert.alert("Campo obrigatório", "Informe os dados de pagamento antes de avançar."); return; }
    Alert.alert(
      "Confirmar Emissão de OC",
      "Confirmar os dados de pagamento e encaminhar ao Financeiro?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => approveMutation.mutate({ requestId: request.id, purchaseOrderNumber: "", paymentInfo }) },
      ]
    );
  };

  const handleFinalize = () => {
    // Mantido para compatibilidade — não usado diretamente na UI
    if (!paymentInfo.trim()) { Alert.alert("Campo obrigatório", "Informe as informações de pagamento."); return; }
    Alert.alert("Confirmar Dados de Pagamento", "Confirmar os dados de pagamento e avançar para o Financeiro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: () => approveMutation.mutate({ requestId: request.id, paymentInfo }) },
    ]);
  };

  const handlePickPaymentProof = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setPaymentProofFileName(file.name);
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      uploadPaymentProofMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  const handlePickInvoice = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setInvoiceFileName(file.name);
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      uploadInvoiceMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  const handleFinalizeOC = () => {
    Alert.alert("📦 Finalizar Ordem de Compra", "Confirma que o comprovante de pagamento foi verificado e deseja encerrar esta OC? Ela será habilitada nos Malotes.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Finalizar OC", onPress: () => finalizeOCMutation.mutate({ requestId: request.id }) },
    ]);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-border">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text className="text-primary text-base">← Voltar</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-bold text-foreground" numberOfLines={1}>
            {request.requestNumber}
          </Text>
          {canAct && !isDone && !isCancelled ? (
            <View style={{ width: 60, alignItems: "flex-end" }}>
              <View style={{ backgroundColor: `${colors.warning}20`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, color: colors.warning, fontWeight: "700" }}>PENDENTE</Text>
              </View>
            </View>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: (showFixedButtons || showFixedApproveOnly) ? bottomBarHeight + 20 : 40,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status badges */}
          <View className="flex-row items-center gap-2 mb-4 flex-wrap">
            <StatusBadge status={currentStatus} />
            <UrgencyBadge level={request.urgencyLevel as any} />
            {request.deadlineAt && <DeadlineTimer deadline={request.deadlineAt} />}
          </View>

          {/* Banner de ação pendente */}
          {canAct && !isDone && !isCancelled && (
            <View style={{
              backgroundColor: `${colors.warning}12`,
              borderWidth: 1.5,
              borderColor: `${colors.warning}50`,
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}>
              <Text style={{ fontSize: 22 }}>⏳</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 13 }}>
                  Ação necessária
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {currentStatus === "aguardando_gerente" && "Esta solicitação aguarda sua aprovação como Gerente."}
                  {currentStatus === "aguardando_orcamento" && "Anexe o PDF do orçamento para avançar."}
                  {currentStatus === "aguardando_controladoria" && "Esta solicitação aguarda aprovação da Controladoria."}
                  {currentStatus === "aguardando_diretoria" && "Esta solicitação aguarda aprovação da Diretoria."}
                  {currentStatus === "aguardando_ordem_compra" && "Emita a Ordem de Compra e informe os dados de pagamento."}
                  {currentStatus === "aguardando_comprovante_pagamento" && "Anexe o PDF do comprovante de pagamento."}
                  {currentStatus === "aguardando_verificacao_compras" && "Verifique o comprovante, anexe a nota fiscal e finalize a OC."}
                  {isRejected && "Corrija e reenvie esta solicitação."}
                </Text>
              </View>
            </View>
          )}

          {/* Informações principais */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-lg font-bold text-foreground mb-2">{request.application}</Text>
            <View className="gap-1.5">
              <Text className="text-sm text-muted">Solicitante: <Text className="text-foreground font-medium">{request.requesterName}</Text></Text>
              <Text className="text-sm text-muted">Departamento: <Text className="text-foreground font-medium">{request.department}</Text></Text>
              {request.costCenterCode && (
                <Text className="text-sm text-muted">Centro de Custo: <Text className="text-foreground font-medium">{request.costCenterCode}</Text></Text>
              )}
              <Text className="text-sm text-muted">Criado em: <Text className="text-foreground font-medium">{formatDate(request.createdAt)}</Text></Text>
              {request.totalEstimatedValue && (
                <Text className="text-sm text-muted">Valor Total: <Text className="text-primary font-bold">{formatCurrency(request.totalEstimatedValue)}</Text></Text>
              )}
              {request.purchaseOrderNumber && (
                <Text className="text-sm text-muted">Ordem de Compra: <Text className="text-foreground font-bold">{request.purchaseOrderNumber}</Text></Text>
              )}
            </View>
            {request.observations && (
              <View className="mt-3 pt-3 border-t border-border">
                <Text className="text-xs text-muted mb-1">Observações</Text>
                <Text className="text-sm text-foreground">{request.observations}</Text>
              </View>
            )}
          </View>

          {/* Itens */}
          {request.items && request.items.length > 0 && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <Text className="text-sm font-bold text-foreground mb-3">Itens Solicitados</Text>
              {request.items.map((item: any, index: number) => (
                <View key={item.id} className={`flex-row items-start justify-between ${index > 0 ? "mt-3 pt-3 border-t border-border" : ""}`}>
                  <View className="flex-1 mr-2">
                    <Text className="text-sm font-medium text-foreground">{item.description}</Text>
                    <Text className="text-xs text-muted">{item.quantity} {item.unit}</Text>
                  </View>
                  {item.totalPrice && (
                    <Text className="text-sm font-semibold text-foreground">{formatCurrency(item.totalPrice)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* PDF de orçamento */}
          {request.budgetFileUrl && (
            <Pressable
              onPress={() => Linking.openURL(request.budgetFileUrl!)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="bg-success/10 border border-success/30 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
                <Text className="text-2xl">📄</Text>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-success">Orçamento Anexado</Text>
                  <Text className="text-xs text-muted" numberOfLines={1}>Toque para visualizar o PDF</Text>
                </View>
                <Text className="text-primary text-xs font-semibold">👁 Ver</Text>
              </View>
            </Pressable>
          )}

          {/* Fluxo de aprovação */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-sm font-bold text-foreground mb-4">Fluxo de Aprovação</Text>
            <ApprovalTimeline currentStatus={currentStatus} />
          </View>

          {/* Histórico */}
          {history && history.length > 0 && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <Text className="text-sm font-bold text-foreground mb-3">Histórico</Text>
              {history.map((h: any) => (
                <View key={h.id} className="flex-row gap-3 mb-3">
                  <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mt-0.5">
                    <Text className="text-xs">
                      {h.action === "aprovada" ? "✅"
                        : h.action === "rejeitada" ? "❌"
                        : h.action === "criada" ? "📝"
                        : h.action === "orcamento_anexado" ? "📄"
                        : h.action === "ordem_emitida" ? "🛒"
                        : h.action === "comprovante_aprovado" ? "💳"
                        : h.action === "comprovante_recusado" ? "🚫"
                        : h.action === "reaberta" ? "🔄"
                        : h.action === "oc_finalizada" ? "🏁"
                        : h.action === "nota_fiscal_anexada" ? "🧾"
                        : "🔄"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground">{h.userName}</Text>
                      <Text className="text-xs text-muted">{formatDate(h.createdAt)}</Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {(STEP_LABELS as Record<string, string>)[h.step] ?? h.step} — {{
                        criada: "Solicitado",
                        aprovada: "Aprovado",
                        rejeitada: "Rejeitado",
                        reaberta: "Reenviado pelo solicitante",
                        orcamento_anexado: "Orçamento anexado",
                        ordem_emitida: "OC emitida",
                        comprovante_anexado: "Comprovante anexado",
                        comprovante_aprovado: "Comprovante aprovado",
                        comprovante_recusado: "Comprovante recusado",
                        pagamento_recusado: "Pagamento recusado",
                        pagamento_verificado: "Pagamento verificado",
                        nota_fiscal_anexada: "Nota fiscal anexada",
                        oc_finalizada: "OC finalizada",
                        cancelada: "Cancelado",
                      }[h.action as string] ?? h.action}
                    </Text>
                    {h.comment && <Text className="text-xs text-foreground mt-1 italic">"{h.comment}"</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Ações especiais inline (orçamento / ordem / financeiro) */}
          {canAct && !isDone && !isCancelled && (
            <>
              {/* Reenvio após rejeição */}
              {isRejected && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-3">Reenviar Solicitação</Text>
                  <TouchableOpacity
                    onPress={() => approveMutation.mutate({ requestId: request.id, comment: "Solicitação corrigida e reenviada" })}
                    disabled={approveMutation.isPending}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", opacity: approveMutation.isPending ? 0.7 : 1 }}
                  >
                    {approveMutation.isPending ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Reenviar para Aprovação</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {/* Etapa de orçamento */}
              {currentStatus === "aguardando_orcamento" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">Anexar Orçamento</Text>
                  <Text className="text-xs text-muted mb-3">Selecione o PDF do orçamento obtido</Text>
                  <TouchableOpacity
                    onPress={handlePickBudget}
                    disabled={uploadFileMutation.isPending}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.primary}60`,
                      borderRadius: 12, paddingVertical: 20,
                      opacity: uploadFileMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {uploadFileMutation.isPending ? (
                      <><ActivityIndicator size="small" /><Text style={{ color: colors.primary, fontSize: 14, marginLeft: 8 }}>Enviando PDF...</Text></>
                    ) : (
                      <><Text style={{ fontSize: 24 }}>📎</Text><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{budgetFileName ?? "Selecionar PDF do Orçamento"}</Text></>
                    )}
                  </TouchableOpacity>
                  {budgetFileName && !uploadFileMutation.isPending && (
                    <Text style={{ color: colors.success, fontSize: 12, textAlign: "center", marginTop: 8 }}>✅ {budgetFileName} enviado</Text>
                  )}
                </View>
              )}

              {/* Etapa 06: Emissão de OC + Dados de Pagamento */}
              {currentStatus === "aguardando_ordem_compra" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📋 Emissão de Ordem de Compra</Text>
                  <Text className="text-xs text-muted mb-4">Preencha os campos abaixo para emitir a OC e encaminhar ao Financeiro</Text>

                  {/* Dados de Pagamento */}
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Dados de Pagamento *</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Informe banco, agência, conta, tipo de pagamento, valor, data prevista, etc.</Text>
                  <TextInput
                    value={paymentInfo}
                    onChangeText={setPaymentInfo}
                    placeholder="Ex: Banco Bradesco, Ag. 1234-5, CC 00012345-6, Transferência, R$ 5.000,00, vencimento 30/03/2024..."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={5}
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: paymentInfo.trim() ? colors.border : `${colors.error}60`,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: colors.foreground,
                      minHeight: 120,
                      textAlignVertical: "top",
                      marginBottom: 16,
                    }}
                  />

                  {/* Indicador de campos obrigatórios */}
                  {!paymentInfo.trim() && (
                    <Text style={{ color: colors.error, fontSize: 11, marginBottom: 12, textAlign: "center" }}>
                      * Preencha os dados de pagamento para continuar
                    </Text>
                  )}

                  {/* Botão Emitir OC */}
                  <TouchableOpacity
                    onPress={handleIssueOrder}
                    disabled={approveMutation.isPending || !paymentInfo.trim()}
                    style={{
                      backgroundColor: paymentInfo.trim() ? colors.primary : colors.border,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      opacity: approveMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {approveMutation.isPending
                      ? <ActivityIndicator color="white" />
                      : (
                        <>
                          <Text style={{ fontSize: 16 }}>📤</Text>
                          <Text style={{ color: paymentInfo.trim() ? "white" : colors.muted, fontWeight: "700", fontSize: 14 }}>
                            Emitir OC e Enviar ao Financeiro
                          </Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Etapa: Comprovante de Pagamento (Financeiro) */}
              {currentStatus === "aguardando_comprovante_pagamento" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">💳 Comprovante de Pagamento</Text>
                  <Text className="text-xs text-muted mb-3">Anexe o PDF do comprovante de pagamento realizado</Text>

                  {/* Dados de pagamento do Compras */}
                  {(request as any).paymentInfo && (
                    <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12, marginBottom: 4 }}>Dados de Pagamento (Compras)</Text>
                      <Text style={{ color: colors.foreground, fontSize: 13 }}>{(request as any).paymentInfo}</Text>
                    </View>
                  )}

                  {/* Comprovante já anexado */}
                  {(request as any).paymentProofUrl ? (
                    <Pressable onPress={() => Linking.openURL((request as any).paymentProofUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 22 }}>📄</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante Anexado</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                        </View>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <TouchableOpacity
                      onPress={handlePickPaymentProof}
                      disabled={uploadPaymentProofMutation.isPending}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.primary}60`, borderRadius: 12, paddingVertical: 20, marginBottom: 12, opacity: uploadPaymentProofMutation.isPending ? 0.6 : 1 }}
                    >
                      {uploadPaymentProofMutation.isPending ? (
                        <><ActivityIndicator size="small" /><Text style={{ color: colors.primary, fontSize: 14, marginLeft: 8 }}>Enviando...</Text></>
                      ) : (
                        <><Text style={{ fontSize: 24 }}>📎</Text><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{paymentProofFileName ?? "Selecionar PDF do Comprovante"}</Text></>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Botões Aprovar/Recusar */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setShowPaymentRejectModal(true)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      style={{ flex: 1, backgroundColor: `${colors.error}15`, borderWidth: 1.5, borderColor: `${colors.error}50`, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    >
                      <Text style={{ fontSize: 16 }}>❌</Text>
                      <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14 }}>Recusar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert("✅ Aprovar Comprovante", "Confirmar o comprovante de pagamento e avançar para verificação do Compras?", [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Confirmar", onPress: () => approveMutation.mutate({ requestId: request.id }) },
                        ]);
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      style={{ flex: 2, backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    >
                      {approveMutation.isPending ? <ActivityIndicator color="white" /> : <><Text style={{ fontSize: 16 }}>✅</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Aprovar Pagamento</Text></>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Etapa: Verificação Final (Compras) */}
              {currentStatus === "aguardando_verificacao_compras" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📝 Verificação Final — Compras</Text>
                  <Text className="text-xs text-muted mb-3">Verifique o comprovante, anexe a nota fiscal e finalize a OC</Text>

                  {/* Comprovante para visualização */}
                  {(request as any).paymentProofUrl && (
                    <Pressable onPress={() => Linking.openURL((request as any).paymentProofUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 20 }}>💳</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante de Pagamento</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                        </View>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Nota Fiscal */}
                  {(request as any).invoiceUrl ? (
                    <Pressable onPress={() => Linking.openURL((request as any).invoiceUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                        <Text style={{ fontSize: 20 }}>🧾</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Nota Fiscal Anexada</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                        </View>
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <TouchableOpacity
                      onPress={handlePickInvoice}
                      disabled={uploadInvoiceMutation.isPending}
                      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.warning}60`, borderRadius: 12, paddingVertical: 20, marginBottom: 12, opacity: uploadInvoiceMutation.isPending ? 0.6 : 1 }}
                    >
                      {uploadInvoiceMutation.isPending ? (
                        <><ActivityIndicator size="small" /><Text style={{ color: colors.warning, fontSize: 14, marginLeft: 8 }}>Enviando...</Text></>
                      ) : (
                        <><Text style={{ fontSize: 24 }}>🧾</Text><Text style={{ color: colors.warning, fontWeight: "600", fontSize: 14 }}>{invoiceFileName ?? "Anexar Nota Fiscal (PDF)"}</Text></>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Botão Finalizar OC */}
                  <TouchableOpacity
                    onPress={handleFinalizeOC}
                    disabled={finalizeOCMutation.isPending}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: finalizeOCMutation.isPending ? 0.7 : 1 }}
                  >
                    {finalizeOCMutation.isPending ? <ActivityIndicator color="white" /> : <><Text style={{ fontSize: 18 }}>📦</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Finalizar Ordem de Compra</Text></>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* ─── Barra de ações fixa na parte inferior ─── */}
        {showFixedButtons && (
          <View style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: "row",
            gap: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 8,
          }}>
            {/* Botão Rejeitar */}
            <TouchableOpacity
              onPress={() => setShowRejectModal(true)}
              disabled={rejectMutation.isPending || approveMutation.isPending}
              style={{
                flex: 1,
                backgroundColor: `${colors.error}15`,
                borderWidth: 1.5,
                borderColor: `${colors.error}50`,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {rejectMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>❌</Text>
                  <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>Rejeitar</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Botão Aprovar */}
            <TouchableOpacity
              onPress={() => setShowApproveModal(true)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              style={{
                flex: 2,
                backgroundColor: colors.success,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
                shadowColor: colors.success,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              {approveMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>✅</Text>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Aprovar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Modais */}
      <ApproveModal
        visible={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={(comment) => approveMutation.mutate({ requestId: request.id, comment: comment || undefined })}
        isLoading={approveMutation.isPending}
      />
      <RejectModal
        visible={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(comment) => rejectMutation.mutate({ requestId: request.id, comment })}
        isLoading={rejectMutation.isPending}
      />
      {/* Modal de recusa do comprovante de pagamento */}
      <RejectModal
        visible={showPaymentRejectModal}
        onClose={() => setShowPaymentRejectModal(false)}
        onConfirm={(comment) => rejectMutation.mutate({ requestId: request.id, comment })}
        isLoading={rejectMutation.isPending}
      />
    </ScreenContainer>
  );
}
