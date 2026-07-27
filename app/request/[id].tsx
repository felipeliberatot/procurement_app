import { ScreenContainer } from "@/components/screen-container";
import { PdfViewerModal } from "@/components/pdf-viewer-modal";
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
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
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
  // Detectar se o URI é do tipo web (blob:, content://, ou plataforma web)
  // Isso cobre: PWA no Android (content://), web browser (blob:), e web nativo
  const isWebUri = Platform.OS === "web" || uri.startsWith("blob:") || uri.startsWith("content://");

  if (isWebUri) {
    // Para blob: e content:// URIs, usar fetch + FileReader (funciona em PWA e web)
    try {
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
    } catch (fetchErr) {
      // Se fetch falhar em content:// (alguns Androids bloqueiam), tentar FileSystem
      if (!uri.startsWith("blob:") && Platform.OS !== "web") {
        return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      throw fetchErr;
    }
  } else {
    // No iOS, arquivos de apps externos (WhatsApp, Files, etc.) podem ter URIs
    // que não são diretamente legíveis. Copiar para o cache garante acesso.
    let readableUri = uri;
    if (Platform.OS === "ios" && !uri.startsWith(FileSystem.cacheDirectory ?? "")) {
      try {
        const fileName = uri.split("/").pop() ?? `file_${Date.now()}`;
        const destUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        readableUri = destUri;
      } catch {
        // Se a cópia falhar, tenta ler diretamente
        readableUri = uri;
      }
    }
    return FileSystem.readAsStringAsync(readableUri, { encoding: FileSystem.EncodingType.Base64 });
  }
}

const ROLE_CAN_ACT: Record<RequestStatus, ProcurementRole[]> = {
  // admin não pode aprovar etapas operacionais — apenas o papel específico de cada etapa pode
  rascunho: ["solicitante"],
  aguardando_gerente: ["gerente"],
  aguardando_orcamento: ["orcamento"],
  aguardando_controladoria: ["controladoria"],
  aguardando_diretoria: ["diretoria"],
  aguardando_ordem_compra: ["orcamento"],
  aguardando_aprovacao_ceo: ["ceo"],
  aguardando_aprovacao_compra: ["financeiro"],
  aguardando_comprovante_pagamento: ["financeiro"],
  aguardando_verificacao_compras: ["orcamento"],
  concluida: [],
  parcialmente_concluida: [],
  rejeitada: ["solicitante"],
  cancelada: [],
};

// Etapas que têm apenas ação especial (sem botões simples de aprovar/rejeitar)
const STATUS_APPROVE_ONLY: RequestStatus[] = [
  "aguardando_orcamento",
  "aguardando_ordem_compra",
  "aguardando_aprovacao_ceo",
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

// ─── Componente: Situação dos Itens (Cumprimento Parcial) ───────────────────────
function getItemStatusInfo(status: string, colors: any) {
  switch (status) {
    case "autorizado": return { label: "Autorizado", icon: "✓", bgColor: `${colors.primary}20`, textColor: colors.primary };
    case "aprovado":   return { label: "Aprovado",   icon: "✓", bgColor: `${colors.success}20`, textColor: colors.success };
    case "comprado":   return { label: "Comprado",   icon: "✓", bgColor: `${colors.success}20`, textColor: colors.success };
    case "parcial":    return { label: "Parcial",    icon: "~", bgColor: `${colors.warning}20`, textColor: colors.warning };
    default:           return { label: "Pendente",   icon: "!", bgColor: `${colors.warning}20`, textColor: colors.warning };
  }
}

function ItemFulfillmentCard({ items }: { items: any[] }) {
  const colors = useColors();
  if (!items || items.length === 0) return null;
  const ativos = items.filter(i => i.itemStatus === "comprado" || i.itemStatus === "autorizado" || i.itemStatus === "aprovado");
  const pendentes = items.filter(i => i.itemStatus === "pendente" || i.itemStatus === "parcial");
  return (
    <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>📊 Situação dos Itens</Text>
      {items.map((item: any, idx: number) => {
        const info = getItemStatusInfo(item.itemStatus ?? "pendente", colors);
        return (
          <View key={item.id} style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            paddingVertical: 8,
            borderTopWidth: idx > 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: info.bgColor,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontSize: 11, color: info.textColor, fontWeight: "700" }}>{info.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{item.description ?? item.name}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>{item.quantity} {item.unit}</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: info.bgColor }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: info.textColor }}>{info.label}</Text>
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ fontSize: 11, color: colors.success, fontWeight: "600" }}>✓ {ativos.length} ativo(s)</Text>
        <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "600" }}>⏳ {pendentes.length} pendente(s)</Text>
      </View>
    </View>
  );
}

