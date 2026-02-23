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
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { RequestStatus, ProcurementRole } from "@/shared/types";
import { STEP_LABELS } from "@/shared/types";

const ROLE_CAN_ACT: Record<RequestStatus, ProcurementRole[]> = {
  rascunho: ["solicitante", "admin"],
  aguardando_gerente: ["gerente", "admin"],
  aguardando_orcamento: ["solicitante", "admin"],
  aguardando_controladoria: ["controladoria", "admin"],
  aguardando_diretoria: ["diretoria", "admin"],
  aguardando_ordem_compra: ["financeiro", "admin"],
  aguardando_financeiro: ["financeiro", "admin"],
  concluida: [],
  rejeitada: ["solicitante", "admin"],
  cancelada: [],
};

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

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [comment, setComment] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [budgetFileName, setBudgetFileName] = useState<string | null>(null);

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
    onSuccess: () => { invalidateAll(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setComment(""); },
    onError: (e) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Erro", e.message); },
  });

  const rejectMutation = trpc.approvals.reject.useMutation({
    onSuccess: () => { invalidateAll(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setComment(""); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const uploadBudgetMutation = trpc.requests.uploadBudget.useMutation({
    onSuccess: () => { invalidateAll(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("✅ Orçamento anexado!"); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const uploadFileMutation = trpc.requests.uploadFile.useMutation({
    onSuccess: () => { invalidateAll(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("✅ PDF anexado com sucesso!", "O orçamento já está disponível para visualização."); },
    onError: (e) => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Erro ao anexar", e.message); },
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

  const handleApprove = () => {
    Alert.alert("Confirmar Aprovação", "Deseja aprovar esta solicitação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aprovar",
        onPress: () => approveMutation.mutate({ requestId: request.id, comment: comment || undefined }),
      },
    ]);
  };

  const handleReject = () => {
    if (!comment.trim()) { Alert.alert("Motivo obrigatório", "Informe o motivo da rejeição."); return; }
    Alert.alert("Confirmar Rejeição", "A solicitação voltará para o solicitante corrigir em até 48h.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Rejeitar", style: "destructive", onPress: () => rejectMutation.mutate({ requestId: request.id, comment }) },
    ]);
  };

  const handlePickBudget = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setBudgetFileName(file.name);
      // Read file as base64 and upload to S3 via server
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
    if (!orderNumber.trim()) { Alert.alert("Campo obrigatório", "Informe o número da ordem de compra."); return; }
    approveMutation.mutate({ requestId: request.id, purchaseOrderNumber: orderNumber, comment: comment || undefined });
  };

  const handleFinalize = () => {
    if (!paymentInfo.trim()) { Alert.alert("Campo obrigatório", "Informe as informações de pagamento."); return; }
    approveMutation.mutate({ requestId: request.id, paymentInfo, comment: comment || undefined });
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <View className="flex-row items-center px-5 py-4 border-b border-border">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text className="text-primary text-base">← Voltar</Text>
          </Pressable>
          <Text className="flex-1 text-center text-base font-bold text-foreground" numberOfLines={1}>
            {request.requestNumber}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          <View className="flex-row items-center gap-2 mb-4 flex-wrap">
            <StatusBadge status={currentStatus} />
            <UrgencyBadge level={request.urgencyLevel as any} />
            {request.deadlineAt && <DeadlineTimer deadline={request.deadlineAt} />}
          </View>

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

          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-sm font-bold text-foreground mb-4">Fluxo de Aprovação</Text>
            <ApprovalTimeline currentStatus={currentStatus} />
          </View>

          {history && history.length > 0 && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <Text className="text-sm font-bold text-foreground mb-3">Histórico</Text>
              {history.map((h: any) => (
                <View key={h.id} className="flex-row gap-3 mb-3">
                  <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mt-0.5">
                    <Text className="text-xs">
                      {h.action === "aprovada" ? "✅" : h.action === "rejeitada" ? "❌" : h.action === "criada" ? "📝" : h.action === "orcamento_anexado" ? "📄" : h.action === "ordem_emitida" ? "🛒" : h.action === "pagamento_realizado" ? "💰" : "🔄"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-foreground">{h.userName}</Text>
                      <Text className="text-xs text-muted">{formatDate(h.createdAt)}</Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {(STEP_LABELS as Record<string, string>)[h.step] ?? h.step} — {h.action}
                    </Text>
                    {h.comment && <Text className="text-xs text-foreground mt-1 italic">"{h.comment}"</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {canAct && !isDone && !isCancelled && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <Text className="text-sm font-bold text-foreground mb-3">Ação Necessária</Text>

              {currentStatus === "aguardando_orcamento" && (
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-2">Anexe o PDF do orçamento obtido</Text>
                  <TouchableOpacity
                    onPress={handlePickBudget}
                    disabled={uploadFileMutation.isPending || uploadBudgetMutation.isPending}
                    className="flex-row items-center justify-center gap-2 border-2 border-dashed border-primary/40 rounded-xl py-4"
                    style={{ opacity: uploadFileMutation.isPending ? 0.6 : 1 }}
                  >
                    {uploadFileMutation.isPending ? (
                      <><ActivityIndicator size="small" /><Text className="text-primary text-sm ml-2">Enviando PDF...</Text></>
                    ) : (
                      <><Text className="text-2xl">📎</Text><Text className="text-primary font-semibold text-sm">{budgetFileName ?? "Selecionar PDF do Orçamento"}</Text></>
                    )}
                  </TouchableOpacity>
                  {budgetFileName && !uploadFileMutation.isPending && (
                    <Text className="text-xs text-success text-center mt-1">✅ {budgetFileName} selecionado</Text>
                  )}
                </View>
              )}

              {currentStatus === "aguardando_ordem_compra" && (
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1">Número da Ordem de Compra</Text>
                  <TextInput value={orderNumber} onChangeText={setOrderNumber} placeholder="Ex: OC-2024-001"
                    placeholderTextColor={colors.muted} className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-2" returnKeyType="done" />
                  <TouchableOpacity onPress={handleIssueOrder} disabled={approveMutation.isPending}
                    className="bg-primary rounded-xl py-3 items-center" style={{ opacity: approveMutation.isPending ? 0.7 : 1 }}>
                    {approveMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Emitir Ordem de Compra</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {currentStatus === "aguardando_financeiro" && (
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1">Informações de Pagamento</Text>
                  <TextInput value={paymentInfo} onChangeText={setPaymentInfo} placeholder="Banco, agência, data do pagamento..."
                    placeholderTextColor={colors.muted} className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-2"
                    multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top" }} />
                  <TouchableOpacity onPress={handleFinalize} disabled={approveMutation.isPending}
                    className="bg-success rounded-xl py-3 items-center" style={{ opacity: approveMutation.isPending ? 0.7 : 1 }}>
                    {approveMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Confirmar Pagamento</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {isRejected && (
                <TouchableOpacity onPress={() => approveMutation.mutate({ requestId: request.id, comment: "Solicitação corrigida e reenviada" })}
                  disabled={approveMutation.isPending} className="bg-primary rounded-xl py-3 items-center" style={{ opacity: approveMutation.isPending ? 0.7 : 1 }}>
                  {approveMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Reenviar para Aprovação</Text>}
                </TouchableOpacity>
              )}

              {!isRejected && currentStatus !== "aguardando_orcamento" && currentStatus !== "aguardando_ordem_compra" && currentStatus !== "aguardando_financeiro" && (
                <>
                  <TextInput value={comment} onChangeText={setComment}
                    placeholder="Comentário (obrigatório para rejeição)"
                    placeholderTextColor={colors.muted} className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground mb-3"
                    multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: "top" }} />
                  <View className="flex-row gap-3">
                    <TouchableOpacity onPress={handleReject} disabled={rejectMutation.isPending || approveMutation.isPending}
                      className="flex-1 bg-error/10 border border-error/30 rounded-xl py-3 items-center" style={{ opacity: rejectMutation.isPending ? 0.7 : 1 }}>
                      {rejectMutation.isPending ? <ActivityIndicator color="red" /> : <Text className="text-error font-bold">Rejeitar</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleApprove} disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-success rounded-xl py-3 items-center" style={{ opacity: approveMutation.isPending ? 0.7 : 1 }}>
                      {approveMutation.isPending ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Aprovar</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
