import { ScreenContainer } from "@/components/screen-container";
import { StatusBadge, UrgencyBadge, DeadlineTimer } from "@/components/procurement/Badges";
import { ConfirmModal } from "@/components/confirm-modal";
import { ApprovalTimeline } from "@/components/procurement/ApprovalTimeline";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type { RequestStatus, ProcurementRole, PaymentMethod } from "@/shared/types";
import { STEP_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from "@/shared/types";

// Lê um arquivo como base64 — compatível com web (FileReader) e nativo (expo-file-system)
async function readFileAsBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    // Na web, o DocumentPicker retorna um blob URL (blob:http://...)
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove o prefixo "data:...;base64,"
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  }
}

const ROLE_CAN_ACT: Record<RequestStatus, ProcurementRole[]> = {
  rascunho: ["solicitante", "admin"],
  aguardando_gerente: ["gerente", "admin"],
  aguardando_orcamento: ["orcamento", "admin"],
  aguardando_controladoria: ["controladoria", "admin"],
  aguardando_diretoria: ["diretoria", "admin"],
  aguardando_ordem_compra: ["orcamento", "admin"],
  aguardando_aprovacao_compra: ["financeiro", "admin"],
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
  "aguardando_aprovacao_compra",
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

// ─── Modal de Cancelamento ──────────────────────────────────────────────────────
function CancelModal({
  visible,
  onClose,
  onConfirm,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}) {
  const colors = useColors();
  const [reason, setReason] = useState("");

  const [touched, setTouched] = useState(false);
  const isReasonEmpty = reason.trim().length === 0;

  const handleConfirm = () => {
    setTouched(true);
    if (isReasonEmpty) return;
    onConfirm(reason.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Voltar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Cancelar Solicitação</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={{ backgroundColor: `${colors.error}10`, borderWidth: 1, borderColor: `${colors.error}30`, borderRadius: 16, padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Text style={{ fontSize: 24 }}>🚫</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14, marginBottom: 4 }}>Atenção</Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                Esta ação cancelará a solicitação permanentemente. O solicitante será notificado.
              </Text>
            </View>
          </View>

          <View>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
              Motivo do cancelamento <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
              Informe o motivo para que fique registrado no histórico da solicitação.
            </Text>
            <TextInput
              value={reason}
              onChangeText={(text) => { setReason(text); setTouched(true); }}
              placeholder="Descreva o motivo do cancelamento..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: touched && isReasonEmpty ? colors.error : colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                minHeight: 100,
                textAlignVertical: "top",
              }}
            />
            {touched && isReasonEmpty && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                O motivo é obrigatório para cancelar a solicitação.
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: colors.error,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: isLoading || (touched && isReasonEmpty) ? 0.5 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>🚫</Text>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Confirmar Cancelamento</Text>
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "boleto" | "cartao_avista" | "cartao_parcelado" | null>(null);
  const [paymentInstallments, setPaymentInstallments] = useState<string>("");
  const [paymentObservations, setPaymentObservations] = useState("");
  const [budgetFileName, setBudgetFileName] = useState<string | null>(null);
  const [pendingBudgetBase64, setPendingBudgetBase64] = useState<string | null>(null);
  const [pendingBudgetMime, setPendingBudgetMime] = useState<string>("application/pdf");
  const [paymentProofFileName, setPaymentProofFileName] = useState<string | null>(null);
  const [paymentProofLocalUri, setPaymentProofLocalUri] = useState<string | null>(null); // URI local para pré-visualização antes do upload
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  const [invoiceLocalUri, setInvoiceLocalUri] = useState<string | null>(null); // URI local para pré-visualização da nota fiscal
  const [ocSiagriFileName, setOcSiagriFileName] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentRejectModal, setShowPaymentRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Modais de confirmação cross-platform (substitui Alert.alert com callbacks na web)
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmModal({ visible: true, ...opts });
  };

  const hideConfirm = () => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
  };

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
      // Não limpa budgetFileName aqui — é limpo após submitBudget ou na edição
      setPendingBudgetBase64(null);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao anexar", e.message);
    },
  });

  const submitBudgetMutation = trpc.requests.submitBudget.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBudgetFileName(null);
      setPendingBudgetBase64(null);
      // Navega imediatamente — Alert.alert com callback não funciona na web
      router.back();
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao enviar orçamento", e.message);
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

  const uploadOCSiagriMutation = trpc.requests.uploadOCSiagri.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ OC Siagri anexada!", "O PDF da OC Siagri foi registrado com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao anexar OC Siagri", e.message);
    },
  });

  const finalizeOCMutation = trpc.requests.finalizeOC.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navega imediatamente — Alert.alert com callback não funciona na web
      router.back();
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao finalizar OC", e.message);
    },
  });

  const [showReopenModal, setShowReopenModal] = useState(false);

  const reopenMutation = trpc.requests.reopen.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowReopenModal(false);
      Alert.alert("✅ Solicitação reaberta", "A solicitação foi reaberta e retornou ao início do fluxo.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao reabrir", e.message);
    },
  });

  const cancelMutation = trpc.requests.cancel.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCancelModal(false);
      Alert.alert("✅ Solicitação cancelada", "A solicitação foi cancelada com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao cancelar", e.message);
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
  const isMasterUser = (user as any)?.approvalLevel === "master";
  const currentStatus = request.status as RequestStatus;

  // Combinar todos os papéis do usuário (primário + extras + approvalLevel + extraApprovalLevels)
  const parseJsonArr = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };
  const allUserRoles: string[] = [
    userRole,
    ...parseJsonArr((user as any)?.extraRoles),
    ...((user as any)?.approvalLevel && (user as any)?.approvalLevel !== "nenhum" && (user as any)?.approvalLevel !== "master" ? [(user as any).approvalLevel] : []),
    ...parseJsonArr((user as any)?.extraApprovalLevels).filter((l: string) => l !== "nenhum" && l !== "master"),
  ];
  const canAct = allUserRoles.some(r => ROLE_CAN_ACT[currentStatus]?.includes(r as ProcurementRole)) ?? false;
  const isRejected = currentStatus === "rejeitada";
  const isCancelled = currentStatus === "cancelada";
  const isDone = currentStatus === "concluida";
  const isApproveOnly = STATUS_APPROVE_ONLY.includes(currentStatus);

  // Permissão de cancelar: somente o solicitante que abriu ou master
  // Comparar como Number para evitar mismatch entre string e number
  const isOwner = Number(request.requesterId) === Number((user as any)?.id);
  const canCancel = (isOwner || isMasterUser) && !isCancelled && !isDone;

  // Determina se deve mostrar botões fixos de aprovar/rejeitar
  const showFixedButtons = canAct && !isDone && !isCancelled && !isRejected && !isApproveOnly;
  const showFixedApproveOnly = canAct && !isDone && !isCancelled && isApproveOnly;
  const bottomBarHeight = 80 + (insets.bottom > 0 ? insets.bottom : 16);

  const handlePrint = async () => {
    if (!request) return;
    setIsPrinting(true);
    try {
      const itemsRows = (request.items ?? []).map((item: any) => `
        <tr>
          <td>${item.description ?? "—"}</td>
          <td style="text-align:center">${item.quantity ?? "—"} ${item.unit ?? ""}</td>
          <td style="text-align:right">${item.unitPrice ? Number(item.unitPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
          <td style="text-align:right">${item.totalPrice ? Number(item.totalPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</td>
        </tr>`).join("");

      const historyRows = (history ?? []).map((h: any) => `
        <tr>
          <td>${new Date(h.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          <td>${h.userName ?? "—"}</td>
          <td>${h.action ?? "—"}</td>
          <td>${h.comment ?? ""}</td>
        </tr>`).join("");

      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Solicitação ${(request as any).requestNumber ?? ("#" + request.id)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    .header { background: #166534; color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header .sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
    .badge { display: inline-block; background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
    .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
    .section-title { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .row { display: flex; gap: 8px; margin-bottom: 6px; }
    .label { color: #6b7280; min-width: 130px; }
    .value { font-weight: 600; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .total-row td { font-weight: 700; background: #f9fafb; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    @page { margin: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="sub">CGS Agrícola — Sistema de Gestão de Compras</div>
      <h1>Solicitação ${(request as any).requestNumber ?? ("#" + request.id)}</h1>
    </div>
    <div class="badge">✓ CONCLUÍDA</div>
  </div>

  <div class="section">
    <div class="section-title">Informações Gerais</div>
    <div class="row"><span class="label">Aplicação/Finalidade:</span><span class="value">${request.application ?? "—"}</span></div>
    <div class="row"><span class="label">Solicitante:</span><span class="value">${request.requesterName ?? "—"}</span></div>
    <div class="row"><span class="label">Departamento:</span><span class="value">${request.department ?? "—"}</span></div>
    ${request.costCenterCode ? `<div class="row"><span class="label">Centro de Custo:</span><span class="value">${request.costCenterCode}</span></div>` : ""}
    <div class="row"><span class="label">Urgência:</span><span class="value">${request.urgencyLevel ?? "—"}</span></div>
    <div class="row"><span class="label">Criado em:</span><span class="value">${new Date(request.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
    ${request.purchaseOrderNumber ? `<div class="row"><span class="label">Ordem de Compra:</span><span class="value">${request.purchaseOrderNumber}</span></div>` : ""}
    ${(request as any).paymentMethod ? `<div class="row"><span class="label">Método de Pagamento:</span><span class="value">${(({ pix: "PIX", boleto: "Boleto", cartao_avista: "Cartão à Vista", cartao_parcelado: "Cartão Parcelado" } as Record<string, string>)[(request as any).paymentMethod] ?? (request as any).paymentMethod)}</span></div>` : ""}
    ${(request as any).paymentInfo ? `<div class="row"><span class="label">Dados de Pagamento:</span><span class="value">${(request as any).paymentInfo}</span></div>` : ""}
    ${(request as any).paymentObservations ? `<div class="row"><span class="label">Obs. Pagamento:</span><span class="value">${(request as any).paymentObservations}</span></div>` : ""}
    ${request.totalEstimatedValue ? `<div class="row"><span class="label">Valor Total:</span><span class="value">${Number(request.totalEstimatedValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>` : ""}
    ${request.observations ? `<div class="row"><span class="label">Observações:</span><span class="value">${request.observations}</span></div>` : ""}
  </div>

  ${(request.items ?? []).length > 0 ? `
  <div class="section">
    <div class="section-title">Itens Solicitados</div>
    <table>
      <thead><tr><th>Descrição</th><th style="text-align:center">Qtd/Un</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemsRows}</tbody>
      ${request.totalEstimatedValue ? `<tfoot><tr class="total-row"><td colspan="3">Total Geral</td><td style="text-align:right">${Number(request.totalEstimatedValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr></tfoot>` : ""}
    </table>
  </div>` : ""}

  ${(history ?? []).length > 0 ? `
  <div class="section">
    <div class="section-title">Histórico de Aprovações</div>
    <table>
      <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Comentário</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </div>` : ""}

  <div class="footer">
    Documento gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} — CGS Agrícola
  </div>
</body>
</html>`;

      await Print.printAsync({ html });
    } catch (err: any) {
      if (!err?.message?.includes("cancelled") && !err?.message?.includes("cancel")) {
        Alert.alert("Erro ao imprimir", "Não foi possível abrir a impressão. Tente novamente.");
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePickBudget = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setBudgetFileName(file.name);
      // Armazena localmente — o upload ocorre ao clicar em "Enviar Orçamento"
      const base64 = await readFileAsBase64(file.uri);
      setPendingBudgetBase64(base64);
      setPendingBudgetMime(file.mimeType ?? "application/pdf");
    } catch (err) {
      console.error("[PDF Upload]", err);
      Alert.alert("Erro", "Não foi possível selecionar ou ler o arquivo.");
    }
  };

  const handleIssueOrder = () => {
    showConfirm({
      title: "Confirmar Emissão de OC",
      message: "Confirmar a emissão da OC e encaminhar para Aprovação Financeiro?",
      confirmText: "Confirmar",
      onConfirm: () => approveMutation.mutate({ requestId: request.id, purchaseOrderNumber: "" }),
    });
  };

  const handleApproveFinanceiro = () => {
    if (!selectedPaymentMethod) { Alert.alert("Campo obrigatório", "Selecione o método de pagamento antes de aprovar."); return; }
    if (!paymentInfo.trim()) { Alert.alert("Campo obrigatório", "Informe os dados de pagamento antes de aprovar."); return; }
    if (selectedPaymentMethod === "cartao_parcelado") {
      const installmentsNum = parseInt(paymentInstallments, 10);
      if (!paymentInstallments.trim() || isNaN(installmentsNum) || installmentsNum < 1 || installmentsNum > 48) {
        Alert.alert("Campo obrigatório", "Informe o número de parcelas (1 a 48) para cartão parcelado."); return;
      }
    }
    const methodLabel = PAYMENT_METHOD_LABELS[selectedPaymentMethod];
    const installmentsNum = selectedPaymentMethod === "cartao_parcelado" ? parseInt(paymentInstallments, 10) : undefined;
    showConfirm({
      title: "✅ Aprovar Compra",
      message: `Confirmar aprovação com pagamento via ${methodLabel}${installmentsNum ? ` em ${installmentsNum}x` : ""} e avançar para Comprovante de Pagamento?`,
      confirmText: "Aprovar",
      onConfirm: () => approveMutation.mutate({ requestId: request.id, paymentInfo, paymentMethod: selectedPaymentMethod, paymentInstallments: installmentsNum }),
    });
  };

  const handleFinalize = () => {
    // Mantido para compatibilidade — não usado diretamente na UI
    if (!paymentInfo.trim()) { Alert.alert("Campo obrigatório", "Informe as informações de pagamento."); return; }
    showConfirm({
      title: "Confirmar Dados de Pagamento",
      message: "Confirmar os dados de pagamento e avançar para o Financeiro?",
      confirmText: "Confirmar",
      onConfirm: () => approveMutation.mutate({ requestId: request.id, paymentInfo }),
    });
  };

  const handlePickPaymentProof = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setPaymentProofFileName(file.name);
      // Salvar URI local para pré-visualização de imagens
      const isImage = file.mimeType?.startsWith("image/") ?? false;
      setPaymentProofLocalUri(isImage ? file.uri : null);
      const base64 = await readFileAsBase64(file.uri);
      uploadPaymentProofMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  const handlePickInvoice = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setInvoiceFileName(file.name);
      // Salvar URI local para pré-visualização de imagens
      const isImage = file.mimeType?.startsWith("image/") ?? false;
      setInvoiceLocalUri(isImage ? file.uri : null);
      const base64 = await readFileAsBase64(file.uri);
      uploadInvoiceMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  // Captura comprovante de pagamento pela câmera (apenas mobile)
  const handleCameraPaymentProof = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "É necessário permitir o acesso à câmera para fotografar o comprovante.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const fileName = `comprovante_${Date.now()}.jpg`;
      setPaymentProofFileName(fileName);
      setPaymentProofLocalUri(asset.uri);
      const base64 = await readFileAsBase64(asset.uri);
      uploadPaymentProofMutation.mutate({ requestId: request.id, fileName, base64, mimeType: "image/jpeg" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível capturar a foto.");
    }
  };

  // Captura nota fiscal pela câmera (apenas mobile)
  const handleCameraInvoice = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão Negada", "É necessário permitir o acesso à câmera para fotografar a nota fiscal.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const fileName = `nota_fiscal_${Date.now()}.jpg`;
      setInvoiceFileName(fileName);
      setInvoiceLocalUri(asset.uri);
      const base64 = await readFileAsBase64(asset.uri);
      uploadInvoiceMutation.mutate({ requestId: request.id, fileName, base64, mimeType: "image/jpeg" });
    } catch (err) {
      Alert.alert("Erro", "Não foi possível capturar a foto.");
    }
  };

  const handleFinalizeOC = () => {
    showConfirm({
      title: "📦 Finalizar Ordem de Compra",
      message: "Confirma que o comprovante de pagamento foi verificado e deseja encerrar esta OC? Ela será habilitada nos Malotes.",
      confirmText: "Finalizar OC",
      onConfirm: () => finalizeOCMutation.mutate({ requestId: request.id }),
    });
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
            paddingBottom: (showFixedButtons || showFixedApproveOnly || isDone) ? bottomBarHeight + 20 : 40,
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
              {request.osMyfarm && (
                <Text className="text-sm text-muted">OS Myfarm: <Text className="text-foreground font-bold">{request.osMyfarm}</Text></Text>
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
          {request.budgetFileUrl && (() => {
            // Status em que o orçamento pode ser editado:
            // - Fluxo Normal:              Gerente → Orçamento → Controladoria* → Diretoria → ...
            // - Fluxo Urgente/Emergencial: Gerente → Diretoria → Orçamento → Controladoria* → ...
            // Em ambos os fluxos, a etapa editável é aguardando_controladoria (imediatamente após o orçamento)
            const canEditBudget =
              currentStatus === "aguardando_controladoria" &&
              (allUserRoles.some(r => ["orcamento", "admin"].includes(r)) || isMasterUser);
            // Status em que o orçamento já passou da etapa editável (bloqueado)
            const EDITABLE_STATUSES: RequestStatus[] = ["aguardando_orcamento", "aguardando_controladoria"];
            const isBudgetLocked =
              !EDITABLE_STATUSES.includes(currentStatus) &&
              !isDone && !isCancelled && !isRejected &&
              (allUserRoles.some(r => ["orcamento", "admin"].includes(r)) || isMasterUser);
            return (
              <View className="bg-success/10 border border-success/30 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center gap-3">
                  <Text className="text-2xl">📄</Text>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-success">Orçamento Anexado</Text>
                    <Text className="text-xs text-muted" numberOfLines={1}>Toque para visualizar o PDF</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(request.budgetFileUrl!)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                  >
                    <Text className="text-primary text-xs font-semibold">👁 Ver</Text>
                  </TouchableOpacity>
                  {/* Botão de edição: visível apenas nas etapas editáveis */}
                  {canEditBudget && (
                    <TouchableOpacity
                      onPress={handlePickBudget}
                      disabled={uploadFileMutation.isPending}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: uploadFileMutation.isPending ? undefined : `${colors.warning}20`,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: `${colors.warning}50`,
                      }}
                    >
                      {uploadFileMutation.isPending ? (
                        <ActivityIndicator size="small" color={colors.warning} />
                      ) : (
                        <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "700" }}>✏️ Editar</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {/* Feedback de substituição em andamento */}
                {canEditBudget && budgetFileName && (
                  <Text style={{ color: colors.warning, fontSize: 11, marginTop: 8 }}>⚠️ Novo arquivo selecionado: {budgetFileName} — aguardando upload...</Text>
                )}
                {/* Mensagem informativa quando orçamento está bloqueado (etapa já aprovada) */}
                {isBudgetLocked && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: `${colors.border}` }}>
                    <Text style={{ fontSize: 14 }}>🔒</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, flex: 1 }}>Orçamento bloqueado — etapa já aprovada. Não é possível substituir o PDF após a aprovação da Controladoria/Diretoria.</Text>
                  </View>
                )}
              </View>
            );
          })()}


          {/* Comprovante de pagamento — visível para todos nas etapas 8 e 9 e quando concluída */}
          {(currentStatus === "aguardando_comprovante_pagamento" || currentStatus === "aguardando_verificacao_compras" || currentStatus === "concluida") && (request as any).paymentProofUrl && (
            <Pressable
              onPress={() => Linking.openURL((request as any).paymentProofUrl)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginBottom: 16 }]}
            >
              {(request as any).paymentProofUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: colors.success }}>
                  <Image source={{ uri: (request as any).paymentProofUrl }} style={{ width: "100%", height: 180, resizeMode: "cover" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>💳</Text>
                      <View>
                        <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante de Pagamento</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para ampliar</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${colors.success}15`, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: `${colors.success}40` }}>
                  <Text style={{ fontSize: 24 }}>💳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 14 }}>Comprovante de Pagamento</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Toque para visualizar o PDF</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>👁 Ver</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Nota Fiscal — visível para todos na etapa 9 e quando concluída */}
          {(currentStatus === "aguardando_verificacao_compras" || currentStatus === "concluida") && (request as any).invoiceUrl && (
            <Pressable
              onPress={() => Linking.openURL((request as any).invoiceUrl)}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginBottom: 16 }]}
            >
              {(request as any).invoiceUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: colors.success }}>
                  <Image source={{ uri: (request as any).invoiceUrl }} style={{ width: "100%", height: 180, resizeMode: "cover" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>🧾</Text>
                      <View>
                        <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Nota Fiscal</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para ampliar</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${colors.success}15`, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: `${colors.success}40` }}>
                  <Text style={{ fontSize: 24 }}>🧾</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 14 }}>Nota Fiscal</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Toque para visualizar o PDF</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>👁 Ver</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Fluxo de aprovação */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-sm font-bold text-foreground mb-4">Fluxo de Aprovação</Text>
            <ApprovalTimeline currentStatus={currentStatus} urgencyLevel={request.urgencyLevel} />
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
                        : h.action === "cancelada" ? "🚫"
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
                        reaberta: "Reaberta pelo master",
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
                        compra_aprovada: "Compra aprovada",
                        compra_cancelada: "Compra cancelada",
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
                  <Text className="text-xs text-muted mb-3">Selecione o PDF do orçamento e clique em Enviar Orçamento para avançar</Text>
                  <TouchableOpacity
                    onPress={handlePickBudget}
                    disabled={uploadFileMutation.isPending || approveMutation.isPending}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.primary}60`,
                      borderRadius: 12, paddingVertical: 20,
                      opacity: (uploadFileMutation.isPending || approveMutation.isPending) ? 0.6 : 1,
                    }}
                  >
                    {uploadFileMutation.isPending ? (
                      <><ActivityIndicator size="small" /><Text style={{ color: colors.primary, fontSize: 14, marginLeft: 8 }}>Enviando PDF...</Text></>
                    ) : (
                      <><Text style={{ fontSize: 24 }}>📎</Text><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{budgetFileName ?? (request.budgetFileUrl ? "Trocar PDF do Orçamento" : "Selecionar PDF do Orçamento")}</Text></>
                    )}
                  </TouchableOpacity>
                  {(budgetFileName || request.budgetFileUrl) && !uploadFileMutation.isPending && (
                    <Text style={{ color: colors.success, fontSize: 12, textAlign: "center", marginTop: 8 }}>✅ {budgetFileName ?? "Orçamento já anexado"}</Text>
                  )}
                  {/* Botão Enviar Orçamento - habilitado após PDF selecionado ou já anexado */}
                  {(budgetFileName || request.budgetFileUrl) && !uploadFileMutation.isPending && (
                    <TouchableOpacity
                      onPress={() => {
                        if (!budgetFileName && !request.budgetFileUrl) {
                          Alert.alert("PDF obrigatório", "Selecione o PDF do orçamento antes de enviar.");
                          return;
                        }
                        showConfirm({
                          title: "📤 Enviar Orçamento",
                          message: "Confirma o envio do orçamento? O fluxo avançará para a Controladoria.",
                          confirmText: "Enviar",
                          onConfirm: () => {
                            // Se há um arquivo pendente (novo), faz upload primeiro, depois submitBudget
                            if (pendingBudgetBase64 && budgetFileName) {
                              uploadFileMutation.mutate(
                                { requestId: request.id, fileName: budgetFileName, base64: pendingBudgetBase64, mimeType: pendingBudgetMime },
                                { onSuccess: () => submitBudgetMutation.mutate({ requestId: request.id }) }
                              );
                            } else {
                              // PDF já estava anexado anteriormente, apenas envia
                              submitBudgetMutation.mutate({ requestId: request.id });
                            }
                          },
                        });
                      }}
                      disabled={submitBudgetMutation.isPending || uploadFileMutation.isPending}
                      style={{
                        marginTop: 12,
                        backgroundColor: colors.success,
                        borderRadius: 12,
                        paddingVertical: 14,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 8,
                        opacity: (submitBudgetMutation.isPending || uploadFileMutation.isPending) ? 0.7 : 1,
                      }}
                    >
                      {(submitBudgetMutation.isPending || uploadFileMutation.isPending) ? (
                        <><ActivityIndicator color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 15, marginLeft: 8 }}>Enviando...</Text></>
                      ) : (
                        <><Text style={{ fontSize: 18 }}>📤</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Enviar Orçamento</Text></>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Edição de Orçamento:
                  - Fluxo Normal:              aguardando_controladoria = fluxo 04 (logo após orçamento)
                  - Fluxo Urgente/Emergencial: aguardando_controladoria = fluxo 05 (logo após orçamento)
                  Em ambos os casos, a etapa editável é aguardando_controladoria */}
              {currentStatus === "aguardando_controladoria" && (allUserRoles.some(r => ["orcamento", "admin"].includes(r)) || isMasterUser) && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">✏️ Editar Orçamento</Text>
                  <Text className="text-xs text-muted mb-3">A etapa de orçamento ainda não foi concluída. Você pode substituir o PDF do orçamento enquanto aguarda a aprovação da Controladoria.</Text>
                  <TouchableOpacity
                    onPress={handlePickBudget}
                    disabled={uploadFileMutation.isPending}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                      borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.warning}60`,
                      borderRadius: 12, paddingVertical: 16,
                      opacity: uploadFileMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {uploadFileMutation.isPending ? (
                      <><ActivityIndicator size="small" /><Text style={{ color: colors.warning, fontSize: 14, marginLeft: 8 }}>Enviando PDF...</Text></>
                    ) : (
                      <><Text style={{ fontSize: 20 }}>📎</Text><Text style={{ color: colors.warning, fontWeight: "600", fontSize: 14 }}>{budgetFileName ?? (request.budgetFileUrl ? "Substituir PDF do Orçamento" : "Selecionar PDF do Orçamento")}</Text></>
                    )}
                  </TouchableOpacity>
                  {budgetFileName && !uploadFileMutation.isPending && (
                    <>
                      <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 8 }}>📎 {budgetFileName} selecionado</Text>
                      <TouchableOpacity
                        onPress={() => {
                          if (!pendingBudgetBase64 || !budgetFileName) return;
                          showConfirm({
                            title: "📤 Substituir Orçamento",
                            message: "Confirma a substituição do PDF do orçamento?",
                            confirmText: "Substituir",
                            onConfirm: () => {
                              uploadFileMutation.mutate(
                                { requestId: request.id, fileName: budgetFileName, base64: pendingBudgetBase64, mimeType: pendingBudgetMime },
                                { onSuccess: () => { setBudgetFileName(null); Alert.alert("✅ PDF substituído!", "O orçamento foi atualizado com sucesso."); } }
                              );
                            },
                          });
                        }}
                        disabled={uploadFileMutation.isPending}
                        style={{
                          marginTop: 10,
                          backgroundColor: colors.warning,
                          borderRadius: 10,
                          paddingVertical: 12,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>📤</Text>
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Salvar Substituição</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Etapa 06: Emissão de OC + Dados de Pagamento */}
              {currentStatus === "aguardando_ordem_compra" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📋 Emissão de Ordem de Compra</Text>
                  <Text className="text-xs text-muted mb-4">Preencha os campos abaixo para emitir a OC e encaminhar ao Financeiro</Text>

                  {/* Upload OC Siagri */}
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>OC Siagri <Text style={{ color: colors.muted, fontWeight: "400" }}>(opcional)</Text></Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Anexe o PDF da Ordem de Compra gerada no Siagri</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
                      if (result.canceled || !result.assets?.[0]) return;
                      const file = result.assets[0];
                      const base64 = await readFileAsBase64(file.uri);
                      setOcSiagriFileName(file.name);
                      uploadOCSiagriMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
                    }}
                    disabled={uploadOCSiagriMutation.isPending}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.primary}60`, borderRadius: 12, paddingVertical: 16, marginBottom: 16, opacity: uploadOCSiagriMutation.isPending ? 0.6 : 1 }}
                  >
                    {uploadOCSiagriMutation.isPending
                      ? <ActivityIndicator color={colors.primary} />
                      : <><Text style={{ fontSize: 22 }}>📄</Text><Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>{ocSiagriFileName ?? (request as any).ocSiagriUrl ? "✅ OC Siagri anexada" : "Anexar OC Siagri (PDF)"}</Text></>
                    }
                  </TouchableOpacity>

                  {/* Botão Emitir OC */}
                  <TouchableOpacity
                    onPress={handleIssueOrder}
                    disabled={approveMutation.isPending}
                    style={{
                      backgroundColor: colors.primary,
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
                          <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                            Emitir OC e Enviar ao Financeiro
                          </Text>
                        </>
                      )
                    }
                  </TouchableOpacity>
                </View>
              )}

              {/* Fluxo 07: Aprovação Financeiro */}
              {currentStatus === "aguardando_aprovacao_compra" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">💰 Aprovação Financeiro</Text>
                  <Text className="text-xs text-muted mb-4">Revise os dados da compra e aprove ou recuse (somente Financeiro)</Text>

                  {/* Seletor de Método de Pagamento */}
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Método de Pagamento *</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {(["pix", "boleto", "cartao_avista", "cartao_parcelado"] as PaymentMethod[]).map((method) => (
                      <TouchableOpacity
                        key={method}
                        onPress={() => setSelectedPaymentMethod(method)}
                        style={{
                          flex: 1, minWidth: "45%",
                          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                          paddingVertical: 12, paddingHorizontal: 10,
                          borderRadius: 12, borderWidth: 2,
                          borderColor: selectedPaymentMethod === method ? colors.primary : colors.border,
                          backgroundColor: selectedPaymentMethod === method ? `${colors.primary}15` : colors.background,
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{PAYMENT_METHOD_ICONS[method]}</Text>
                        <Text style={{ color: selectedPaymentMethod === method ? colors.primary : colors.foreground, fontWeight: selectedPaymentMethod === method ? "700" : "400", fontSize: 13 }}>
                          {PAYMENT_METHOD_LABELS[method]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Dados de Pagamento */}
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Dados de Pagamento *</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Informe banco, agência, conta, valor, data prevista, chave PIX, etc.</Text>
                  <TextInput
                    value={paymentInfo}
                    onChangeText={setPaymentInfo}
                    placeholder="Ex: Banco Bradesco, Ag. 1234-5, CC 00012345-6, R$ 5.000,00, vencimento 30/03/2024..."
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

                  {/* Campo de Parcelas (apenas para cartão parcelado) */}
                  {selectedPaymentMethod === "cartao_parcelado" && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Número de Parcelas *</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Informe em quantas vezes será parcelado (1 a 48)</Text>
                      <TextInput
                        value={paymentInstallments}
                        onChangeText={(v) => setPaymentInstallments(v.replace(/[^0-9]/g, ""))}
                        placeholder="Ex: 12"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        maxLength={2}
                        returnKeyType="done"
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: paymentInstallments.trim() ? colors.border : `${colors.error}60`,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          fontSize: 16,
                          color: colors.foreground,
                          fontWeight: "700",
                          width: 120,
                        }}
                      />
                      {paymentInstallments && (
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                          {parseInt(paymentInstallments, 10) === 1 ? "À vista no cartão" : `${paymentInstallments}x parcelas`}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Valor estimado */}
                  {request.totalEstimatedValue && (
                    <View style={{ backgroundColor: `${colors.warning}10`, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>💵</Text>
                      <View>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Valor Estimado</Text>
                        <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 16 }}>{formatCurrency(request.totalEstimatedValue)}</Text>
                      </View>
                    </View>
                  )}

                  {/* Indicador de campos obrigatórios */}
                  {(!selectedPaymentMethod || !paymentInfo.trim() || (selectedPaymentMethod === "cartao_parcelado" && !paymentInstallments.trim())) && (
                    <Text style={{ color: colors.error, fontSize: 11, marginBottom: 12, textAlign: "center" }}>
                      {!selectedPaymentMethod ? "* Selecione o método de pagamento" : !paymentInfo.trim() ? "* Preencha os dados de pagamento" : "* Informe o número de parcelas"}
                    </Text>
                  )}

                  {/* Botões Aprovar / Cancelar */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => {
                        showConfirm({
                          title: "🚫 Recusar Compra",
                          message: "Deseja recusar esta compra? Ela retornará para o Compras revisar.",
                          confirmText: "Recusar",
                          destructive: true,
                          onConfirm: () => rejectMutation.mutate({ requestId: request.id, comment: "Compra recusada pelo Financeiro" }),
                        });
                      }}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      style={{ flex: 1, backgroundColor: `${colors.error}15`, borderWidth: 1.5, borderColor: `${colors.error}50`, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    >
                      <Text style={{ fontSize: 16 }}>❌</Text>
                      <Text style={{ color: colors.error, fontWeight: "700", fontSize: 14 }}>Recusar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleApproveFinanceiro}
                      disabled={approveMutation.isPending || rejectMutation.isPending || !selectedPaymentMethod || !paymentInfo.trim() || (selectedPaymentMethod === "cartao_parcelado" && !paymentInstallments.trim())}
                      style={{ flex: 1, backgroundColor: (selectedPaymentMethod && paymentInfo.trim() && !(selectedPaymentMethod === "cartao_parcelado" && !paymentInstallments.trim())) ? `${colors.success}15` : colors.border, borderWidth: 1.5, borderColor: (selectedPaymentMethod && paymentInfo.trim() && !(selectedPaymentMethod === "cartao_parcelado" && !paymentInstallments.trim())) ? `${colors.success}50` : "transparent", borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                    >
                      {approveMutation.isPending ? <ActivityIndicator size="small" color={colors.success} /> : <><Text style={{ fontSize: 16 }}>✅</Text><Text style={{ color: (selectedPaymentMethod && paymentInfo.trim() && !(selectedPaymentMethod === "cartao_parcelado" && !paymentInstallments.trim())) ? colors.success : colors.muted, fontWeight: "700", fontSize: 14 }}>Aprovar</Text></>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Fluxo 08: Comprovante de Pagamento (Financeiro) */}
              {currentStatus === "aguardando_comprovante_pagamento" && (() => {
                const payMethod = (request as any).paymentMethod as PaymentMethod | undefined;
                const isPix = payMethod === "pix";
                const hasProof = !!(request as any).paymentProofUrl;
                const hasObs = paymentObservations.trim().length > 0;
                // Para PIX: obrigatório comprovante. Para outros: obrigatório observações
                const canApprove = isPix ? hasProof : hasObs;
                return (
                  <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                    <Text className="text-sm font-bold text-foreground mb-1">💳 Comprovante de Pagamento</Text>

                    {/* Método de pagamento */}
                    {payMethod && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: `${colors.primary}10`, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                        <Text style={{ fontSize: 18 }}>{PAYMENT_METHOD_ICONS[payMethod]}</Text>
                        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>{PAYMENT_METHOD_LABELS[payMethod]}</Text>
                      </View>
                    )}

                    {/* Dados de pagamento do Financeiro */}
                    {(request as any).paymentInfo && (
                      <View style={{ backgroundColor: `${colors.surface}`, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                        <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Dados de Pagamento (Financeiro)</Text>
                        <Text style={{ color: colors.foreground, fontSize: 13 }}>{(request as any).paymentInfo}</Text>
                        {(request as any).paymentInstallments && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: `${colors.primary}10`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ fontSize: 14 }}>📅</Text>
                            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                              {(request as any).paymentInstallments === 1 ? "À vista no cartão" : `${(request as any).paymentInstallments}x parcelas`}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* PIX: comprovante obrigatório */}
                    {isPix && (
                      <>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Comprovante PIX *</Text>
                        <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Anexe o comprovante do PIX realizado (PDF, JPEG, PNG — obrigatório)</Text>
                        {hasProof ? (
                          <Pressable onPress={() => Linking.openURL((request as any).paymentProofUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                            {/* Miniatura se for imagem, caso contrário ícone de PDF */}
                            {(request as any).paymentProofUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                              <View style={{ borderRadius: 10, overflow: "hidden", marginBottom: 12, borderWidth: 2, borderColor: colors.success }}>
                                <Image source={{ uri: (request as any).paymentProofUrl }} style={{ width: "100%", height: 180, resizeMode: "cover" }} />
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 12, paddingVertical: 8 }}>
                                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>🖼️ Comprovante Anexado</Text>
                                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                                </View>
                              </View>
                            ) : (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                <Text style={{ fontSize: 22 }}>📄</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante Anexado</Text>
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                                </View>
                                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                              </View>
                            )}
                          </Pressable>
                        ) : (
                          <View style={{ marginBottom: 12 }}>
                            <TouchableOpacity
                              onPress={handlePickPaymentProof}
                              disabled={uploadPaymentProofMutation.isPending}
                              style={{ borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.error}60`, borderRadius: 12, overflow: "hidden", opacity: uploadPaymentProofMutation.isPending ? 0.6 : 1 }}
                            >
                              {uploadPaymentProofMutation.isPending ? (
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 }}>
                                  <ActivityIndicator size="small" />
                                  <Text style={{ color: colors.primary, fontSize: 14 }}>Enviando...</Text>
                                </View>
                              ) : paymentProofLocalUri ? (
                                // Pré-visualização local antes do upload completar
                                <View>
                                  <Image source={{ uri: paymentProofLocalUri }} style={{ width: "100%", height: 160, resizeMode: "cover" }} />
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: `${colors.warning}15` }}>
                                    <Text style={{ fontSize: 16 }}>⏳</Text>
                                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600" }}>{paymentProofFileName} — Enviando...</Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 }}>
                                  <Text style={{ fontSize: 24 }}>📎</Text>
                                  <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>{paymentProofFileName ?? "Selecionar Comprovante PIX (PDF/Imagem)"}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                            {Platform.OS !== "web" && !uploadPaymentProofMutation.isPending && (
                              <TouchableOpacity
                                onPress={handleCameraPaymentProof}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 10, backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: `${colors.primary}40` }}
                              >
                                <Text style={{ fontSize: 18 }}>📷</Text>
                                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Fotografar Comprovante</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </>
                    )}

                    {/* Boleto / Cartão: observações obrigatórias + comprovante opcional */}
                    {!isPix && (
                      <>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Observações e Vencimento *</Text>
                        <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Informe a data de vencimento, número do boleto ou parcelas do cartão (obrigatório)</Text>
                        <TextInput
                          value={paymentObservations}
                          onChangeText={setPaymentObservations}
                          placeholder="Ex: Boleto vence em 15/04/2025, código 12345. / Cartão em 3x de R$ 500,00, vencimento dia 10..."
                          placeholderTextColor={colors.muted}
                          multiline
                          numberOfLines={4}
                          style={{
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: hasObs ? colors.border : `${colors.error}60`,
                            borderRadius: 12,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            fontSize: 14,
                            color: colors.foreground,
                            minHeight: 100,
                            textAlignVertical: "top",
                            marginBottom: 12,
                          }}
                        />
                        {/* Comprovante opcional para boleto/cartão */}
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Comprovante (opcional)</Text>
                        {hasProof ? (
                          <Pressable onPress={() => Linking.openURL((request as any).paymentProofUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                            {(request as any).paymentProofUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                              <View style={{ borderRadius: 10, overflow: "hidden", marginBottom: 12, borderWidth: 2, borderColor: colors.success }}>
                                <Image source={{ uri: (request as any).paymentProofUrl }} style={{ width: "100%", height: 160, resizeMode: "cover" }} />
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 12, paddingVertical: 8 }}>
                                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>🖼️ Comprovante Anexado</Text>
                                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                                </View>
                              </View>
                            ) : (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                                <Text style={{ fontSize: 22 }}>📄</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante Anexado</Text>
                                  <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                                </View>
                              </View>
                            )}
                          </Pressable>
                        ) : (
                          <View style={{ marginBottom: 12 }}>
                            <TouchableOpacity
                              onPress={handlePickPaymentProof}
                              disabled={uploadPaymentProofMutation.isPending}
                              style={{ borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.primary}40`, borderRadius: 12, overflow: "hidden", opacity: uploadPaymentProofMutation.isPending ? 0.6 : 1 }}
                            >
                              {uploadPaymentProofMutation.isPending ? (
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 }}>
                                  <ActivityIndicator size="small" color={colors.primary} />
                                  <Text style={{ color: colors.primary, fontSize: 13 }}>Enviando...</Text>
                                </View>
                              ) : paymentProofLocalUri ? (
                                <View>
                                  <Image source={{ uri: paymentProofLocalUri }} style={{ width: "100%", height: 140, resizeMode: "cover" }} />
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: `${colors.warning}15` }}>
                                    <Text style={{ fontSize: 14 }}>⏳</Text>
                                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600" }}>{paymentProofFileName} — Enviando...</Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 }}>
                                  <Text style={{ fontSize: 20 }}>📎</Text>
                                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{paymentProofFileName ?? "Anexar comprovante (PDF/Imagem — opcional)"}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                            {Platform.OS !== "web" && !uploadPaymentProofMutation.isPending && (
                              <TouchableOpacity
                                onPress={handleCameraPaymentProof}
                                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 10, backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: `${colors.primary}40` }}
                              >
                                <Text style={{ fontSize: 18 }}>📷</Text>
                                <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Fotografar Comprovante</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </>
                    )}

                    {!canApprove && (
                      <Text style={{ color: colors.error, fontSize: 11, textAlign: "center", marginBottom: 10 }}>
                        {isPix ? "* Anexe o comprovante PIX para continuar" : "* Preencha as observações e vencimento para continuar"}
                      </Text>
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
                          showConfirm({
                            title: "✅ Aprovar Comprovante",
                            message: "Confirmar o pagamento e avançar para verificação do Compras?",
                            confirmText: "Confirmar",
                            onConfirm: () => approveMutation.mutate({ requestId: request.id, paymentObservations: !isPix ? paymentObservations.trim() : undefined }),
                          });
                        }}
                        disabled={approveMutation.isPending || rejectMutation.isPending || !canApprove}
                        style={{ flex: 2, backgroundColor: canApprove ? colors.success : colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
                      >
                        {approveMutation.isPending ? <ActivityIndicator color="white" /> : <><Text style={{ fontSize: 16 }}>✅</Text><Text style={{ color: canApprove ? "white" : colors.muted, fontWeight: "700", fontSize: 14 }}>Aprovar Pagamento</Text></>}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

              {/* Fluxo 09: Verificação Final (Compras) */}
              {currentStatus === "aguardando_verificacao_compras" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📝 Verificação Final — Compras</Text>
                  <Text className="text-xs text-muted mb-3">Verifique o comprovante, anexe a nota fiscal e finalize a OC</Text>

                  {/* Card de dados de pagamento para conferência */}
                  {((request as any).paymentMethod || (request as any).paymentInfo || (request as any).paymentObservations) && (
                    <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: `${colors.primary}30` }}>
                      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginBottom: 10 }}>💳 Dados de Pagamento</Text>
                      {(request as any).paymentMethod && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Text style={{ fontSize: 18 }}>{PAYMENT_METHOD_ICONS[(request as any).paymentMethod as PaymentMethod] ?? "💳"}</Text>
                          <View>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>Método</Text>
                            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                              {PAYMENT_METHOD_LABELS[(request as any).paymentMethod as PaymentMethod] ?? (request as any).paymentMethod}
                            </Text>
                          </View>
                        </View>
                      )}
                      {(request as any).paymentInfo && (
                        <View style={{ marginBottom: 8 }}>
                          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 2 }}>Dados / Chave PIX / Banco</Text>
                          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>{(request as any).paymentInfo}</Text>
                        </View>
                      )}
                      {(request as any).paymentObservations && (
                        <View>
                          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 2 }}>Observações</Text>
                          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>{(request as any).paymentObservations}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Comprovante para visualização */}
                  {(request as any).paymentProofUrl && (
                    <Pressable onPress={() => Linking.openURL((request as any).paymentProofUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      {(request as any).paymentProofUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                        <View style={{ borderRadius: 10, overflow: "hidden", marginBottom: 12, borderWidth: 2, borderColor: colors.success }}>
                          <Image source={{ uri: (request as any).paymentProofUrl }} style={{ width: "100%", height: 160, resizeMode: "cover" }} />
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 12, paddingVertical: 8 }}>
                            <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>🖼️ Comprovante de Pagamento</Text>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                          <Text style={{ fontSize: 20 }}>💳</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Comprovante de Pagamento</Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                          </View>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                        </View>
                      )}
                    </Pressable>
                  )}

                  {/* Nota Fiscal */}
                  {(request as any).invoiceUrl ? (
                    <Pressable onPress={() => Linking.openURL((request as any).invoiceUrl)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                      {(request as any).invoiceUrl?.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i) ? (
                        <View style={{ borderRadius: 10, overflow: "hidden", marginBottom: 12, borderWidth: 2, borderColor: colors.success }}>
                          <Image source={{ uri: (request as any).invoiceUrl }} style={{ width: "100%", height: 160, resizeMode: "cover" }} />
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: `${colors.success}20`, paddingHorizontal: 12, paddingVertical: 8 }}>
                            <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>🖼️ Nota Fiscal Anexada</Text>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ampliar</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.success}15`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                          <Text style={{ fontSize: 20 }}>🧾</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>Nota Fiscal Anexada</Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>Toque para visualizar</Text>
                          </View>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>👁 Ver</Text>
                        </View>
                      )}
                    </Pressable>
                  ) : (
                    <View style={{ marginBottom: 12 }}>
                      <TouchableOpacity
                        onPress={handlePickInvoice}
                        disabled={uploadInvoiceMutation.isPending}
                        style={{ borderWidth: 2, borderStyle: "dashed", borderColor: `${colors.warning}60`, borderRadius: 12, overflow: "hidden", opacity: uploadInvoiceMutation.isPending ? 0.6 : 1 }}
                      >
                        {uploadInvoiceMutation.isPending ? (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 }}>
                            <ActivityIndicator size="small" />
                            <Text style={{ color: colors.warning, fontSize: 14, marginLeft: 8 }}>Enviando...</Text>
                          </View>
                        ) : invoiceLocalUri ? (
                          <View>
                            <Image source={{ uri: invoiceLocalUri }} style={{ width: "100%", height: 140, resizeMode: "cover" }} />
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: `${colors.warning}15` }}>
                              <Text style={{ fontSize: 14 }}>⏳</Text>
                              <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "600" }}>{invoiceFileName} — Enviando...</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 }}>
                            <Text style={{ fontSize: 24 }}>🧾</Text>
                            <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 14 }}>{invoiceFileName ?? "Anexar Nota Fiscal (PDF/Imagem)"}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      {Platform.OS !== "web" && !uploadInvoiceMutation.isPending && (
                        <TouchableOpacity
                          onPress={handleCameraInvoice}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, marginTop: 8, borderRadius: 10, backgroundColor: `${colors.warning}15`, borderWidth: 1, borderColor: `${colors.warning}40` }}
                        >
                          <Text style={{ fontSize: 18 }}>📷</Text>
                          <Text style={{ color: colors.warning, fontWeight: "600", fontSize: 13 }}>Fotografar Nota Fiscal</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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

          {/* Botão Reabrir Solicitação — visível somente para master quando cancelada */}
          {isMasterUser && isCancelled && (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setShowReopenModal(true)}
                disabled={reopenMutation.isPending}
                style={{
                  backgroundColor: `${colors.success}12`,
                  borderWidth: 1.5,
                  borderColor: `${colors.success}40`,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: reopenMutation.isPending ? 0.7 : 1,
                }}
              >
                {reopenMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>🔄</Text>
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 15 }}>Reabrir Solicitação</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Botão Cancelar Solicitação — visível para o solicitante que abriu ou master */}
          {canCancel && (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => setShowCancelModal(true)}
                disabled={cancelMutation.isPending}
                style={{
                  backgroundColor: `${colors.error}12`,
                  borderWidth: 1.5,
                  borderColor: `${colors.error}40`,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: cancelMutation.isPending ? 0.7 : 1,
                }}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>🚫</Text>
                    <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>Cancelar Solicitação</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* ─── Botão de Impressão (status concluída) ─── */}
        {isDone && (
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
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 8,
          }}>
            <TouchableOpacity
              onPress={handlePrint}
              disabled={isPrinting}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: isPrinting ? 0.7 : 1,
              }}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text style={{ fontSize: 18 }}>🖨️</Text>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Imprimir / Salvar PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

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
      {/* Modal de Reabertura */}
      <Modal
        visible={showReopenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReopenModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>🔄 Reabrir Solicitação</Text>
            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 24 }}>
              Tem certeza que deseja reabrir esta solicitação? Ela será retornada ao início do fluxo de aprovação (Fluxo 1 — Aprovação do Gerente).
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowReopenModal(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => reopenMutation.mutate({ requestId: request.id })}
                disabled={reopenMutation.isPending}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.success, alignItems: "center", opacity: reopenMutation.isPending ? 0.7 : 1 }}
              >
                {reopenMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Reabrir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Cancelamento */}
      <CancelModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={(reason) => cancelMutation.mutate({ requestId: request.id, reason })}
        isLoading={cancelMutation.isPending}
      />

      {/* Modal de confirmação cross-platform */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        confirmDestructive={confirmModal.destructive}
        onConfirm={() => {
          hideConfirm();
          confirmModal.onConfirm();
        }}
        onCancel={hideConfirm}
      />
    </ScreenContainer>
  );
}