// ─── Componente: Lembrete de Validação ──────────────────────────────────────
function ValidationReminderModal({
  visible,
  errors,
  onClose,
}: {
  visible: boolean;
  errors: string[];
  onClose: () => void;
}) {
  const colors = useColors();
  if (!visible || errors.length === 0) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.warning}20`, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Ação necessária</Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Preencha os itens abaixo antes de avançar</Text>
            </View>
          </View>
          <View style={{ backgroundColor: `${colors.warning}10`, borderWidth: 1, borderColor: `${colors.warning}30`, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            {errors.map((err, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: i < errors.length - 1 ? 10 : 0 }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: `${colors.warning}30`, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "700" }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: colors.foreground, lineHeight: 20 }}>{err}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ backgroundColor: colors.warning, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Entendido, vou corrigir</Text>
          </TouchableOpacity>
        </View>
      </View>
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

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const showValidationReminder = (errors: string[]) => {
    setValidationErrors(errors);
    setShowValidationModal(true);
  };

  const [orderNumber, setOrderNumber] = useState("");
  const [paymentInfo, setPaymentInfo] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"pix" | "boleto" | "cartao_avista" | "cartao_parcelado" | null>(null);
  const [paymentInstallments, setPaymentInstallments] = useState<string>("");
  const [paymentObservations, setPaymentObservations] = useState("");
  // Pré-carregar observações de pagamento já salvas no banco
  const [paymentObsInitialized, setPaymentObsInitialized] = useState(false);
  const [budgetFileName, setBudgetFileName] = useState<string | null>(null);
  const [pendingBudgetBase64, setPendingBudgetBase64] = useState<string | null>(null);
  const [pendingBudgetMime, setPendingBudgetMime] = useState<string>("application/pdf");
  const [orderValueInput, setOrderValueInput] = useState<string>("");
  const [orderValueInitialized, setOrderValueInitialized] = useState(false);
  const [estimatedValueInput, setEstimatedValueInput] = useState<string>("");
  const [paymentProofFileName, setPaymentProofFileName] = useState<string | null>(null);
  const [paymentProofLocalUri, setPaymentProofLocalUri] = useState<string | null>(null); // URI local para pré-visualização antes do upload
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  const [invoiceLocalUri, setInvoiceLocalUri] = useState<string | null>(null); // URI local para pré-visualização da nota fiscal
  const [ocSiagriFileName, setOcSiagriFileName] = useState<string | null>(null);
  const [showOCViewer, setShowOCViewer] = useState(false);
  // Estado para controle de itens comprados/pendentes na etapa de Emissão de OC
  const [itemFulfillment, setItemFulfillment] = useState<Record<number, "autorizado" | "aprovado" | "comprado" | "pendente">>({})
  const [itemFulfillmentInitialized, setItemFulfillmentInitialized] = useState(false);
  const [showBudgetViewer, setShowBudgetViewer] = useState(false);
  const [showPaymentProofViewer, setShowPaymentProofViewer] = useState(false);
  const [showInvoiceViewer, setShowInvoiceViewer] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showBudgetAnalysis, setShowBudgetAnalysis] = useState(false);
  const [showPaymentRejectModal, setShowPaymentRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Modais de confirmação cross-platform (substitui Alert.alert com callbacks na web)
  // onConfirmRef: armazena o callback em uma ref para evitar closure stale com valores de estado
  const onConfirmRef = useRef<() => void>(() => {});
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }) => {
    // Armazena o callback na ref para garantir que o valor mais recente seja sempre usado
    onConfirmRef.current = opts.onConfirm;
    const { onConfirm: _unused, ...rest } = opts;
    setConfirmModal({ visible: true, ...rest });
  };

  const hideConfirm = () => {
    setConfirmModal(prev => ({ ...prev, visible: false }));
  };

  const requestId = parseInt(id ?? "0");

  const { data: request, isLoading, refetch: refetchRequest } = trpc.requests.getById.useQuery(
    { id: requestId },
    { enabled: isAuthenticated && !!id }
  );

  const { data: history, refetch: refetchHistory } = trpc.requests.history.useQuery(
    { requestId },
    { enabled: isAuthenticated && !!id }
  );

  // Pré-carregar paymentObservations com o valor já salvo no banco
  useEffect(() => {
    if (!paymentObsInitialized && request && (request as any).paymentObservations) {
      setPaymentObservations((request as any).paymentObservations);
      setPaymentObsInitialized(true);
    }
  }, [request, paymentObsInitialized]);

  // Pré-carregar estimatedValueInput com o totalEstimatedValue já salvo no banco
  // Isso evita que o campo apareça vazio quando o usuário sai e volta da tela
  const [estimatedValueInitialized, setEstimatedValueInitialized] = useState(false);
  useEffect(() => {
    if (!estimatedValueInitialized && request && request.totalEstimatedValue && !estimatedValueInput.trim()) {
      const val = Number(request.totalEstimatedValue);
      if (!isNaN(val) && val > 0) {
        setEstimatedValueInput(val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      setEstimatedValueInitialized(true);
    }
  }, [request, estimatedValueInitialized, estimatedValueInput]);

  // Pré-carregar orderValueInput com o orderValue já salvo no banco
  // Isso garante que o campo não apareça vazio quando a solicitação já tem OC emitida anteriormente
  useEffect(() => {
    if (!orderValueInitialized && request) {
      const savedValue = (request as any).orderValue;
      if (savedValue) {
        const val = Number(savedValue);
        if (!isNaN(val) && val > 0) {
          setOrderValueInput(val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } else if (request.totalEstimatedValue) {
        // Pré-preencher com o valor estimado se não houver OC ainda
        const val = Number(request.totalEstimatedValue);
        if (!isNaN(val) && val > 0) {
          setOrderValueInput(val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
      setOrderValueInitialized(true);
    }
  }, [request, orderValueInitialized]);

  // Sincronizar itemFulfillment com dados do banco sempre que a query atualizar
  // Usa uma ref para rastrear o último timestamp de atualização e evitar loops
  const lastItemsHashRef = useRef<string>("");
  useEffect(() => {
    if (request && (request as any).items?.length > 0) {
      // Gerar hash simples dos itemStatus para detectar mudanças reais
      const hash = (request as any).items.map((i: any) => `${i.id}:${i.itemStatus}`).join(",");
      if (hash !== lastItemsHashRef.current) {
        lastItemsHashRef.current = hash;
        const updated: Record<number, "autorizado" | "aprovado" | "comprado" | "pendente"> = {};
        for (const item of (request as any).items) {
          if (item.id) {
            const st = item.itemStatus;
            updated[item.id] = (st === "autorizado" || st === "aprovado" || st === "comprado") ? st : "pendente";
          }
        }
        setItemFulfillment(updated);
        setItemFulfillmentInitialized(true);
      }
    }
  }, [request]);

  const invalidateAll = () => {
    // Invalidar + refetch imediato para atualizar a tela sem precisar sair e entrar
    utils.requests.getById.invalidate({ id: requestId }).then(() => refetchRequest());
    utils.requests.history.invalidate({ requestId }).then(() => refetchHistory());
    utils.requests.all.invalidate();
    utils.requests.myRequests.invalidate();
    utils.requests.dashboardStats.invalidate();
    utils.requests.pendingForMe.invalidate();
  };

  const approveMutation = trpc.approvals.approve.useMutation({
    onSuccess: (result: any) => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowApproveModal(false);
      if (result?.partialApproval) {
        Alert.alert(
          "👥 Aprovação Parcial Registrada",
          result.message ?? "Sua aprovação foi registrada. Aguardando o outro diretor.",
          [{ text: "OK" }]
        );
      }
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
      setEstimatedValueInput("");
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

  const updateItemFulfillmentMutation = trpc.requests.updateItemFulfillment.useMutation({
    onSuccess: () => {
      invalidateAll();
    },
    onError: (e) => {
      Alert.alert("Erro ao atualizar item", e.message);
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

  const refinalizeOCMutation = trpc.requests.refinalizeOC.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao finalizar recompra", e.message);
    },
  });
  const [showReopenModal, setShowReopenModal] = useState(false);

  // ─── Edição do campo Bem em solicitações concluídas (Controladoria) ───
  const [showBemPicker, setShowBemPicker] = useState(false);
  const [bemSearch, setBemSearch] = useState("");
  const { data: assetsForBem } = trpc.assets.list.useQuery(undefined, { enabled: isAuthenticated });
  const filteredBemAssets = (assetsForBem ?? []).filter((a: any) =>
    !bemSearch ||
    a.description.toLowerCase().includes(bemSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(bemSearch.toLowerCase())
  );
  const updateBemMutation = trpc.requests.updateApplicationConcluida.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBemPicker(false);
      setBemSearch("");
      Alert.alert("✅ Bem atualizado", "O campo Bem foi atualizado com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao atualizar Bem", e.message);
    },
  });

  // ─── Edição de metadados em solicitações concluídas (Controladoria) ───
  const [showEditMetadata, setShowEditMetadata] = useState(false);
  const [editCostCenterCode, setEditCostCenterCode] = useState("");
  const [editCostCenterName, setEditCostCenterName] = useState("");
  const [editFarmId, setEditFarmId] = useState<number | null>(null);
  const [editFarmName, setEditFarmName] = useState("");
  const [editHarvestId, setEditHarvestId] = useState<number | null>(null);
  const [editHarvestName, setEditHarvestName] = useState("");
  const { data: costCentersForEdit } = trpc.costCenters.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: unitsForEdit } = trpc.units.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: harvestsForEdit } = trpc.harvests.list.useQuery(undefined, { enabled: isAuthenticated });
  const updateMetadataMutation = trpc.requests.updateMetadataConcluida.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditMetadata(false);
      Alert.alert("✅ Atualizado", "Metadados atualizados com sucesso.");
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao atualizar", e.message);
    },
  });

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

  const deleteMutation = trpc.requests.delete.useMutation({
    onSuccess: () => {
      invalidateAll();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao excluir", e.message);
    },
  });

  // ─── Reenvio de notificação WhatsApp ───
  const setPriorityMutation = trpc.requests.setPriority.useMutation({
    onSuccess: () => {
      utils.requests.getById.invalidate({ id: Number(id) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const resendNotificationMutation = trpc.whatsapp.notifyApproversNow.useMutation({
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Notificação Reenviada",
        data.sent > 0
          ? `Notificação enviada para ${data.sent} pessoa(s) via WhatsApp.`
          : "Nenhum aprovador com telefone cadastrado encontrado.",
      );
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro ao reenviar", e.message);
    },
  });

  // ─── Análise IA do orçamento ───
  const [budgetAnalysisResult, setBudgetAnalysisResult] = useState<any>(null);
  const analyzeBudgetMutation = trpc.ai.analyzeBudget.useMutation({
    onSuccess: (data) => {
      setBudgetAnalysisResult(data);
      setShowBudgetAnalysis(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro na análise", e.message);
    },
  });
  const { data: savedBudgetAnalysis } = trpc.ai.getBudgetAnalysis.useQuery(
    { requestId: Number(id) },
    { enabled: !!id && !!request?.budgetFileUrl }
  );

  // Cotações de fornecedores vinculadas a esta solicitação
  const { data: quotationData, refetch: refetchQuotations } = trpc.quotations.getByRequestId.useQuery(
    { requestId: requestId },
    { enabled: isAuthenticated && !!id }
  );
  const saveQuotationsMutation = trpc.quotations.saveForRequest.useMutation({
    onSuccess: () => {
      refetchQuotations();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ Cotações salvas!", "As cotações foram salvas. O aprovador poderá visualizá-las e escolher a melhor opção.");
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  // Estado do formulário de cotações
  type SupplierItem = { description: string; quantity: string; unit: string; unitPrice: string };
  type SupplierForm = {
    supplierName: string;
    supplierContact: string;
    paymentTerms: string;
    deliveryDays: string;
    observations: string;
    totalValue: string;
    items: SupplierItem[];
    // Arquivo local pendente de upload (antes de salvar cotações)
    pendingFileBase64: string | null;
    pendingFileName: string | null;
    pendingFileMime: string;
    // URL do arquivo já salvo no banco (após salvar)
    savedFileUrl: string | null;
  };
  const emptyItem = (): SupplierItem => ({ description: "", quantity: "1", unit: "un", unitPrice: "" });
  const emptySupplier = (): SupplierForm => ({
    supplierName: "", supplierContact: "", paymentTerms: "", deliveryDays: "", observations: "", totalValue: "",
    items: [emptyItem()],
    pendingFileBase64: null, pendingFileName: null, pendingFileMime: "application/pdf", savedFileUrl: null,
  });
  const [quotationSupplierForms, setQuotationSupplierForms] = useState<SupplierForm[]>([emptySupplier(), emptySupplier(), emptySupplier()]);
  const [quotationFormsInitialized, setQuotationFormsInitialized] = useState(false);
  const uploadSupplierFileMutation = trpc.quotations.uploadSupplierFile.useMutation();

  // Calcular e sincronizar valores totais automaticamente quando itens mudam
  useEffect(() => {
    const updatedForms = quotationSupplierForms.map((form) => {
      const total = form.items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
        const price = parseFloat(item.unitPrice.replace(/\./g, "").replace(",", ".")) || 0;
        return sum + qty * price;
      }, 0);
      const totalFormatted = total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // Só atualizar se o total mudou
      if (form.totalValue !== totalFormatted) {
        return { ...form, totalValue: totalFormatted };
      }
      return form;
    });
    // Verificar se há mudanças antes de atualizar o estado
    const hasChanges = updatedForms.some((form, idx) => form.totalValue !== quotationSupplierForms[idx].totalValue);
    if (hasChanges) {
      setQuotationSupplierForms(updatedForms);
    }
  }, [quotationSupplierForms.map(f => f.items.map(i => `${i.quantity}-${i.unitPrice}`).join("|")).join("##")]);

  // Pré-preencher formulários com cotações existentes
  useEffect(() => {
    if (!quotationFormsInitialized && quotationData?.suppliers?.length) {
      const forms = [emptySupplier(), emptySupplier(), emptySupplier()];
      quotationData.suppliers.forEach((s: any, i: number) => {
        if (i < 3) {
          // Tentar parsear itens salvos no campo observations (JSON)
          let parsedItems: SupplierItem[] = [emptyItem()];
          try {
            const parsed = JSON.parse(s.observations ?? "");
            if (Array.isArray(parsed) && parsed.length > 0) parsedItems = parsed;
          } catch { /* observations é texto simples, manter item vazio */ }
          forms[i] = {
            supplierName: s.supplierName ?? "",
            supplierContact: s.supplierContact ?? "",
            paymentTerms: s.paymentTerms ?? "",
            deliveryDays: s.deliveryDays ? String(s.deliveryDays) : "",
            observations: "",
            totalValue: s.totalValue ?? "",
            items: parsedItems,
            pendingFileBase64: null,
            pendingFileName: null,
            pendingFileMime: "application/pdf",
            savedFileUrl: s.fileUrl ?? null,
          };
        }
      });
      setQuotationSupplierForms(forms);
      setQuotationFormsInitialized(true);
    }
  }, [quotationData, quotationFormsInitialized]);

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
  const canAct = isMasterUser || (allUserRoles.some(r => ROLE_CAN_ACT[currentStatus]?.includes(r as ProcurementRole)) ?? false);
  const isRejected = currentStatus === "rejeitada";
  const isCancelled = currentStatus === "cancelada";
  const isDone = currentStatus === "concluida";
  const isApproveOnly = STATUS_APPROVE_ONLY.includes(currentStatus);
  // A partir do Fluxo 06 (Emissão de OC), o valor estimado passa a se chamar "Valor da OC"
  const isAfterOC = ["aguardando_ordem_compra", "aguardando_aprovacao_ceo", "aguardando_aprovacao_compra", "aguardando_comprovante_pagamento", "aguardando_verificacao_compras", "concluida"].includes(currentStatus);

  // Permissão de cancelar: somente o solicitante que abriu ou master
  // Comparar como Number para evitar mismatch entre string e number
  const isOwner = Number(request.requesterId) === Number((user as any)?.id);
  const canCancel = (isOwner || isMasterUser) && !isCancelled && !isDone;

  // Permissão de definir prioridade: apenas Willian Camilo e Rafael
  const userName = (user as any)?.name ?? "";
  const canSetPriority = ["willian camilo", "rafael"].some((n) => userName.toLowerCase().includes(n));

  // Determina se deve mostrar botões fixos de aprovar/rejeitar
  // Na etapa aguardando_orcamento, o fluxo é controlado pelo bloco de Cotações (botão Salvar Cotações)
  const showFixedButtons = canAct && !isDone && !isCancelled && !isRejected && !isApproveOnly && currentStatus !== "aguardando_orcamento";
  const showFixedApproveOnly = canAct && !isDone && !isCancelled && isApproveOnly;
  const bottomBarHeight = 80 + (insets.bottom > 0 ? insets.bottom : 16);

  const handlePrint = async () => {
    if (!request) return;
    const req = request as any;
    const rid = req.id;
    // Obter token de sessão para autenticar na nova aba (localStorage não é enviado automaticamente)
    const { getApiBaseUrl } = await import("@/constants/oauth");
    const { getSessionToken } = await import("@/lib/_core/auth");
    const base = getApiBaseUrl();
    const token = await getSessionToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const printUrl = `${base}/api/print/${rid}${tokenParam}`;
    if (Platform.OS === "web") {
      // Web: navegar diretamente para a rota de impressão do servidor
      window.open(printUrl, "_blank");
    } else {
      // Mobile: usar Print nativo
      setIsPrinting(true);
      try {
        await Linking.openURL(printUrl);
      } catch (err: any) {
        Alert.alert("Erro ao imprimir", "Não foi possível abrir a página de impressão.");
      } finally {
        setIsPrinting(false);
      }
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
    // Fechar teclado para garantir que o modal apareça corretamente
    Keyboard.dismiss();
    // Usar o valor digitado pelo usuário no campo orderValueInput
    const raw = orderValueInput.trim().replace(/\./g, "").replace(",", ".");
    const ocValue = parseFloat(raw);
    if (!orderValueInput.trim() || isNaN(ocValue) || ocValue <= 0) {
      Alert.alert("Campo obrigatório", "Informe o Valor da OC antes de emitir.");
      return;
    }
    const valorExibido = ocValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    showConfirm({
      title: "Confirmar Emissão de OC",
      message: `Confirmar a emissão da OC (${valorExibido}) e encaminhar para Aprovação Financeiro?`,
      confirmText: "Confirmar",
      onConfirm: () => approveMutation.mutate({ requestId: request.id, purchaseOrderNumber: "", orderValue: ocValue }),
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
    // No Android, oferecer escolha entre galeria de imagens e PDF
    if (Platform.OS === "android") {
      Alert.alert(
        "Selecionar Comprovante",
        "Como deseja anexar o comprovante?",
        [
          {
            text: "Galeria de Fotos",
            onPress: async () => {
              try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== "granted") {
                  Alert.alert("Permissão Negada", "Permita o acesso à galeria nas configurações do app.");
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: false,
                  quality: 0.85,
                  base64: true,
                });
                if (result.canceled) return;
                const asset = result.assets[0];
                const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
                const fileName = `comprovante_${Date.now()}.${ext}`;
                setPaymentProofFileName(fileName);
                setPaymentProofLocalUri(asset.uri);
                const base64 = asset.base64 ?? await readFileAsBase64(asset.uri);
                uploadPaymentProofMutation.mutate({ requestId: request.id, fileName, base64, mimeType: asset.mimeType ?? "image/jpeg" });
              } catch (err: any) {
                Alert.alert("Erro", `Não foi possível acessar a galeria: ${err?.message ?? err}`);
              }
            },
          },
          {
            text: "Arquivo PDF",
            onPress: async () => {
              try {
                const result = await DocumentPicker.getDocumentAsync({
                  type: "application/pdf",
                  copyToCacheDirectory: true,
                });
                if (result.canceled) return;
                const file = result.assets[0];
                setPaymentProofFileName(file.name);
                setPaymentProofLocalUri(null);
                const base64 = await readFileAsBase64(file.uri);
                uploadPaymentProofMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: "application/pdf" });
              } catch (err: any) {
                Alert.alert("Erro", `Não foi possível selecionar o PDF: ${err?.message ?? err}`);
              }
            },
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
      return;
    }
    // iOS e Web: seletor unificado
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setPaymentProofFileName(file.name);
      const isImage = file.mimeType?.startsWith("image/") ?? false;
      setPaymentProofLocalUri(isImage ? file.uri : null);
      const base64 = await readFileAsBase64(file.uri);
      uploadPaymentProofMutation.mutate({ requestId: request.id, fileName: file.name, base64, mimeType: file.mimeType ?? "application/pdf" });
    } catch (err: any) {
      Alert.alert("Erro", `Não foi possível selecionar o arquivo: ${err?.message ?? err}`);
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
    // Parsing robusto: suporta tanto formato BR (4.556,25) quanto EN (4556.25)
    // Se contém vírgula: trata como separador decimal BR → remove pontos de milhar, troca vírgula por ponto
    // Se contém apenas ponto: trata como decimal EN → usa direto
    const parsedOCValue = (() => {
      if (!orderValueInput) return NaN;
      const raw = orderValueInput.trim();
      if (raw.includes(",")) {
        // Formato BR: 4.556,25 → remove pontos → 4556,25 → troca vírgula → 4556.25
        return parseFloat(raw.replace(/\./g, "").replace(",", "."));
      } else {
        // Formato EN ou sem separador: 4556.25 ou 4556 → usa direto
        return parseFloat(raw);
      }
    })();

    // Validar campos obrigatórios antes de finalizar
    const finalErrors: string[] = [];
    const req = request as any;
    if (!orderValueInput.trim() || isNaN(parsedOCValue) || parsedOCValue <= 0) {
      finalErrors.push("Informe o valor da Ordem de Compra (campo obrigatório).");
    }
    if (!req.paymentProofUrl && !paymentProofLocalUri) {
      finalErrors.push("Comprovante de pagamento não anexado. Faça o upload do comprovante antes de finalizar.");
    }
    if (!req.invoiceUrl && !invoiceLocalUri) {
      finalErrors.push("Nota fiscal não anexada. Faça o upload da NF antes de finalizar.");
    }
    if (finalErrors.length > 0) {
      showValidationReminder(finalErrors);
      return;
    }
    showConfirm({
      title: "📦 Finalizar Ordem de Compra",
      message: `Confirma a finalização da OC com valor R$ ${parsedOCValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}? Ela será habilitada nos Malotes.`,
      confirmText: "Finalizar OC",
      onConfirm: () => finalizeOCMutation.mutate({ requestId: request.id, orderValue: parsedOCValue }),
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
          keyboardShouldPersistTaps="always"
        >
          {/* Status badges */}
          <View className="flex-row items-center gap-2 mb-4 flex-wrap">
            <StatusBadge status={currentStatus} />
            <UrgencyBadge level={request.urgencyLevel as any} />
            {request.deadlineAt && <DeadlineTimer deadline={request.deadlineAt} />}
            {(request as any).isPriority && (
              <View style={{ backgroundColor: "#EF444420", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 12 }}>🔴</Text>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#EF4444" }}>PRIORITÁRIA</Text>
                {(request as any).priorityOrder && (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>#{(request as any).priorityOrder}</Text>
                )}
              </View>
            )}
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

          {/* Card de Aprovação Dupla da Diretoria — removido: aprovação simples agora */}

          {/* Informações principais */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, flex: 1, marginRight: 8 }}>{request.application}</Text>
              {(isDone || currentStatus === "parcialmente_concluida") && (allUserRoles.some(r => ["controladoria"].includes(r)) || isMasterUser) && (
                <Pressable
                  onPress={() => { setShowBemPicker(true); setBemSearch(""); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: `${colors.primary}15`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}40`,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <Text style={{ fontSize: 12 }}>✏️</Text>
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Trocar Bem</Text>
                </Pressable>
              )}
            </View>
            <View className="gap-1.5">
              <Text className="text-sm text-muted">Solicitante: <Text className="text-foreground font-medium">{request.requesterName}</Text></Text>
              <Text className="text-sm text-muted">Departamento: <Text className="text-foreground font-medium">{request.department}</Text></Text>
              {request.costCenterCode && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text className="text-sm text-muted" style={{ flex: 1 }}>Centro de Custo: <Text className="text-foreground font-medium">{request.costCenterCode}</Text></Text>
                  {(isDone || currentStatus === "parcialmente_concluida") && (allUserRoles.some(r => ["controladoria"].includes(r)) || isMasterUser) && (
                    <Pressable
                      onPress={() => {
                        setEditCostCenterCode(request.costCenterCode ?? "");
                        setEditCostCenterName("");
                        setEditFarmId((request as any).farmId ?? null);
                        setEditFarmName((request as any).farmName ?? "");
                        setEditHarvestId((request as any).harvestId ?? null);
                        setEditHarvestName((request as any).harvestName ?? "");
                        setShowEditMetadata(true);
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600" }}>✏️ Editar</Text>
                    </Pressable>
                  )}
                </View>
              )}
              <Text className="text-sm text-muted">Criado em: <Text className="text-foreground font-medium">{formatDate(request.createdAt)}</Text></Text>
              {request.totalEstimatedValue ? (
                <Text className="text-sm text-muted">{isAfterOC ? "Valor da OC" : "Valor Estimado"}: <Text style={{ color: isAfterOC ? colors.success : colors.warning, fontWeight: "700" }}>{formatCurrency(request.totalEstimatedValue)}</Text></Text>
              ) : null}
              {request.purchaseOrderNumber && (
                <Text className="text-sm text-muted">Ordem de Compra: <Text className="text-foreground font-bold">{request.purchaseOrderNumber}</Text></Text>
              )}
              {request.osMyfarm && (
                <Text className="text-sm text-muted">OS Manutenção: <Text className="text-foreground font-bold">{request.osMyfarm}</Text></Text>
              )}
              {(request as any).farmName && (
                <Text className="text-sm text-muted">Fazenda: <Text className="text-foreground font-bold">{(request as any).farmName}</Text></Text>
              )}
              {(request as any).harvestName && (
                <Text className="text-sm text-muted">Safra: <Text className="text-foreground font-bold">{(request as any).harvestName}</Text></Text>
              )}
              {(request as any).maintenanceType && (
                <Text className="text-sm text-muted">Tipo de Manutenção: <Text className="text-foreground font-bold">{(request as any).maintenanceType === "preventiva" ? "🛡️ Preventiva" : "🔧 Corretiva"}</Text></Text>
              )}
              {(request as any).fuelType && (
                <Text className="text-sm text-muted">Tipo: <Text className="text-foreground font-bold">{
                  (request as any).fuelType === "diesel" ? "⛽ Diesel" :
                  (request as any).fuelType === "diesel_s10" ? "⛽ Diesel S-10" :
                  (request as any).fuelType === "alcool_gasolina_fazenda" ? "🌾 Álcool/Gasolina – Fazenda" :
                  (request as any).fuelType === "alcool_gasolina_administrativo" ? "🏢 Álcool/Gasolina – Administrativo" :
                  "🛢️ Lubrificantes"
                }</Text></Text>
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {item.totalPrice && (
                      <Text className="text-sm font-semibold text-foreground">{formatCurrency(item.totalPrice)}</Text>
                    )}
                    {/* Badge de status do item: só aparece após Emissão de OC */}
                    {item.itemStatus && (() => {
                      const st = item.itemStatus;
                      const isActive = st === "comprado" || st === "aprovado" || st === "autorizado";
                      const label = st === "comprado" ? "Comprado" : st === "aprovado" ? "Aprovado" : st === "autorizado" ? "Autorizado" : st === "parcial" ? "Parcial" : "Pendente";
                      const color = isActive ? "#22C55E" : "#F59E0B";
                      return (
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 20,
                          backgroundColor: color + "20",
                          borderWidth: 1,
                          borderColor: color,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color }}>
                            {label}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* PDF de orçamento */}
          {request.budgetFileUrl && (() => {
            // Status em que o orçamento pode ser editado:
            // - Fluxo Normal:              Gerente → Orçamento → Controladoria → Diretoria → ...
            // - Fluxo Urgente/Emergencial: Gerente → Orçamento → Diretoria → Controladoria → ...
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
                    onPress={() => setShowBudgetViewer(true)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                  >
                    <Text className="text-primary text-xs font-semibold">👁 Ver</Text>
                  </TouchableOpacity>
                  {/* Botão de análise IA: visível sempre que há orçamento */}
                  <TouchableOpacity
                    onPress={() => {
                      if (budgetAnalysisResult || savedBudgetAnalysis) {
                        setShowBudgetAnalysis(true);
                      } else {
                        analyzeBudgetMutation.mutate({
                          requestId: Number(id),
                          budgetFileUrl: request.budgetFileUrl!,
                          requestDescription: request.application ?? "",
                          requestItems: (request as any).items?.map((item: any) => ({
                            name: item.description,
                            quantity: Number(item.quantity ?? 1),
                            unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
                          })) ?? [],
                        });
                      }
                    }}
                    disabled={analyzeBudgetMutation.isPending}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: analyzeBudgetMutation.isPending ? undefined : `${colors.primary}15`,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: `${colors.primary}40`,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {analyzeBudgetMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={{ fontSize: 12 }}>✨</Text>
                    )}
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                      {analyzeBudgetMutation.isPending ? "Analisando..." : (budgetAnalysisResult || savedBudgetAnalysis) ? "Ver Parecer" : "IA"}
                    </Text>
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

          {/* Botão "Enviar Orçamento" — visível apenas na etapa aguardando_orcamento quando há PDF anexado */}
          {currentStatus === "aguardando_orcamento" && request.budgetFileUrl && (allUserRoles.some(r => ["orcamento", "admin"].includes(r)) || isMasterUser) && (
            <TouchableOpacity
              onPress={() => {
                showConfirm({
                  title: "📤 Enviar Orçamento",
                  message: "Confirma o envio do orçamento? A solicitação avançará para a próxima etapa de aprovação.",
                  confirmText: "Enviar",
                  onConfirm: () => {
                    submitBudgetMutation.mutate(
                      { requestId: request.id },
                      {
                        onSuccess: () => {
                          Alert.alert("✅ Orçamento enviado!", "A solicitação foi encaminhada para aprovação.");
                        },
                        onError: (err: any) => {
                          Alert.alert("❌ Erro", err?.message || "Falha ao enviar orçamento.");
                        },
                      }
                    );
                  },
                });
              }}
              disabled={submitBudgetMutation.isPending}
              style={{
                backgroundColor: colors.success,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                marginBottom: 16,
                opacity: submitBudgetMutation.isPending ? 0.7 : 1,
              }}
            >
              {submitBudgetMutation.isPending ? (
                <><ActivityIndicator color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 15, marginLeft: 8 }}>Enviando...</Text></>
              ) : (
                <><Text style={{ fontSize: 18 }}>📤</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Enviar Orçamento</Text></>
              )}
            </TouchableOpacity>
          )}

          {/* Resumo de Cotações — visível para todos quando há cotações registradas (inclusive Diretoria/Controladoria) */}
          {(quotationData?.suppliers?.length ?? 0) > 0 && currentStatus !== "aguardando_orcamento" && (
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>📋 Cotações de Fornecedores</Text>
              {((quotationData?.suppliers ?? []) as any[]).map((s: any, i: number) => {
                const isSelected = (quotationData?.selectedSupplierId ?? null) === s.id;
                return (
                  <View key={i} style={{
                    backgroundColor: isSelected ? `${colors.success}12` : colors.background,
                    borderWidth: 1.5,
                    borderColor: isSelected ? `${colors.success}50` : colors.border,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: i < (quotationData?.suppliers?.length ?? 0) - 1 ? 8 : 0,
                  }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? colors.success : colors.foreground, flex: 1 }}>
                        {isSelected ? "⭐ " : ""}{s.supplierName || `Fornecedor ${i + 1}`}
                      </Text>
                      {isSelected && (
                        <View style={{ backgroundColor: `${colors.success}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: colors.success, fontSize: 11, fontWeight: "700" }}>SELECIONADO</Text>
                        </View>
                      )}
                    </View>
                    {s.deliveryDays ? (
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>⏱ Prazo: {s.deliveryDays} dias</Text>
                    ) : null}
                    {/* Itens da cotação */}
                    {s.observations ? (() => {
                      try {
                        const parsedItems = JSON.parse(s.observations);
                        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                          return (
                            <View style={{ marginTop: 4, marginBottom: 4 }}>
                              {parsedItems.map((it: any, itIdx: number) => (
                                <View key={itIdx} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: itIdx > 0 ? 0.5 : 0, borderTopColor: colors.border }}>
                                  <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }}>{it.description || `Item ${itIdx + 1}`} · {it.quantity} {it.unit}</Text>
                                  <Text style={{ fontSize: 11, color: colors.foreground, fontWeight: "600", marginLeft: 8 }}>
                                    {it.unitPrice ? `R$ ${parseFloat(String(it.unitPrice).replace(/\./g, "").replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          );
                        }
                      } catch {}
                      return null;
                    })() : null}
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? colors.success : colors.foreground }}>
                        Total: R$ {parseFloat(s.totalValue || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* OC — visível para todos nos fluxos 07, 08, 09 e concluída (após emissão pelo Compras) */}
          {(currentStatus === "aguardando_aprovacao_compra" || currentStatus === "aguardando_comprovante_pagamento" || currentStatus === "aguardando_verificacao_compras" || currentStatus === "concluida") && (request.purchaseOrderNumber || (request as any).ocSiagriUrl) && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: `${colors.primary}12`, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: `${colors.primary}30` }}>
                <Text style={{ fontSize: 24 }}>🛒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Ordem de Compra</Text>
                  {request.purchaseOrderNumber ? (
                    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginTop: 2 }}>N° {request.purchaseOrderNumber}</Text>
                  ) : null}
                  {(request as any).ocSiagriUrl ? (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>PDF Siagri disponível</Text>
                  ) : null}
                </View>
                {(request as any).ocSiagriUrl && (
                  <Pressable
                    onPress={() => setShowOCViewer(true)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 })}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>👁 Ver OC</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Comprovante de pagamento — visível para todos nas etapas 8 e 9 e quando concluída */}
          {(currentStatus === "aguardando_comprovante_pagamento" || currentStatus === "aguardando_verificacao_compras" || currentStatus === "concluida") && (request as any).paymentProofUrl && (
            <Pressable
              onPress={() => setShowPaymentProofViewer(true)}
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
              onPress={() => setShowInvoiceViewer(true)}
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

          {/* Situação dos itens (visível para todos quando concluída ou parcialmente concluída) */}
          {/* Itens: leitura para concluida, interativo para parcialmente_concluida */}
          {currentStatus === "concluida" && (request as any).items && (request as any).items.length > 0 && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <ItemFulfillmentCard items={(request as any).items} />
            </View>
          )}
          {currentStatus === "parcialmente_concluida" && (request as any).items && (request as any).items.length > 0 && (
            <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>📦 Itens da Solicitação</Text>
              {allUserRoles.some(r => ["orcamento", "compras"].includes(r)) || isMasterUser ? (
                <>
                  <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Marque os itens que foram comprados agora e finalize para atualizar o status.</Text>
                  {(request as any).items.map((item: any) => {
                    const status = itemFulfillment[item.id] ?? "pendente";
                    const isComprado = status === "comprado";
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          const newStatus = isComprado ? "pendente" : "comprado";
                          setItemFulfillment(prev => ({ ...prev, [item.id]: newStatus }));
                          updateItemFulfillmentMutation.mutate({ itemId: item.id, fulfilledQty: newStatus === "comprado" ? Number(item.quantity ?? 1) : 0 });
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center",
                          paddingVertical: 12, paddingHorizontal: 14,
                          borderRadius: 12, borderWidth: 2,
                          borderColor: isComprado ? colors.success : colors.border,
                          backgroundColor: isComprado ? `${colors.success}12` : colors.background,
                          marginBottom: 8, gap: 12,
                        }}
                      >
                        <View style={{
                          width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                          borderColor: isComprado ? colors.success : colors.muted,
                          backgroundColor: isComprado ? colors.success : "transparent",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {isComprado && <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{item.description ?? item.name}</Text>
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{item.quantity} {item.unit}</Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                          backgroundColor: isComprado ? colors.success : `${colors.warning}20`,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: isComprado ? "white" : colors.warning }}>
                            {isComprado ? "Comprado" : "Pendente"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4, paddingHorizontal: 4, marginBottom: 12 }}>
                    <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>
                      ✓ {Object.values(itemFulfillment).filter(s => s === "comprado" || s === "aprovado" || s === "autorizado").length} comprado(s)
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.warning, fontWeight: "600" }}>
                      ⏳ {(request as any).items.length - Object.values(itemFulfillment).filter(s => s === "comprado" || s === "aprovado" || s === "autorizado").length} pendente(s)
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Finalizar Recompra",
                        "Confirma a finalização? O status será atualizado com base nos itens marcados.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Confirmar", onPress: () => refinalizeOCMutation.mutate({ requestId: request.id }) },
                        ]
                      );
                    }}
                    disabled={refinalizeOCMutation.isPending}
                    style={{
                      backgroundColor: colors.success,
                      borderRadius: 14, paddingVertical: 14,
                      alignItems: "center", flexDirection: "row",
                      justifyContent: "center", gap: 8,
                      opacity: refinalizeOCMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    {refinalizeOCMutation.isPending
                      ? <ActivityIndicator color="white" />
                      : <>
                          <Text style={{ fontSize: 16 }}>✅</Text>
                          <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Finalizar Recompra</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <ItemFulfillmentCard items={(request as any).items} />
              )}
            </View>
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

              {/* Etapa de orçamento: formulário de 3 cotações de fornecedores */}
              {currentStatus === "aguardando_orcamento" && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>📋 Cotações de Fornecedores</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 16 }}>Preencha até 3 cotações. Após salvar, o aprovador escolherá a melhor opção para avançar o fluxo.</Text>

                  {/* Cotações já salvas */}
                  {quotationData?.suppliers?.length ? (
                    <View style={{ marginBottom: 16, backgroundColor: `${colors.success}10`, borderWidth: 1, borderColor: `${colors.success}30`, borderRadius: 12, padding: 12 }}>
                      <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13, marginBottom: 8 }}>✅ Cotações já salvas ({quotationData.suppliers.length}/3)</Text>
                      {(quotationData.suppliers as any[]).map((s: any, i: number) => (
                        <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: i < quotationData.suppliers.length - 1 ? 0.5 : 0, borderBottomColor: colors.border }}>
                          <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>{i + 1}. {s.supplierName}</Text>
                          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{parseFloat(s.totalValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>
                          {quotationData.selectedSupplierId === s.id && <Text style={{ color: colors.success, fontSize: 12, marginLeft: 8 }}>⭐ Selecionado</Text>}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Formulário de cotações - cotação 1 obrigatória, 2 e 3 opcionais */}
                  {quotationSupplierForms.map((form, idx) => (
                    <View key={idx} style={{ marginBottom: 16, borderWidth: 1, borderColor: idx === 0 ? colors.border : `${colors.border}80`, borderRadius: 12, padding: 12, backgroundColor: colors.background }}>
                      {/* Cabeçalho do cartão */}
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: idx === 0 ? colors.primary : colors.muted, flex: 1 }}>Fornecedor {idx + 1} {idx === 0 ? "*" : "(opcional)"}</Text>
                        <Text style={{ fontSize: 10, color: idx === 0 ? colors.muted : `${colors.muted}80` }}>{idx === 0 ? "Obrigatório" : "Opcional"}</Text>
                      </View>

                      {/* Itens da cotação - múltiplos itens */}
                      <View style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                          <Text style={{ fontSize: 11, color: colors.muted, flex: 1 }}>Itens{idx === 0 ? " *" : ""}</Text>
                          <Text style={{ fontSize: 10, color: colors.muted }}>{form.items.length} item(ns)</Text>
                        </View>
                        {/* Cabeçalho das colunas */}
                        <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
                          <Text style={{ flex: 3, fontSize: 10, color: colors.muted }}>Descrição</Text>
                          <Text style={{ width: 40, fontSize: 10, color: colors.muted, textAlign: "center" }}>Qtd</Text>
                          <Text style={{ width: 36, fontSize: 10, color: colors.muted, textAlign: "center" }}>Un</Text>
                          <Text style={{ width: 72, fontSize: 10, color: colors.muted, textAlign: "right" }}>Vl. Unit.</Text>
                          <View style={{ width: 24 }} />
                        </View>
                        {form.items.map((item, itemIdx) => (
                          <View key={itemIdx} style={{ flexDirection: "row", gap: 4, marginBottom: 6, alignItems: "center" }}>
                            <TextInput
                              value={item.description}
                              onChangeText={(v) => {
                                const f = [...quotationSupplierForms];
                                const items = [...f[idx].items];
                                items[itemIdx] = { ...items[itemIdx], description: v };
                                f[idx] = { ...f[idx], items };
                                setQuotationSupplierForms(f);
                              }}
                              placeholder="Item..."
                              placeholderTextColor={colors.muted}
                              style={{ flex: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, color: colors.foreground }}
                            />
                            <TextInput
                              value={item.quantity}
                              onChangeText={(v) => {
                                const f = [...quotationSupplierForms];
                                const items = [...f[idx].items];
                                items[itemIdx] = { ...items[itemIdx], quantity: v.replace(/[^0-9.,]/g, "") };
                                f[idx] = { ...f[idx], items };
                                setQuotationSupplierForms(f);
                              }}
                              placeholder="1"
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              style={{ width: 40, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 12, color: colors.foreground, textAlign: "center" }}
                            />
                            <TextInput
                              value={item.unit}
                              onChangeText={(v) => {
                                const f = [...quotationSupplierForms];
                                const items = [...f[idx].items];
                                items[itemIdx] = { ...items[itemIdx], unit: v };
                                f[idx] = { ...f[idx], items };
                                setQuotationSupplierForms(f);
                              }}
                              placeholder="un"
                              placeholderTextColor={colors.muted}
                              style={{ width: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6, fontSize: 12, color: colors.foreground, textAlign: "center" }}
                            />
                            <TextInput
                              value={item.unitPrice}
                              onChangeText={(v) => {
                                const f = [...quotationSupplierForms];
                                const items = [...f[idx].items];
                                items[itemIdx] = { ...items[itemIdx], unitPrice: v.replace(/[^0-9.,]/g, "") };
                                f[idx] = { ...f[idx], items };
                                setQuotationSupplierForms(f);
                              }}
                              placeholder="0,00"
                              placeholderTextColor={colors.muted}
                              keyboardType="decimal-pad"
                              style={{ width: 72, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 6, fontSize: 12, color: colors.foreground, textAlign: "right" }}
                            />
                            {/* Botão remover item */}
                            <TouchableOpacity
                              onPress={() => {
                                if (form.items.length <= 1) return;
                                const f = [...quotationSupplierForms];
                                const items = f[idx].items.filter((_, i) => i !== itemIdx);
                                f[idx] = { ...f[idx], items };
                                setQuotationSupplierForms(f);
                              }}
                              style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center", opacity: form.items.length <= 1 ? 0.3 : 1 }}
                            >
                              <Text style={{ fontSize: 16, color: colors.error, lineHeight: 20 }}>−</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        {/* Botão adicionar item */}
                        <TouchableOpacity
                          onPress={() => {
                            const f = [...quotationSupplierForms];
                            f[idx] = { ...f[idx], items: [...f[idx].items, emptyItem()] };
                            setQuotationSupplierForms(f);
                          }}
                          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderStyle: "dashed", borderColor: `${colors.primary}60`, borderRadius: 6, alignSelf: "flex-start", marginTop: 2 }}
                        >
                          <Text style={{ fontSize: 16, color: colors.primary, lineHeight: 20 }}>+</Text>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Adicionar item</Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Nome do Fornecedor{idx === 0 ? " *" : ""}</Text>
                      <TextInput
                        value={form.supplierName}
                        onChangeText={(v) => { const f = [...quotationSupplierForms]; f[idx] = { ...f[idx], supplierName: v }; setQuotationSupplierForms(f); }}
                        placeholder="Ex: Empresa ABC Ltda"
                        placeholderTextColor={colors.muted}
                        returnKeyType="next"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground, marginBottom: 8 }}
                      />
                      {/* Valor Total calculado automaticamente a partir dos itens */}
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Valor Total (R$)</Text>
                        <View style={{ backgroundColor: `${colors.primary}10`, borderWidth: 1.5, borderColor: `${colors.primary}40`, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 13, color: colors.muted }}>Calculado automaticamente</Text>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: form.totalValue && parseFloat(form.totalValue.replace(/\./g, "").replace(",", ".")) > 0 ? colors.primary : colors.muted }}>R$ {form.totalValue || "0,00"}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Prazo de Entrega (dias)</Text>
                      <TextInput
                        value={form.deliveryDays}
                        onChangeText={(v) => { const f = [...quotationSupplierForms]; f[idx] = { ...f[idx], deliveryDays: v.replace(/[^0-9]/g, "") }; setQuotationSupplierForms(f); }}
                        placeholder="Ex: 7"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        returnKeyType="next"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground, marginBottom: 8 }}
                      />
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Condições de Pagamento</Text>
                      <TextInput
                        value={form.paymentTerms}
                        onChangeText={(v) => { const f = [...quotationSupplierForms]; f[idx] = { ...f[idx], paymentTerms: v }; setQuotationSupplierForms(f); }}
                        placeholder="Ex: 30/60/90 dias"
                        placeholderTextColor={colors.muted}
                        returnKeyType="next"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground, marginBottom: 8 }}
                      />
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Observações</Text>
                      <TextInput
                        value={form.supplierContact}
                        onChangeText={(v) => { const f = [...quotationSupplierForms]; f[idx] = { ...f[idx], supplierContact: v }; setQuotationSupplierForms(f); }}
                        placeholder="Informações adicionais, contato do fornecedor..."
                        placeholderTextColor={colors.muted}
                        multiline
                        numberOfLines={2}
                        returnKeyType="done"
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.foreground, minHeight: 60, textAlignVertical: "top", marginBottom: 10 }}
                      />

                      {/* Botão de upload de arquivo (PDF ou imagem) */}
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            // Mostrar opções: PDF ou Imagem
                            if (Platform.OS === "web") {
                              // Na web, usar DocumentPicker que aceita ambos
                              const result = await DocumentPicker.getDocumentAsync({
                                type: ["application/pdf", "image/*"],
                                copyToCacheDirectory: true,
                              });
                              if (result.canceled) return;
                              const file = result.assets[0];
                              const base64 = await readFileAsBase64(file.uri);
                              const f = [...quotationSupplierForms];
                              f[idx] = { ...f[idx], pendingFileBase64: base64, pendingFileName: file.name, pendingFileMime: file.mimeType ?? "application/pdf" };
                              setQuotationSupplierForms(f);
                            } else {
                              // No mobile, oferecer escolha entre câmera/galeria e documentos
                              Alert.alert(
                                "Anexar Arquivo",
                                "Escolha o tipo de arquivo:",
                                [
                                  {
                                    text: "📷 Foto / Imagem",
                                    onPress: async () => {
                                      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                                      if (status !== "granted") { Alert.alert("Permissão necessária", "Permita o acesso à galeria."); return; }
                                      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true });
                                      if (res.canceled || !res.assets[0]) return;
                                      const asset = res.assets[0];
                                      const b64 = asset.base64 ?? await readFileAsBase64(asset.uri);
                                      const fname = `cotacao_${idx + 1}_${Date.now()}.jpg`;
                                      const f = [...quotationSupplierForms];
                                      f[idx] = { ...f[idx], pendingFileBase64: b64, pendingFileName: fname, pendingFileMime: asset.mimeType ?? "image/jpeg" };
                                      setQuotationSupplierForms(f);
                                    },
                                  },
                                  {
                                    text: "📄 PDF",
                                    onPress: async () => {
                                      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
                                      if (result.canceled) return;
                                      const file = result.assets[0];
                                      const base64 = await readFileAsBase64(file.uri);
                                      const f = [...quotationSupplierForms];
                                      f[idx] = { ...f[idx], pendingFileBase64: base64, pendingFileName: file.name, pendingFileMime: "application/pdf" };
                                      setQuotationSupplierForms(f);
                                    },
                                  },
                                  { text: "Cancelar", style: "cancel" },
                                ]
                              );
                            }
                          } catch (err) {
                            Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
                          }
                        }}
                        style={{
                          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                          borderWidth: 1.5, borderStyle: "dashed",
                          borderColor: form.pendingFileName || form.savedFileUrl ? colors.success : `${colors.primary}80`,
                          borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12,
                          backgroundColor: form.pendingFileName || form.savedFileUrl ? `${colors.success}10` : `${colors.primary}08`,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>{form.pendingFileName || form.savedFileUrl ? "✅" : "📎"}</Text>
                        <Text style={{ fontSize: 13, color: form.pendingFileName || form.savedFileUrl ? colors.success : colors.primary, fontWeight: "600", flex: 1 }} numberOfLines={1}>
                          {form.pendingFileName
                            ? form.pendingFileName
                            : form.savedFileUrl
                            ? "Arquivo anexado"
                            : "Anexar PDF ou Imagem"}
                        </Text>
                        {(form.pendingFileName || form.savedFileUrl) && (
                          <TouchableOpacity
                            onPress={() => {
                              const f = [...quotationSupplierForms];
                              f[idx] = { ...f[idx], pendingFileBase64: null, pendingFileName: null, savedFileUrl: null };
                              setQuotationSupplierForms(f);
                            }}
                          >
                            <Text style={{ fontSize: 12, color: colors.error, marginLeft: 4 }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Botão Salvar Cotações */}
                  <TouchableOpacity
                    onPress={async () => {
                      // Validar que o fornecedor 1 está preenchido (2 e 3 são opcionais)
                      const f1 = quotationSupplierForms[0];
                      const f1Total = f1.items.reduce((sum, item) => {
                        const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
                        const price = parseFloat(item.unitPrice.replace(/\./g, "").replace(",", ".")) || 0;
                        return sum + qty * price;
                      }, 0);
                      if (!f1.supplierName.trim()) {
                        Alert.alert("Obrigatório", "Preencha o nome do Fornecedor 1.");
                        return;
                      }
                      if (f1Total <= 0 && !f1.totalValue.trim()) {
                        Alert.alert("Obrigatório", "Adicione pelo menos um item com valor unitário no Fornecedor 1.");
                        return;
                      }
                      // Filtrar apenas fornecedores com nome preenchido
                      const suppliersFiltered = quotationSupplierForms.filter(f => f.supplierName.trim());
                      const suppliers = suppliersFiltered.map((f, i) => {
                        // Calcular total a partir dos itens
                        const computedTotal = f.items.reduce((sum, item) => {
                          const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
                          const price = parseFloat(item.unitPrice.replace(/\./g, "").replace(",", ".")) || 0;
                          return sum + qty * price;
                        }, 0);
                        // Usar totalValue do estado se já calculado, senão calcular agora
                        const totalStr = computedTotal > 0
                          ? computedTotal.toFixed(2)
                          : (f.totalValue.replace(/\./g, "").replace(",", ".") || "0");
                        return {
                          supplierName: f.supplierName.trim(),
                          supplierContact: f.supplierContact.trim() || undefined,
                          paymentTerms: f.paymentTerms.trim() || undefined,
                          deliveryDays: f.deliveryDays ? parseInt(f.deliveryDays) : undefined,
                          // Serializar itens como JSON no campo observations para persistência
                          observations: JSON.stringify(f.items.filter(item => item.description.trim())),
                          items: f.items.filter(item => item.description.trim()).map(item => ({
                            description: item.description.trim(),
                            quantity: item.quantity || "1",
                            unit: item.unit || "un",
                            unitPrice: item.unitPrice,
                            totalPrice: (() => {
                              const q = parseFloat(item.quantity.replace(",", ".")) || 0;
                              const p = parseFloat(item.unitPrice.replace(/\./g, "").replace(",", ".")) || 0;
                              return (q * p).toFixed(2);
                            })(),
                          })),
                          totalValue: totalStr,
                          position: i + 1,
                        };
                      });
                      saveQuotationsMutation.mutate(
                        { requestId: request.id, suppliers },
                        {
                          onSuccess: async (result: any) => {
                            // Após salvar, fazer upload dos arquivos pendentes
                            const savedSuppliers = result?.suppliers ?? [];
                            const uploadPromises = suppliersFiltered.map(async (f, i) => {
                              if (f.pendingFileBase64 && f.pendingFileName && savedSuppliers[i]?.id) {
                                try {
                                  await uploadSupplierFileMutation.mutateAsync({
                                    supplierId: savedSuppliers[i].id,
                                    fileName: f.pendingFileName,
                                    base64: f.pendingFileBase64,
                                    mimeType: f.pendingFileMime,
                                  });
                                } catch (e) {
                                  console.warn(`[Upload] Falha ao enviar arquivo do fornecedor ${i + 1}:`, e);
                                }
                              }
                            });
                            await Promise.all(uploadPromises);
                            refetchQuotations();
                          },
                        }
                      );
                    }}
                    disabled={saveQuotationsMutation.isPending || uploadSupplierFileMutation.isPending}
                    style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: (saveQuotationsMutation.isPending || uploadSupplierFileMutation.isPending) ? 0.7 : 1, marginBottom: 12 }}
                  >
                    {(saveQuotationsMutation.isPending || uploadSupplierFileMutation.isPending) ? (
                      <><ActivityIndicator color="white" /><Text style={{ color: "white", fontWeight: "700", fontSize: 15, marginLeft: 8 }}>Salvando...</Text></>
                    ) : (
                      <><Text style={{ fontSize: 18 }}>💾</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Salvar Cotações</Text></>
                    )}
                  </TouchableOpacity>

                  <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center" }}>Fornecedor 1 obrigatório. Cotações 2 e 3 são opcionais. Após salvar, o aprovador escolherá a melhor cotação.</Text>
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
              {currentStatus === "aguardando_ordem_compra" && canAct && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📋 Emissão de Ordem de Compra</Text>
                  <Text className="text-xs text-muted mb-4">Preencha os campos abaixo para emitir a OC e encaminhar ao Financeiro</Text>

                  {/* Seleção de Itens Autorizados/Pendentes */}
                  {(request as any).items && (request as any).items.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700", marginBottom: 4 }}>Itens da Solicitação</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 12 }}>Marque quais itens foram autorizados para compra. Itens não marcados ficarão como pendentes.</Text>
                      {(request as any).items.map((item: any) => {
                        const status = itemFulfillment[item.id] ?? "pendente";
                        const isAutorizado = status === "autorizado";
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                              const newStatus = isAutorizado ? "pendente" : "autorizado";
                              setItemFulfillment(prev => ({ ...prev, [item.id]: newStatus }));
                              updateItemFulfillmentMutation.mutate({ itemId: item.id, fulfilledQty: newStatus === "autorizado" ? Number(item.quantity ?? 1) : 0 });
                            }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              borderRadius: 12,
                              borderWidth: 2,
                              borderColor: isAutorizado ? colors.success : colors.border,
                              backgroundColor: isAutorizado ? `${colors.success}12` : colors.background,
                              marginBottom: 8,
                              gap: 12,
                            }}
                          >
                            <View style={{
                              width: 24, height: 24, borderRadius: 12,
                              borderWidth: 2,
                              borderColor: isAutorizado ? colors.success : colors.muted,
                              backgroundColor: isAutorizado ? colors.success : "transparent",
                              alignItems: "center", justifyContent: "center",
                            }}>
                              {isAutorizado && <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{item.description ?? item.name}</Text>
                              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{item.quantity} {item.unit} · {(item.unitPrice ?? item.estimatedUnitPrice) ? `R$ ${Number(item.unitPrice ?? item.estimatedUnitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "sem valor"}</Text>
                            </View>
                            <View style={{
                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: isAutorizado ? colors.success : `${colors.warning}20`,
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: isAutorizado ? "white" : colors.warning }}>
                                {isAutorizado ? "Autorizado" : "Pendente"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      {/* Resumo */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>
                          ✓ {Object.values(itemFulfillment).filter(s => s === "autorizado").length} autorizado(s)
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.warning, fontWeight: "600" }}>
                          ⏳ {(request as any).items.length - Object.values(itemFulfillment).filter(s => s === "autorizado").length} pendente(s)
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Campo obrigatório: Valor da OC */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>
                      Valor da OC <Text style={{ color: colors.error }}>*</Text>
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: orderValueInput.trim() ? colors.success : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background }}>
                      <Text style={{ fontSize: 14, color: colors.muted, marginRight: 4 }}>R$</Text>
                      <TextInput
                        value={orderValueInput}
                        onChangeText={(t) => setOrderValueInput(t.replace(/[^0-9.,]/g, ""))}
                        placeholder={request.totalEstimatedValue ? parseFloat(request.totalEstimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.foreground }}
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                      {request.totalEstimatedValue ? `Valor estimado: R$ ${parseFloat(request.totalEstimatedValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Informe o valor da Ordem de Compra"}
                    </Text>
                  </View>
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
                      backgroundColor: orderValueInput.trim() ? colors.primary : colors.border,
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

              {/* Fluxo 06b: Aprovação CEO */}
              {currentStatus === "aguardando_aprovacao_ceo" && canAct && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">👔 Aprovação CEO</Text>
                  <Text className="text-xs text-muted mb-4">Revise a Ordem de Compra e aprove ou recuse (somente CEO)</Text>

                  {/* Visualização de itens comprados/pendentes para o CEO */}
                  {(request as any).items && (request as any).items.length > 0 && (
                    <View style={{ marginBottom: 4 }}>
                      <ItemFulfillmentCard items={(request as any).items} />
                    </View>
                  )}

                  {/* Botão de Aprovação */}
                  <TouchableOpacity
                    onPress={() => showConfirm({
                      title: "👔 Confirmar Aprovação CEO",
                      message: "Confirmar a aprovação desta Ordem de Compra e avançar para Aprovação Financeiro?",
                      confirmText: "Aprovar",
                      onConfirm: () => approveMutation.mutate({ requestId: request.id }),
                    })}
                    disabled={approveMutation.isPending}
                    style={{
                      backgroundColor: colors.success,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginTop: 12,
                      opacity: approveMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                      {approveMutation.isPending ? "Processando..." : "✓ Aprovar"}
                    </Text>
                  </TouchableOpacity>

                  {/* Botão de Recusa */}
                  <TouchableOpacity
                    onPress={() => setShowRejectModal(true)}
                    disabled={approveMutation.isPending}
                    style={{
                      backgroundColor: colors.error,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginTop: 8,
                      opacity: approveMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>✕ Recusar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Fluxo 07: Aprovação Financeiro */}
              {currentStatus === "aguardando_aprovacao_compra" && canAct && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">💰 Aprovação Financeiro</Text>
                  <Text className="text-xs text-muted mb-4">Revise os dados da compra e aprove ou recuse (somente Financeiro)</Text>

                  {/* Visualização de itens comprados/pendentes para o Financeiro */}
                  {(request as any).items && (request as any).items.length > 0 && (
                    <View style={{ marginBottom: 4 }}>
                      <ItemFulfillmentCard items={(request as any).items} />
                    </View>
                  )}

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

                  {/* Valor da OC (a partir do Fluxo 06) ou Valor Estimado (antes) */}
                  {request.totalEstimatedValue && (
                    <View style={{ backgroundColor: isAfterOC ? `${colors.success}10` : `${colors.warning}10`, borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>{isAfterOC ? "💰" : "💵"}</Text>
                      <View>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{isAfterOC ? "Valor da OC" : "Valor Estimado"}</Text>
                        <Text style={{ color: isAfterOC ? colors.success : colors.warning, fontWeight: "700", fontSize: 16 }}>{formatCurrency(request.totalEstimatedValue)}</Text>
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
              {currentStatus === "aguardando_comprovante_pagamento" && canAct && (() => {
                const payMethod = (request as any).paymentMethod as PaymentMethod | undefined;
                const isPix = payMethod === "pix";
                const hasProof = !!(request as any).paymentProofUrl;
                // Considera tanto o valor digitado na sessão quanto o já salvo no banco
                const savedObs = (request as any).paymentObservations ?? "";
                const hasObs = paymentObservations.trim().length > 0 || savedObs.trim().length > 0;
                // Para PIX: obrigatório comprovante. Para outros: obrigatório observações
                const canApprove = isPix ? hasProof : hasObs;
                return (
                  <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                    <Text className="text-sm font-bold text-foreground mb-1">💳 Comprovante de Pagamento</Text>

                    {/* Situação dos itens comprados/pendentes */}
                    {(request as any).items && (request as any).items.length > 0 && (
                      <ItemFulfillmentCard items={(request as any).items} />
                    )}

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
                          <Pressable onPress={() => setShowPaymentProofViewer(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
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
                          <Pressable onPress={() => setShowPaymentProofViewer(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
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
              {currentStatus === "aguardando_verificacao_compras" && canAct && (
                <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
                  <Text className="text-sm font-bold text-foreground mb-1">📝 Verificação Final — Compras</Text>
                  <Text className="text-xs text-muted mb-3">Verifique o comprovante, anexe a nota fiscal e finalize a OC</Text>

                  {/* Marcação interativa de itens na Verificação Final */}
                  {(request as any).items && (request as any).items.length > 0 && (
                    <View style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>📦 Itens da Solicitação</Text>
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 10 }}>Confirme os itens que foram efetivamente comprados para finalizar a OC.</Text>
                      {(request as any).items.map((item: any) => {
                        const status = itemFulfillment[item.id] ?? "pendente";
                        const isComprado = status === "comprado";
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => {
                              const newStatus = isComprado ? "pendente" : "comprado";
                              setItemFulfillment(prev => ({ ...prev, [item.id]: newStatus }));
                              updateItemFulfillmentMutation.mutate({ itemId: item.id, fulfilledQty: newStatus === "comprado" ? Number(item.quantity ?? 1) : 0 });
                            }}
                            style={{
                              flexDirection: "row", alignItems: "center",
                              paddingVertical: 12, paddingHorizontal: 14,
                              borderRadius: 12, borderWidth: 2,
                              borderColor: isComprado ? colors.success : colors.border,
                              backgroundColor: isComprado ? `${colors.success}12` : colors.background,
                              marginBottom: 8, gap: 12,
                            }}
                          >
                            <View style={{
                              width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                              borderColor: isComprado ? colors.success : colors.muted,
                              backgroundColor: isComprado ? colors.success : "transparent",
                              alignItems: "center", justifyContent: "center",
                            }}>
                              {isComprado && <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }} numberOfLines={2}>{item.description ?? item.name}</Text>
                              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{item.quantity} {item.unit}</Text>
                            </View>
                            <View style={{
                              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                              backgroundColor: isComprado ? colors.success : `${colors.warning}20`,
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: isComprado ? "white" : colors.warning }}>
                                {isComprado ? "Comprado" : "Pendente"}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4, paddingHorizontal: 4 }}>
                        <Text style={{ fontSize: 12, color: colors.success, fontWeight: "600" }}>
                          ✓ {Object.values(itemFulfillment).filter(s => s === "comprado").length} comprado(s)
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.warning, fontWeight: "600" }}>
                          ⏳ {(request as any).items.length - Object.values(itemFulfillment).filter(s => s === "comprado").length} pendente(s)
                        </Text>
                      </View>
                    </View>
                  )}

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

                  {/* Comprovante para visualização ou upload */}
                  {(request as any).paymentProofUrl ? (
                    <Pressable onPress={() => setShowPaymentProofViewer(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
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
                  ) : (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>💳 Comprovante de Pagamento *</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>Anexe o comprovante de pagamento antes de finalizar a OC</Text>
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
                            <Text style={{ color: colors.error, fontWeight: "600", fontSize: 14 }}>{paymentProofFileName ?? "Selecionar Comprovante (PDF/Imagem)"}</Text>
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

                  {/* Nota Fiscal */}
                  {(request as any).invoiceUrl ? (
                    <Pressable onPress={() => setShowInvoiceViewer(true)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
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

                  {/* Campo obrigatório: Valor da Ordem de Compra */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>
                      Valor da Ordem de Compra <Text style={{ color: colors.error }}>*</Text>
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: orderValueInput.trim() ? colors.success : colors.error, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background }}>
                      <Text style={{ fontSize: 14, color: colors.muted, marginRight: 4 }}>R$</Text>
                      <TextInput
                        value={orderValueInput}
                        onChangeText={(t) => {
                          // Permite apenas números, ponto e vírgula
                          // Garante no máximo uma vírgula e um ponto como separadores
                          const cleaned = t.replace(/[^0-9.,]/g, "");
                          setOrderValueInput(cleaned);
                        }}
                        placeholder="0,00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        style={{ flex: 1, fontSize: 16, fontWeight: "600", color: colors.foreground }}
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: orderValueInput.trim() ? colors.success : colors.error, marginTop: 4 }}>
                      {orderValueInput.trim() ? "✅ Valor da OC definido" : "* Obrigatório: informe o valor da ordem de compra"}
                    </Text>
                  </View>

                  {/* Botão Finalizar OC */}
                  <TouchableOpacity
                    onPress={handleFinalizeOC}
                    disabled={finalizeOCMutation.isPending || !orderValueInput.trim()}
                    style={{ backgroundColor: orderValueInput.trim() ? colors.primary : colors.border, borderRadius: 12, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: finalizeOCMutation.isPending ? 0.7 : 1 }}
                  >
                    {finalizeOCMutation.isPending ? <ActivityIndicator color="white" /> : <><Text style={{ fontSize: 18 }}>📦</Text><Text style={{ color: orderValueInput.trim() ? "white" : colors.muted, fontWeight: "700", fontSize: 15 }}>Finalizar Ordem de Compra</Text></>}
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

          {/* Botão Editar Solicitação — visível para qualquer usuário quando status é editável */}
          {["aguardando_gerente", "aguardando_orcamento", "rejeitada"].includes(currentStatus) && (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => router.push(`/request/edit/${request.id}` as any)}
                style={{
                  backgroundColor: `${colors.warning}12`,
                  borderWidth: 1.5,
                  borderColor: `${colors.warning}40`,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>✏️</Text>
                <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 15 }}>Editar Solicitação</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botão Editar pela Controladoria — sem reiniciar o fluxo */}
          {currentStatus === "aguardando_controladoria" && allUserRoles.some(r => ["controladoria"].includes(r)) && (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => router.push(`/request/edit-controladoria/${request.id}` as any)}
                style={{
                  backgroundColor: `${colors.primary}12`,
                  borderWidth: 1.5,
                  borderColor: `${colors.primary}40`,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>✏️</Text>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Editar Dados (sem reiniciar fluxo)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botão Definir/Remover Prioridade — apenas Willian Camilo e Rafael */}
          {canSetPriority && !isCancelled && (
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  const isCurrentlyPriority = !!(request as any).isPriority;
                  const msg = isCurrentlyPriority
                    ? `Remover a prioridade da solicitação ${request.requestNumber}?`
                    : `Marcar a solicitação ${request.requestNumber} como PRIORITÁRIA?`;
                  const doSet = () => setPriorityMutation.mutate({ requestId: request.id, isPriority: !isCurrentlyPriority });
                  if (Platform.OS === "web") {
                    if (window.confirm(msg)) doSet();
                  } else {
                    Alert.alert(
                      isCurrentlyPriority ? "Remover Prioridade" : "Definir como Prioritária",
                      msg,
                      [
                        { text: "Cancelar", style: "cancel" },
                        { text: isCurrentlyPriority ? "Remover" : "Confirmar", style: isCurrentlyPriority ? "destructive" : "default", onPress: doSet },
                      ]
                    );
                  }
                }}
                disabled={setPriorityMutation.isPending}
                style={{
                  backgroundColor: (request as any).isPriority ? "#EF444415" : "#EF444415",
                  borderWidth: 1.5,
                  borderColor: (request as any).isPriority ? "#EF444440" : "#EF444440",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: setPriorityMutation.isPending ? 0.7 : 1,
                }}
              >
                {setPriorityMutation.isPending ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>{(request as any).isPriority ? "⚪" : "🔴"}</Text>
                    <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}>
                      {(request as any).isPriority ? "Remover Prioridade" : "Definir como Prioritária"}
                    </Text>
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

          {/* Botão Excluir Solicitação — visível somente quando cancelada, para o solicitante ou admin/master */}
          {isCancelled && (isOwner || isMasterUser) && (
            <View style={{ marginTop: 8, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS === "web") {
                    if (window.confirm("Tem certeza que deseja excluir esta solicitação? Esta ação é irreversível.")) {
                      deleteMutation.mutate({ requestId: request.id });
                    }
                  } else {
                    Alert.alert(
                      "Excluir Solicitação",
                      "Tem certeza que deseja excluir esta solicitação? Esta ação é irreversível e não poderá ser desfeita.",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Excluir",
                          style: "destructive",
                          onPress: () => deleteMutation.mutate({ requestId: request.id }),
                        },
                      ]
                    );
                  }
                }}
                disabled={deleteMutation.isPending}
                style={{
                  backgroundColor: `${colors.error}20`,
                  borderWidth: 1.5,
                  borderColor: colors.error,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                    <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>Excluir Solicitação</Text>
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
        {/* Botão flutuante de Reenviar Notificação (visível para master/admin em solicitações pendentes) */}
        {isMasterUser && !isDone && !isCancelled && !isRejected && (
          <View style={{
            position: "absolute",
            top: 12,
            right: 16,
            zIndex: 100,
          }}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Reenviar Notificação",
                  "Deseja reenviar a notificação WhatsApp para o(s) aprovador(es) da etapa atual?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Reenviar",
                      onPress: () => resendNotificationMutation.mutate({ requestId: request.id }),
                    },
                  ]
                );
              }}
              disabled={resendNotificationMutation.isPending}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 7,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {resendNotificationMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ fontSize: 14 }}>🔔</Text>
              )}
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>Reenviar</Text>
            </TouchableOpacity>
          </View>
        )}

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
            {(() => {
              // Na etapa de orçamento, o botão fixo não deve ser usado — o fluxo é controlado pelo bloco de Cotações
              // O botão fica oculto na etapa aguardando_orcamento
              const orcamentoBloqueado = false;
              const orcamentoLabel = "Aprovar";
              return (
                <TouchableOpacity
                  onPress={() => {
                    // Validar campos obrigatórios antes de abrir modal de aprovação
                    const req = request as any;
                    const errors: string[] = [];

                    if (currentStatus === "aguardando_gerente") {
                      if (!req.items || req.items.length === 0) {
                        errors.push("A solicitação não possui itens cadastrados.");
                      }
                      if (!req.application?.trim()) {
                        errors.push("O campo 'Aplicação / Finalidade' não foi preenchido.");
                      }
                    }

                    if (currentStatus === "aguardando_controladoria") {
                      if (!req.budgetFileUrl && (!quotationData?.suppliers || quotationData.suppliers.length === 0)) {
                        errors.push("Nenhum orçamento ou cotação foi anexado. O setor de Orçamento precisa enviar o PDF do orçamento ou as cotações de fornecedores antes da aprovação da Controladoria.");
                      }
                      if ((quotationData?.suppliers?.length ?? 0) > 0 && !quotationData?.selectedSupplierId) {
                        errors.push("O fornecedor preferencial ainda não foi selecionado nas cotações. Acesse a seção de Cotações e selecione o fornecedor antes de aprovar.");
                      }
                    }

                    if (currentStatus === "aguardando_diretoria") {
                      if (!req.budgetFileUrl && (!quotationData?.suppliers || quotationData.suppliers.length === 0)) {
                        errors.push("Nenhum orçamento ou cotação foi anexado. O setor de Orçamento precisa enviar o PDF do orçamento ou as cotações de fornecedores antes da aprovação da Diretoria.");
                      }
                      if ((quotationData?.suppliers?.length ?? 0) > 0 && !quotationData?.selectedSupplierId) {
                        errors.push("O fornecedor preferencial ainda não foi selecionado nas cotações. Acesse a seção de Cotações e selecione o fornecedor antes de aprovar.");
                      }
                    }

                    if (currentStatus === "aguardando_aprovacao_ceo") {
                      if (!req.totalEstimatedValue && !req.orderValue) {
                        errors.push("O valor estimado ou da OC não foi informado. O setor de Compras precisa preencher o valor antes da aprovação do CEO.");
                      }
                    }

                    if (errors.length > 0) {
                      showValidationReminder(errors);
                      return;
                    }
                    setShowApproveModal(true);
                  }}
                  disabled={approveMutation.isPending || rejectMutation.isPending || submitBudgetMutation.isPending}
                  style={{
                    flex: 2,
                    backgroundColor: orcamentoBloqueado ? colors.border : colors.success,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 6,
                    shadowColor: colors.success,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: orcamentoBloqueado ? 0 : 0.3,
                    shadowRadius: 6,
                    elevation: orcamentoBloqueado ? 0 : 4,
                  }}
                >
                  {(approveMutation.isPending || submitBudgetMutation.isPending) ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={{ fontSize: 16 }}>{orcamentoBloqueado ? "📎" : "✅"}</Text>
                      <Text style={{ color: orcamentoBloqueado ? colors.muted : "white", fontWeight: "700", fontSize: 15 }}>
                        {orcamentoLabel}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })()}
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

      {/* Modal visualizador do Comprovante de Pagamento */}
      {(request as any)?.paymentProofUrl && (
        <PdfViewerModal
          visible={showPaymentProofViewer}
          url={(request as any).paymentProofUrl}
          title="Comprovante de Pagamento"
          onClose={() => setShowPaymentProofViewer(false)}
        />
      )}

      {/* Modal visualizador da Nota Fiscal */}
      {(request as any)?.invoiceUrl && (
        <PdfViewerModal
          visible={showInvoiceViewer}
          url={(request as any).invoiceUrl}
          title="Nota Fiscal"
          onClose={() => setShowInvoiceViewer(false)}
        />
      )}

      {/* Modal visualizador de PDF do Orçamento */}
      {request?.budgetFileUrl && (
        <PdfViewerModal
          visible={showBudgetViewer}
          url={request.budgetFileUrl}
          title="Orçamento Anexado"
          onClose={() => setShowBudgetViewer(false)}
        />
      )}

      {/* Modal visualizador de PDF da OC Siagri */}
      {(request as any)?.ocSiagriUrl && (
        <PdfViewerModal
          visible={showOCViewer}
          url={(request as any).ocSiagriUrl}
          title={request?.purchaseOrderNumber ? `OC N° ${request.purchaseOrderNumber}` : "Ordem de Compra"}
          onClose={() => setShowOCViewer(false)}
        />
      )}

      {/* Modal de Parecer IA do Orçamento */}
      <Modal
        visible={showBudgetAnalysis}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBudgetAnalysis(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingTop: 52 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>✨</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C" }}>Parecer IA — Orçamento</Text>
            </View>
            <TouchableOpacity onPress={() => setShowBudgetAnalysis(false)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 16, color: "#687076" }}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>
          {/* Conteúdo */}
          {(() => {
            const analysis = budgetAnalysisResult ?? savedBudgetAnalysis;
            if (!analysis) return null;
            const statusColor: Record<string, string> = {
              ADEQUADO: "#22C55E",
              ABAIXO_DO_MERCADO: "#0a7ea4",
              ACIMA_DO_MERCADO: "#F59E0B",
              MUITO_ACIMA: "#EF4444",
            };
            const recColor: Record<string, string> = {
              APROVADO: "#22C55E",
              APROVADO_COM_RESSALVAS: "#F59E0B",
              REQUER_NOVA_COTACAO: "#EF4444",
            };
            const recLabel: Record<string, string> = {
              APROVADO: "✅ Aprovado",
              APROVADO_COM_RESSALVAS: "⚠️ Aprovado com Ressalvas",
              REQUER_NOVA_COTACAO: "❌ Requer Nova Cotação",
            };
            return (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* Badge de fonte da análise */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
                  <View style={{ backgroundColor: analysis.usedWebSearch ? "#DCFCE7" : "#F0F9FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: analysis.usedWebSearch ? "#86EFAC" : "#BAE6FD", flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11 }}>{analysis.usedWebSearch ? "🌐" : "🧠"}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: analysis.usedWebSearch ? "#15803D" : "#0369A1" }}>
                      {analysis.usedWebSearch ? "Preços reais do Google Shopping" : "Base de conhecimento IA"}
                    </Text>
                  </View>
                </View>
                {/* Recomendação geral */}
                <View style={{ backgroundColor: `${recColor[analysis.recommendation] ?? "#687076"}15`, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: `${recColor[analysis.recommendation] ?? "#687076"}40` }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: recColor[analysis.recommendation] ?? "#687076", marginBottom: 4 }}>
                    {recLabel[analysis.recommendation] ?? analysis.recommendation}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#687076", lineHeight: 20 }}>{analysis.summary}</Text>
                  {analysis.overallVariation !== undefined && (
                    <Text style={{ fontSize: 12, color: "#687076", marginTop: 8 }}>
                      Variação geral: <Text style={{ fontWeight: "700", color: analysis.overallVariation > 10 ? "#EF4444" : analysis.overallVariation < -5 ? "#0a7ea4" : "#22C55E" }}>{analysis.overallVariation > 0 ? "+" : ""}{analysis.overallVariation?.toFixed(1)}% vs. mercado</Text>
                    </Text>
                  )}
                </View>
                {/* Comparativo Regional Sinop-MT */}
                {(analysis.regionalComparison || analysis.summary?.includes('Sinop')) && (
                  <View style={{ backgroundColor: "#F0FDF4", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#86EFAC" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534", marginBottom: 6 }}>📍 Comparativo Regional — Sinop-MT</Text>
                    <Text style={{ fontSize: 12, color: "#166534", lineHeight: 18 }}>
                      {analysis.regionalComparison || analysis.summary}
                    </Text>
                  </View>
                )}
                {/* Alertas */}
                {analysis.alerts && analysis.alerts.length > 0 && (
                  <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#FCD34D" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400E", marginBottom: 6 }}>⚠️ Alertas</Text>
                    {analysis.alerts.map((alert: string, i: number) => (
                      <Text key={i} style={{ fontSize: 12, color: "#92400E", marginBottom: 2 }}>• {alert}</Text>
                    ))}
                  </View>
                )}
                {/* Tabela de itens */}
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#11181C", marginBottom: 10 }}>Análise por Item</Text>
                {(analysis.items ?? []).map((item: any, i: number) => (
                  <View key={i} style={{ backgroundColor: "#F9FAFB", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#11181C", flex: 1, marginRight: 8 }}>{item.description ?? item.name}</Text>
                      <View style={{ backgroundColor: `${statusColor[item.status] ?? "#687076"}20`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor[item.status] ?? "#687076" }}>{item.status?.replace(/_/g, " ")}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 16, marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: "#687076" }}>Qtd: <Text style={{ fontWeight: "600", color: "#11181C" }}>{item.quantity}</Text></Text>
                      <Text style={{ fontSize: 12, color: "#687076" }}>Unit: <Text style={{ fontWeight: "600", color: "#11181C" }}>R$ {Number(item.unitPrice ?? 0).toFixed(2)}</Text></Text>
                      <Text style={{ fontSize: 12, color: "#687076" }}>Total: <Text style={{ fontWeight: "600", color: "#11181C" }}>R$ {Number(item.totalPrice ?? 0).toFixed(2)}</Text></Text>
                    </View>
                    <Text style={{ fontSize: 11, color: "#687076" }}>Mercado estimado: <Text style={{ fontWeight: "600" }}>R$ {Number(item.marketPriceMin ?? 0).toFixed(2)} – R$ {Number(item.marketPriceMax ?? 0).toFixed(2)}</Text></Text>
                    {item.variation !== undefined && (
                      <Text style={{ fontSize: 11, color: item.variation > 15 ? "#EF4444" : item.variation < -5 ? "#0a7ea4" : "#22C55E", marginTop: 2 }}>
                        Variação: {item.variation > 0 ? "+" : ""}{item.variation?.toFixed(1)}% vs. mercado
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, color: "#687076", marginTop: 4, fontStyle: "italic" }}>{item.justification}</Text>
                    {/* Fontes do Google Shopping */}
                    {item.sources && item.sources.length > 0 && (
                      <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#687076", marginBottom: 4 }}>🌐 Referências encontradas:</Text>
                        {item.sources.map((src: any, si: number) => (
                          <TouchableOpacity key={si} onPress={() => src.link && Linking.openURL(src.link)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <Text style={{ fontSize: 10, color: "#0a7ea4", flex: 1, marginRight: 4 }} numberOfLines={1}>{src.source || src.title}</Text>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#11181C" }}>R$ {Number(src.price ?? 0).toFixed(2)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {/* Totais */}
                {analysis.totalBudget !== undefined && (
                  <View style={{ backgroundColor: "#F0F9FF", borderRadius: 10, padding: 12, marginTop: 4, borderWidth: 1, borderColor: "#BAE6FD" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0369A1", marginBottom: 4 }}>Resumo Financeiro</Text>
                    <Text style={{ fontSize: 12, color: "#687076" }}>Total orçado: <Text style={{ fontWeight: "700", color: "#11181C" }}>R$ {Number(analysis.totalBudget).toFixed(2)}</Text></Text>
                    <Text style={{ fontSize: 12, color: "#687076" }}>Faixa de mercado: <Text style={{ fontWeight: "700", color: "#11181C" }}>R$ {Number(analysis.totalMarketMin ?? 0).toFixed(2)} – R$ {Number(analysis.totalMarketMax ?? 0).toFixed(2)}</Text></Text>
                  </View>
                )}
                {/* Botão reanalisar */}
                <TouchableOpacity
                  onPress={() => {
                    setBudgetAnalysisResult(null);
                    setShowBudgetAnalysis(false);
                    analyzeBudgetMutation.mutate({
                      requestId: Number(id),
                      budgetFileUrl: request!.budgetFileUrl!,
                      requestDescription: request!.application ?? "",
                      requestItems: (request as any).items?.map((item: any) => ({
                        name: item.description,
                        quantity: Number(item.quantity ?? 1),
                        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
                      })) ?? [],
                    });
                  }}
                  style={{ marginTop: 20, backgroundColor: "#0a7ea415", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#0a7ea440" }}
                >
                  <Text style={{ color: "#0a7ea4", fontWeight: "700", fontSize: 13 }}>🔄 Reanalisar Orçamento</Text>
                </TouchableOpacity>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* Modal de Lembrete de Validação */}
      <ValidationReminderModal
        visible={showValidationModal}
        errors={validationErrors}
        onClose={() => setShowValidationModal(false)}
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
          onConfirmRef.current();
        }}
        onCancel={hideConfirm}
      />

      {/* Modal: Selecionar Bem (Controladoria em concluídas) */}
      {showBemPicker && (
        <Modal visible={showBemPicker} animationType="slide" transparent onRequestClose={() => setShowBemPicker(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>📦 Selecionar Bem</Text>
                <Pressable onPress={() => { setShowBemPicker(false); setBemSearch(""); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
                </Pressable>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                <TextInput
                  value={bemSearch}
                  onChangeText={setBemSearch}
                  placeholder="Buscar bem por código ou descrição..."
                  placeholderTextColor={colors.muted}
                  autoFocus
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
                />
              </View>
              <FlatList
                data={filteredBemAssets}
                keyExtractor={(item: any) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum bem encontrado</Text>
                  </View>
                }
                renderItem={({ item }: any) => (
                  <Pressable
                    onPress={() => {
                      updateBemMutation.mutate({ requestId: request.id, application: `${item.code} — ${item.description}` });
                    }}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    })}
                  >
                    <View style={{ backgroundColor: `${colors.primary}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{item.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.description}</Text>
                      {item.category && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.category}</Text>}
                    </View>
                    {updateBemMutation.isPending && <ActivityIndicator size="small" color={colors.primary} />}
                  </Pressable>
                )}
              />
            </View>
          </View>
        </Modal>
      )}
      {/* Modal: Editar Metadados (Centro de Custo, Fazenda, Safra) — Controladoria em concluídas */}
      {showEditMetadata && (
        <Modal visible={showEditMetadata} animationType="slide" transparent onRequestClose={() => setShowEditMetadata(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>✏️ Editar Metadados</Text>
                <Pressable onPress={() => setShowEditMetadata(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
                </Pressable>
              </View>
              <ScrollView style={{ padding: 20 }} contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
                {/* Centro de Custo */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>Centro de Custo</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
                    <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                      {(costCentersForEdit ?? []).map((cc: any) => (
                        <Pressable
                          key={cc.id}
                          onPress={() => { setEditCostCenterCode(cc.code); setEditCostCenterName(cc.name ?? cc.code); }}
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.7 : 1,
                            backgroundColor: editCostCenterCode === cc.code ? colors.primary : colors.surface,
                            borderWidth: 1,
                            borderColor: editCostCenterCode === cc.code ? colors.primary : colors.border,
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                          })}
                        >
                          <Text style={{ fontSize: 13, color: editCostCenterCode === cc.code ? "#fff" : colors.foreground, fontWeight: "600" }}>{cc.code}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                  {editCostCenterCode ? (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Selecionado: {editCostCenterCode}</Text>
                  ) : null}
                </View>

                {/* Fazenda */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>Fazenda / Unidade</Text>
                  <View style={{ gap: 8 }}>
                    {(unitsForEdit ?? []).map((u: any) => (
                      <Pressable
                        key={u.id}
                        onPress={() => { setEditFarmId(u.id); setEditFarmName(u.name); }}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          backgroundColor: editFarmId === u.id ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: editFarmId === u.id ? colors.primary : colors.border,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        })}
                      >
                        <Text style={{ fontSize: 14, color: editFarmId === u.id ? "#fff" : colors.foreground, fontWeight: editFarmId === u.id ? "700" : "400" }}>{u.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Safra */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>Safra</Text>
                  <View style={{ gap: 8 }}>
                    {(harvestsForEdit ?? []).map((h: any) => (
                      <Pressable
                        key={h.id}
                        onPress={() => { setEditHarvestId(h.id); setEditHarvestName(h.name); }}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.7 : 1,
                          backgroundColor: editHarvestId === h.id ? colors.primary : colors.surface,
                          borderWidth: 1,
                          borderColor: editHarvestId === h.id ? colors.primary : colors.border,
                          borderRadius: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        })}
                      >
                        <Text style={{ fontSize: 14, color: editHarvestId === h.id ? "#fff" : colors.foreground, fontWeight: editHarvestId === h.id ? "700" : "400" }}>{h.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Botão Salvar */}
                <Pressable
                  onPress={() => {
                    if (!editCostCenterCode && !editFarmId && !editHarvestId) {
                      Alert.alert("Selecione ao menos um campo", "Selecione Centro de Custo, Fazenda ou Safra para atualizar.");
                      return;
                    }
                    const payload: any = { requestId: request.id };
                    if (editCostCenterCode) { payload.costCenterCode = editCostCenterCode; payload.costCenterName = editCostCenterName; }
                    if (editFarmId) { payload.farmId = editFarmId; payload.farmName = editFarmName; }
                    if (editHarvestId) { payload.harvestId = editHarvestId; payload.harvestName = editHarvestName; }
                    updateMetadataMutation.mutate(payload);
                  }}
                  disabled={updateMetadataMutation.isPending}
                  style={({ pressed }) => ({
                    opacity: pressed || updateMetadataMutation.isPending ? 0.7 : 1,
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 16,
                    alignItems: "center",
                    marginTop: 8,
                  })}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {updateMetadataMutation.isPending ? "Salvando..." : "✅ Salvar Alterações"}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}
