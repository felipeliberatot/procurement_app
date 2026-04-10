import { ScreenContainer } from "@/components/screen-container";
import * as XLSX from "xlsx";
import * as Print from "expo-print";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Tab = "users" | "costcenters" | "assets" | "units" | "businessunits" | "departments";

const ROLES: ProcurementRole[] = [
  "solicitante",
  "gerente",
  "orcamento",
  "controladoria",
  "diretoria",
  "financeiro",
  "admin",
];

type ApprovalLevel = "nenhum" | "gerente" | "controladoria" | "orcamento" | "diretoria" | "financeiro" | "master";

const APPROVAL_LEVELS: Array<{ key: ApprovalLevel; label: string; description: string; color: string }> = [
  { key: "nenhum", label: "Nenhum", description: "Não participa do fluxo de aprovação", color: "#9CA3AF" },
  { key: "gerente", label: "Gerente de Unidade", description: "Aprova na 1ª etapa do fluxo", color: "#0EA5E9" },
  { key: "controladoria", label: "Controladoria", description: "Aprova na 3ª etapa (plano orçamentário)", color: "#F59E0B" },
  { key: "orcamento", label: "Orçamento", description: "Aprova orçamentos com upload de PDF", color: "#8B5CF6" },
  { key: "diretoria", label: "Diretoria", description: "Aprova na 4ª etapa do fluxo", color: "#EF4444" },
  { key: "financeiro", label: "Financeiro", description: "Confirma pagamento na etapa final", color: "#10B981" },
  { key: "master", label: "Master", description: "Acesso total: gerencia usuários e configurações do sistema", color: "#7C3AED" },
];

const ROLE_COLORS: Record<ProcurementRole, string> = {
  solicitante: "#6366F1",
  gerente: "#0EA5E9",
  orcamento: "#8B5CF6",
  controladoria: "#F59E0B",
  diretoria: "#EF4444",
  financeiro: "#10B981",
  admin: "#8B5CF6",
  assets_admin: "#059669",
};

// ─── PIN Verification Modal ─────────────────────────────────────────────────

function PinVerificationModal({
  visible,
  onClose,
  onSuccess,
  title = "Verificar PIN Master",
  subtitle = "Digite seu PIN para confirmar a ação",
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
}) {
  const colors = useColors();
  const verifyPin = trpc.users.verifyPin.useMutation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<any>(null);

  const handleClose = useCallback(() => {
    setPin("");
    setError("");
    onClose();
  }, [onClose]);

  const handleVerify = useCallback(async () => {
    if (!pin.trim()) {
      setError("Digite o PIN.");
      return;
    }
    setIsVerifying(true);
    setError("");
    try {
      const result = await verifyPin.mutateAsync({ pin: pin.trim() });
      if (result.valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPin("");
        setError("");
        onSuccess();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError("PIN incorreto. Tente novamente.");
        setPin("");
      }
    } catch (e: any) {
      setError(e.message ?? "Erro ao verificar PIN.");
    } finally {
      setIsVerifying(false);
    }
  }, [pin, verifyPin, onSuccess]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 24 }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 360,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: "#7C3AED20",
              alignItems: "center", justifyContent: "center",
              marginBottom: 12,
            }}>
              <Text style={{ fontSize: 28 }}>🔐</Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>
              {title}
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 4 }}>
              {subtitle}
            </Text>
          </View>

          {/* PIN Input */}
          <View style={{ marginBottom: 16 }}>
            <TextInput
              ref={inputRef}
              value={pin}
              onChangeText={(v) => { setPin(v); setError(""); }}
              placeholder="Digite o PIN"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleVerify}
              style={{
                backgroundColor: colors.surface,
                borderWidth: error ? 1.5 : 1,
                borderColor: error ? colors.error : colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 18,
                color: colors.foreground,
                textAlign: "center",
                letterSpacing: 4,
              }}
            />
            {error ? (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 6, textAlign: "center" }}>
                {error}
              </Text>
            ) : null}
          </View>

          {/* Buttons */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={handleClose}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleVerify}
              disabled={isVerifying || !pin.trim()}
              style={{
                flex: 1,
                backgroundColor: isVerifying || !pin.trim() ? "#7C3AED80" : "#7C3AED",
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color="white" />
              ) : null}
              <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                {isVerifying ? "Verificando..." : "Confirmar"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── User Form Modal ──────────────────────────────────────────────────────────

function UserFormModal({
  visible,
  user,
  onClose,
  onSave,
  isSaving,
  isMasterCaller,
  onResetPassword,
  isResettingPassword,
  passwordOnlyMode,
}: {
  visible: boolean;
  user: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
  isMasterCaller?: boolean;
  onResetPassword?: (userId: number, newPassword: string) => void;
  isResettingPassword?: boolean;
  /** When true, only the password reset section is shown (non-master editing own profile) */
  passwordOnlyMode?: boolean;
}) {
  const colors = useColors();
  const isEditing = !!user?.id;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  // Papel primário + extras (seleção múltipla)
  const parseJsonArray = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };
  const [roles, setRoles] = useState<ProcurementRole[]>(() => {
    const primary = user?.procurementRole ?? "solicitante";
    const extras = parseJsonArray(user?.extraRoles) as ProcurementRole[];
    return [primary, ...extras.filter((r: ProcurementRole) => r !== primary)];
  });
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevel[]>(() => {
    const primary = user?.approvalLevel ?? "nenhum";
    const extras = parseJsonArray(user?.extraApprovalLevels) as ApprovalLevel[];
    return [primary, ...extras.filter((l: ApprovalLevel) => l !== primary)];
  });
  const [active, setActive] = useState(user?.active !== false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Reset password section (edit mode only)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset when user changes
  React.useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
    setDepartment(user?.department ?? "");
    setJobTitle(user?.jobTitle ?? "");
    const primary2 = user?.procurementRole ?? "solicitante";
    const extras2 = parseJsonArray(user?.extraRoles) as ProcurementRole[];
    setRoles([primary2, ...extras2.filter((r: ProcurementRole) => r !== primary2)]);
    const primaryL = user?.approvalLevel ?? "nenhum";
    const extrasL = parseJsonArray(user?.extraApprovalLevels) as ApprovalLevel[];
    setApprovalLevels([primaryL, ...extrasL.filter((l: ApprovalLevel) => l !== primaryL)]);
    setActive(user?.active !== false);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [user]);

  const handleResetPassword = () => {
    if (!newPassword.trim()) {
      Alert.alert("Campo obrigatório", "Digite a nova senha.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Senha muito curta", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Senhas não conferem", "A confirmação de senha não corresponde à nova senha.");
      return;
    }
    if (Platform.OS === 'web') {
      // No web, Alert.alert com botões não funciona — usar window.confirm
      const confirmed = window.confirm(`Deseja redefinir a senha de ${user?.name ?? 'este usuário'}?`);
      if (confirmed) {
        onResetPassword?.(user.id, newPassword);
        setNewPassword("");
        setConfirmPassword("");
      }
    } else {
      Alert.alert(
        "Redefinir Senha",
        `Deseja redefinir a senha de ${user?.name ?? "este usuário"}?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Redefinir",
            style: "destructive",
            onPress: () => {
              onResetPassword?.(user.id, newPassword);
              setNewPassword("");
              setConfirmPassword("");
            },
          },
        ]
      );
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Campo obrigatório", "O nome do usuário é obrigatório.");
      return;
    }
    if (!isEditing && !password.trim()) {
      Alert.alert("Campo obrigatório", "Defina uma senha para o novo usuário.");
      return;
    }
    const primaryRole = roles[0] ?? "solicitante";
    const extraRolesArr = roles.slice(1);
    const primaryLevel = approvalLevels[0] ?? "nenhum";
    const extraLevelsArr = approvalLevels.slice(1);
    onSave({
      id: user?.id,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      department: department.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      procurementRole: primaryRole,
      extraRoles: extraRolesArr,
      approvalLevel: primaryLevel,
      extraApprovalLevels: extraLevelsArr,
      active,
      password: password.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
            {isEditing ? "Editar Usuário" : "Novo Usuário"}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Modo somente-senha: não-master editando o próprio perfil */}
          {passwordOnlyMode ? (
            <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: `${colors.primary}30`, marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>🔒 Alterar Senha</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Como usuário não-master, você só pode alterar sua própria senha. Para editar outras informações, solicite ao administrador.
              </Text>
            </View>
          ) : (
          <>
          {/* Seção principal: campos solicitados */}
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Informações Pessoais
          </Text>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Nome Completo *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: João da Silva"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>

          {/* E-mail */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              E-mail
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="joao@empresa.com.br"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>

          {/* WhatsApp */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              WhatsApp
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+55 66 99999-9999"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              Número usado para notificações e aprovações via WhatsApp
            </Text>
          </View>

          {/* Cargo */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Cargo
            </Text>
            <TextInput
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="Ex: Analista de Compras, Gerente Agrícola..."
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>

          {/* Senha — novo usuário: campo simples; editando: seção dedicada */}
          {!isEditing ? (
            <View>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
                Senha *
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  style={{ flex: 1, fontSize: 14, color: colors.foreground }}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ paddingLeft: 8 }}>
                  <Text style={{ fontSize: 16 }}>{showPassword ? "🙈" : "👁"}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                O usuário usará esta senha para acessar o sistema
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: `${colors.warning}10`,
                borderWidth: 1,
                borderColor: `${colors.warning}40`,
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              {/* Header da seção */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🔐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                    Redefinir Senha
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                    Deixe em branco para manter a senha atual
                  </Text>
                </View>
              </View>

              {/* Nova senha */}
              <View>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>
                  Nova Senha
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showNewPassword}
                    style={{ flex: 1, fontSize: 14, color: colors.foreground }}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(v => !v)} style={{ paddingLeft: 8 }}>
                    <Text style={{ fontSize: 16 }}>{showNewPassword ? "🙈" : "👁"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirmar senha */}
              <View>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>
                  Confirmar Nova Senha
                </Text>
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: confirmPassword && confirmPassword !== newPassword ? colors.error : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita a nova senha"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showConfirmPassword}
                    style={{ flex: 1, fontSize: 14, color: colors.foreground }}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={{ paddingLeft: 8 }}>
                    <Text style={{ fontSize: 16 }}>{showConfirmPassword ? "🙈" : "👁"}</Text>
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>
                    As senhas não conferem
                  </Text>
                )}
                {confirmPassword.length > 0 && confirmPassword === newPassword && newPassword.length >= 6 && (
                  <Text style={{ color: colors.success, fontSize: 11, marginTop: 4 }}>
                    ✓ Senhas conferem
                  </Text>
                )}
              </View>

              {/* Botão de redefinir */}
              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={isResettingPassword || !newPassword || newPassword !== confirmPassword}
                style={{
                  backgroundColor: newPassword && newPassword === confirmPassword && newPassword.length >= 6
                    ? colors.warning
                    : colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isResettingPassword ? 0.7 : 1,
                }}
              >
                {isResettingPassword ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ fontSize: 16 }}>🔐</Text>
                )}
                <Text style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: newPassword && newPassword === confirmPassword && newPassword.length >= 6 ? "white" : colors.muted,
                }}>
                  {isResettingPassword ? "Redefinindo..." : "Redefinir Senha"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Separador */}
          <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 4 }} />
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Permissões e Acesso
          </Text>

          {/* Nível de Aprovação - seleção múltipla com reordenação */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
              Nível de Aprovação
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 10 }}>
              Selecione um ou mais níveis. Use ↑↓ para definir o nível primário.
            </Text>
            <View style={{ gap: 8 }}>
              {APPROVAL_LEVELS.filter(l => isMasterCaller || l.key !== "master").map((level) => {
                const selected = approvalLevels.includes(level.key);
                const levelIdx = approvalLevels.indexOf(level.key);
                const isPrimary = approvalLevels[0] === level.key;
                const canMoveUp = selected && levelIdx > 0;
                const canMoveDown = selected && levelIdx < approvalLevels.length - 1;
                return (
                  <Pressable
                    key={level.key}
                    onPress={() => {
                      if (selected) {
                        if (approvalLevels.length === 1) return;
                        setApprovalLevels(prev => prev.filter(l => l !== level.key));
                      } else {
                        setApprovalLevels(prev => [...prev, level.key]);
                      }
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: selected ? level.color : colors.border,
                        backgroundColor: selected ? `${level.color}15` : colors.surface,
                      }}
                    >
                      {/* Checkbox */}
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: selected ? level.color : colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                          backgroundColor: selected ? level.color : "transparent",
                        }}
                      >
                        {selected && (
                          <Text style={{ color: "white", fontSize: 12, fontWeight: "700", lineHeight: 16 }}>✓</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: selected ? level.color : colors.foreground }}>
                            {level.label}
                          </Text>
                          {isPrimary && selected && (
                            <View style={{ backgroundColor: level.color, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>PRIMÁRIO</Text>
                            </View>
                          )}
                          {selected && !isPrimary && (
                            <View style={{ backgroundColor: `${level.color}30`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: level.color, fontSize: 9, fontWeight: "600" }}>#{levelIdx + 1}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                          {level.description}
                        </Text>
                      </View>
                      {/* Botões de reordenação */}
                      {selected && approvalLevels.length > 1 && (
                        <View style={{ flexDirection: "column", gap: 2, marginLeft: 8 }}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (!canMoveUp) return;
                              setApprovalLevels(prev => {
                                const arr = [...prev];
                                [arr[levelIdx - 1], arr[levelIdx]] = [arr[levelIdx], arr[levelIdx - 1]];
                                return arr;
                              });
                            }}
                            style={({ pressed }) => ({
                              opacity: canMoveUp ? (pressed ? 0.5 : 1) : 0.2,
                              backgroundColor: canMoveUp ? `${level.color}20` : colors.border,
                              borderRadius: 6,
                              width: 26,
                              height: 26,
                              alignItems: "center",
                              justifyContent: "center",
                            })}
                          >
                            <Text style={{ fontSize: 13, color: canMoveUp ? level.color : colors.muted, fontWeight: "700" }}>↑</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (!canMoveDown) return;
                              setApprovalLevels(prev => {
                                const arr = [...prev];
                                [arr[levelIdx + 1], arr[levelIdx]] = [arr[levelIdx], arr[levelIdx + 1]];
                                return arr;
                              });
                            }}
                            style={({ pressed }) => ({
                              opacity: canMoveDown ? (pressed ? 0.5 : 1) : 0.2,
                              backgroundColor: canMoveDown ? `${level.color}20` : colors.border,
                              borderRadius: 6,
                              width: 26,
                              height: 26,
                              alignItems: "center",
                              justifyContent: "center",
                            })}
                          >
                            <Text style={{ fontSize: 13, color: canMoveDown ? level.color : colors.muted, fontWeight: "700" }}>↓</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Papel / Perfil - seleção múltipla com reordenação */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
              Perfil de Acesso *
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 10 }}>
              Selecione um ou mais perfis. Use ↑↓ para definir o papel primário.
            </Text>
            <View style={{ gap: 8 }}>
              {ROLES.map((r) => {
                const selected = roles.includes(r);
                const roleIdx = roles.indexOf(r);
                const isPrimaryRole = roles[0] === r;
                const roleColor = ROLE_COLORS[r];
                const canMoveUp = selected && roleIdx > 0;
                const canMoveDown = selected && roleIdx < roles.length - 1;
                return (
                  <Pressable
                    key={r}
                    onPress={() => {
                      if (selected) {
                        if (roles.length === 1) return;
                        setRoles(prev => prev.filter(x => x !== r));
                      } else {
                        setRoles(prev => [...prev, r]);
                      }
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: selected ? roleColor : colors.border,
                        backgroundColor: selected ? `${roleColor}15` : colors.surface,
                      }}
                    >
                      {/* Checkbox */}
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: selected ? roleColor : colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                          backgroundColor: selected ? roleColor : "transparent",
                        }}
                      >
                        {selected && (
                          <Text style={{ color: "white", fontSize: 12, fontWeight: "700", lineHeight: 16 }}>✓</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: selected ? roleColor : colors.foreground }}>
                            {ROLE_LABELS[r]}
                          </Text>
                          {isPrimaryRole && selected && (
                            <View style={{ backgroundColor: roleColor, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>PRIMÁRIO</Text>
                            </View>
                          )}
                          {selected && !isPrimaryRole && (
                            <View style={{ backgroundColor: `${roleColor}30`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: roleColor, fontSize: 9, fontWeight: "600" }}>#{roleIdx + 1}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                          {r === "solicitante" && "Cria solicitações de compra"}
                          {r === "gerente" && "Aprova na 1ª etapa do fluxo"}
                          {r === "orcamento" && "Anexa PDF de orçamento na 2ª etapa"}
                          {r === "controladoria" && "Aprova na 3ª etapa (plano orçamentário)"}
                          {r === "diretoria" && "Aprova na 4ª etapa do fluxo"}
                          {r === "financeiro" && "Confirma pagamento na etapa final"}
                          {r === "admin" && "Acesso total ao sistema"}
                        </Text>
                      </View>
                      {/* Botões de reordenação - apenas quando selecionado e há mais de 1 */}
                      {selected && roles.length > 1 && (
                        <View style={{ flexDirection: "column", gap: 2, marginLeft: 8 }}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (!canMoveUp) return;
                              setRoles(prev => {
                                const arr = [...prev];
                                [arr[roleIdx - 1], arr[roleIdx]] = [arr[roleIdx], arr[roleIdx - 1]];
                                return arr;
                              });
                            }}
                            style={({ pressed }) => ({
                              opacity: canMoveUp ? (pressed ? 0.5 : 1) : 0.2,
                              backgroundColor: canMoveUp ? `${roleColor}20` : colors.border,
                              borderRadius: 6,
                              width: 26,
                              height: 26,
                              alignItems: "center",
                              justifyContent: "center",
                            })}
                          >
                            <Text style={{ fontSize: 13, color: canMoveUp ? roleColor : colors.muted, fontWeight: "700" }}>↑</Text>
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (!canMoveDown) return;
                              setRoles(prev => {
                                const arr = [...prev];
                                [arr[roleIdx + 1], arr[roleIdx]] = [arr[roleIdx], arr[roleIdx + 1]];
                                return arr;
                              });
                            }}
                            style={({ pressed }) => ({
                              opacity: canMoveDown ? (pressed ? 0.5 : 1) : 0.2,
                              backgroundColor: canMoveDown ? `${roleColor}20` : colors.border,
                              borderRadius: 6,
                              width: 26,
                              height: 26,
                              alignItems: "center",
                              justifyContent: "center",
                            })}
                          >
                            <Text style={{ fontSize: 13, color: canMoveDown ? roleColor : colors.muted, fontWeight: "700" }}>↓</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Departamento (opcional) */}
          <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 4 }} />
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Informações Adicionais (Opcional)
          </Text>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Departamento
            </Text>
            <TextInput
              value={department}
              onChangeText={setDepartment}
              placeholder="Ex: Operações, TI, Financeiro..."
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="done"
            />
          </View>

          {/* Status ativo/inativo */}
          {isEditing && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <View>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
                  Usuário Ativo
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  Usuários inativos não podem acessar o sistema
                </Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: colors.border, true: `${ROLE_COLORS[roles[0] ?? "solicitante"]}80` }}
                thumbColor={active ? ROLE_COLORS[roles[0] ?? "solicitante"] : colors.muted}
              />
            </View>
          )}
          </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Cost Center Modal ────────────────────────────────────────────────────────

function generateAutoCode(prefix: string, existingCodes: string[]): string {
  const prefixUpper = prefix.toUpperCase();
  const nums = existingCodes
    .filter(c => c.startsWith(prefixUpper + "-"))
    .map(c => parseInt(c.replace(prefixUpper + "-", ""), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefixUpper}-${String(next).padStart(3, "0")}`;
}

function CostCenterModal({
  visible,
  onClose,
  onSave,
  item,
  isSaving,
  existingCodes,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  item?: any | null;
  isSaving?: boolean;
  existingCodes?: string[];
}) {
  const colors = useColors();
  const isEditing = !!item?.id;
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [responsible, setResponsible] = useState(item?.responsible ?? "");

  React.useEffect(() => {
    if (!item?.id && !isEditing) {
      // Auto-generate code for new items
      setCode(generateAutoCode("CC", existingCodes ?? []));
    } else {
      setCode(item?.code ?? "");
    }
    setName(item?.name ?? "");
    setResponsible(item?.responsible ?? "");
  }, [item, visible]);

  const handleSave = () => {
    if (!code.trim() || !name.trim()) {
      Alert.alert("Campos obrigatórios", "Código e nome são obrigatórios.");
      return;
    }
    onSave({ code: code.trim(), name: name.trim(), responsible: responsible.trim() || undefined });
    if (!isEditing) {
      setCode("");
      setName("");
      setResponsible("");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.primary }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
            {isEditing ? "Editar Centro de Custo" : "Novo Centro de Custo"}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Código *</Text>
              {!isEditing && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>⚙️ Gerado automaticamente</Text>}
            </View>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Ex: CC-001"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: isEditing ? colors.border : `${colors.primary}50`,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                fontFamily: "monospace",
              }}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Nome *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex: Departamento de TI"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Responsável
            </Text>
            <TextInput
              value={responsible}
              onChangeText={setResponsible}
              placeholder="Nome do responsável"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="done"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Asset Modal ──────────────────────────────────────────────────────────────

function AssetModal({
  visible,
  onClose,
  onSave,
  item,
  isSaving,
  existingCodes,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  item?: any | null;
  isSaving?: boolean;
  existingCodes?: string[];
}) {
  const colors = useColors();
  const isEditing = !!item?.id;
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [location, setLocation] = useState(item?.location ?? "");
  const [value, setValue] = useState(item?.value ?? "");
  const [hasChassi, setHasChassi] = useState<boolean>(item?.hasChassi ?? false);
  const [chassiNumber, setChassiNumber] = useState(item?.chassiNumber ?? "");
  const [licensePlate, setLicensePlate] = useState(item?.licensePlate ?? "");

  React.useEffect(() => {
    if (!item?.id && !isEditing) {
      setCode(generateAutoCode("BEM", existingCodes ?? []));
    } else {
      setCode(item?.code ?? "");
    }
    setDescription(item?.description ?? "");
    setCategory(item?.category ?? "");
    setLocation(item?.location ?? "");
    setValue(item?.value ?? "");
    setHasChassi(item?.hasChassi ?? false);
    setChassiNumber(item?.chassiNumber ?? "");
    setLicensePlate(item?.licensePlate ?? "");
  }, [item, visible]);

  const handleSave = () => {
    if (!code.trim() || !description.trim()) {
      Alert.alert("Campos obrigatórios", "Código e descrição são obrigatórios.");
      return;
    }
    if (!value.trim()) {
      Alert.alert("Campo obrigatório", "Informe o valor do bem.");
      return;
    }
    onSave({
      code: code.trim(),
      description: description.trim(),
      category: category.trim() || undefined,
      location: location.trim() || undefined,
      value: value.trim(),
      hasChassi,
      chassiNumber: hasChassi ? (chassiNumber.trim() || undefined) : undefined,
      licensePlate: hasChassi ? (licensePlate.trim() || undefined) : undefined,
    });
    if (!isEditing) {
      setCode("");
      setDescription("");
      setCategory("");
      setLocation("");
      setValue("");
      setHasChassi(false);
      setChassiNumber("");
      setLicensePlate("");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.primary }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
            {isEditing ? "Editar Bem" : "Novo Bem"}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: "700" }}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {/* Código Patrimonial (somente leitura) */}
          <View style={{ backgroundColor: `${colors.primary}12`, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 20 }}>🏷️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>CÓDIGO PATRIMONIAL — NÃO EDITÁVEL</Text>
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "800", fontFamily: "monospace", marginTop: 2 }}>
                {isEditing && item?.patrimonialCode ? item.patrimonialCode : "⚙️ Gerado ao salvar"}
              </Text>
            </View>
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Código de Identificação *</Text>
              {!isEditing && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>⚙️ Gerado automaticamente</Text>}
            </View>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Ex: BEM-001"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: isEditing ? colors.border : `${colors.primary}50`,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                fontFamily: "monospace",
              }}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Descrição *
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Notebook Dell Inspiron"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Categoria
            </Text>
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="Ex: Equipamento de TI"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Localização
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Ex: Sala 101"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="next"
            />
          </View>

          {/* Valor do Bem (Obrigatório) */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Valor do Bem *
            </Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Ex: 1500,00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: value.trim() ? colors.border : `${colors.error}60`,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
              }}
              returnKeyType="done"
            />
            {!value.trim() && (
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>Campo obrigatório</Text>
            )}
          </View>

          {/* Toggle Chassi */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: hasChassi ? colors.primary : colors.border,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <TouchableOpacity
              onPress={() => setHasChassi((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 18 }}>🚗</Text>
                <View>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Possui Chassi / Placa?</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Ative para informar o chassi e a placa</Text>
                </View>
              </View>
              <View
                style={{
                  width: 44,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: hasChassi ? colors.primary : colors.border,
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "white",
                    alignSelf: hasChassi ? "flex-end" : "flex-start",
                  }}
                />
              </View>
            </TouchableOpacity>

            {hasChassi && (
              <View style={{ marginTop: 14, gap: 12 }}>
                <View>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Nº do Chassi</Text>
                  <TextInput
                    value={chassiNumber}
                    onChangeText={setChassiNumber}
                    placeholder="Ex: 9BWZZZ377VT004251"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontSize: 14,
                      color: colors.foreground,
                      fontFamily: "monospace",
                    }}
                    returnKeyType="next"
                  />
                </View>
                <View>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Placa</Text>
                  <TextInput
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    placeholder="Ex: ABC-1234"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="characters"
                    style={{
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontSize: 14,
                      color: colors.foreground,
                      fontFamily: "monospace",
                    }}
                    returnKeyType="done"
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Business Unit Form Modal ───────────────────────────────────────────────
function BusinessUnitFormModal({
  visible, unit, onClose, onSave, isSaving, existingCodes,
}: {
  visible: boolean;
  unit: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
  existingCodes?: string[];
}) {
  const colors = useColors();
  const isEditing = !!unit?.id;
  const [name, setName] = React.useState(unit?.name ?? "");
  const [code, setCode] = React.useState(unit?.code ?? "");
  const [type, setType] = React.useState<"escritorio" | "filial" | "deposito" | "outro">(unit?.type ?? "escritorio");
  const [address, setAddress] = React.useState(unit?.address ?? "");
  const [city, setCity] = React.useState(unit?.city ?? "");
  const [state, setState] = React.useState(unit?.state ?? "");
  const [responsibleName, setResponsibleName] = React.useState(unit?.responsibleName ?? "");
  const [responsiblePhone, setResponsiblePhone] = React.useState(unit?.responsiblePhone ?? "");

  React.useEffect(() => {
    setName(unit?.name ?? "");
    if (!unit?.id) {
      setCode(generateAutoCode("UN", existingCodes ?? []));
    } else {
      setCode(unit?.code ?? "");
    }
    setType(unit?.type ?? "escritorio");
    setAddress(unit?.address ?? "");
    setCity(unit?.city ?? "");
    setState(unit?.state ?? "");
    setResponsibleName(unit?.responsibleName ?? "");
    setResponsiblePhone(unit?.responsiblePhone ?? "");
  }, [unit, visible]);

  const handleSave = () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert("Campos obrigatórios", "Nome e código são obrigatórios.");
      return;
    }
    onSave({
      name: name.trim(), code: code.trim(), type,
      address: address.trim() || undefined, city: city.trim() || undefined,
      state: state.trim() || undefined, responsibleName: responsibleName.trim() || undefined,
      responsiblePhone: responsiblePhone.trim() || undefined,
    });
  };

  const inputStyle = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.foreground,
  };
  const labelStyle = { color: colors.foreground, fontSize: 13, fontWeight: "600" as const, marginBottom: 6 };
  const UNIT_TYPES: Array<{ key: "escritorio" | "filial" | "deposito" | "outro"; label: string; icon: string }> = [
    { key: "escritorio", label: "Escritório", icon: "🏢" },
    { key: "filial", label: "Filial", icon: "🏗️" },
    { key: "deposito", label: "Depósito", icon: "📦" },
    { key: "outro", label: "Outro", icon: "📍" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{isEditing ? "Editar Unidade" : "Nova Unidade"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View><Text style={labelStyle}>Nome da Unidade *</Text><TextInput value={name} onChangeText={setName} placeholder="Ex: Escritório Central" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={labelStyle}>Código *</Text>
              {!isEditing && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>⚙️ Gerado automaticamente</Text>}
            </View>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: UN-001" placeholderTextColor={colors.muted} autoCapitalize="characters" style={{ ...inputStyle, borderColor: isEditing ? colors.border : `${colors.primary}50`, fontFamily: "monospace" }} returnKeyType="next" />
          </View>
          <View>
            <Text style={labelStyle}>Tipo de Unidade</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {UNIT_TYPES.map((t) => (
                <Pressable key={t.key} onPress={() => setType(t.key)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: type === t.key ? colors.primary : colors.border, backgroundColor: type === t.key ? `${colors.primary}15` : colors.surface }}>
                    <Text style={{ fontSize: 14 }}>{t.icon}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: type === t.key ? colors.primary : colors.muted }}>{t.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
          <View><Text style={labelStyle}>Endereço</Text><TextInput value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 2 }}><Text style={labelStyle}>Cidade</Text><TextInput value={city} onChangeText={setCity} placeholder="Cidade" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
            <View style={{ flex: 1 }}><Text style={labelStyle}>Estado</Text><TextInput value={state} onChangeText={setState} placeholder="MT" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={2} style={inputStyle} returnKeyType="next" /></View>
          </View>
          <View><Text style={labelStyle}>Responsável</Text><TextInput value={responsibleName} onChangeText={setResponsibleName} placeholder="Nome do responsável" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View><Text style={labelStyle}>Telefone do Responsável</Text><TextInput value={responsiblePhone} onChangeText={setResponsiblePhone} placeholder="+55 66 99999-9999" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={inputStyle} returnKeyType="done" /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Unit Form Modal ─────────────────────────────────────────────────────────
function UnitFormModal({
  visible, unit, onClose, onSave, isSaving, existingCodes,
}: {
  visible: boolean;
  unit: any | null;
  onClose: () => void;
  onSave: (data: { name: string; code: string; address?: string; city?: string; state?: string; responsibleName?: string; responsiblePhone?: string }) => void;
  isSaving: boolean;
  existingCodes?: string[];
}) {
  const colors = useColors();
  const isEditing = !!unit?.id;
  const [name, setName] = React.useState(unit?.name ?? "");
  const [code, setCode] = React.useState(unit?.code ?? "");
  const [address, setAddress] = React.useState(unit?.address ?? "");
  const [city, setCity] = React.useState(unit?.city ?? "");
  const [state, setState] = React.useState(unit?.state ?? "");
  const [responsibleName, setResponsibleName] = React.useState(unit?.responsibleName ?? "");
  const [responsiblePhone, setResponsiblePhone] = React.useState(unit?.responsiblePhone ?? "");

  React.useEffect(() => {
    setName(unit?.name ?? "");
    if (!unit?.id) {
      setCode(generateAutoCode("FAZ", existingCodes ?? []));
    } else {
      setCode(unit?.code ?? "");
    }
    setAddress(unit?.address ?? "");
    setCity(unit?.city ?? "");
    setState(unit?.state ?? "");
    setResponsibleName(unit?.responsibleName ?? "");
    setResponsiblePhone(unit?.responsiblePhone ?? "");
  }, [unit, visible]);

  const handleSave = () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert("Campos obrigatórios", "Nome e código são obrigatórios.");
      return;
    }
    onSave({
      name: name.trim(), code: code.trim(),
      address: address.trim() || undefined, city: city.trim() || undefined,
      state: state.trim() || undefined, responsibleName: responsibleName.trim() || undefined,
      responsiblePhone: responsiblePhone.trim() || undefined,
    });
  };

  const inputStyle = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.foreground,
  };
  const labelStyle = { color: colors.foreground, fontSize: 13, fontWeight: "600" as const, marginBottom: 6 };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{isEditing ? "Editar Fazenda" : "Nova Fazenda"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View><Text style={labelStyle}>Nome da Fazenda/Unidade *</Text><TextInput value={name} onChangeText={setName} placeholder="Ex: Fazenda São João" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={labelStyle}>Código *</Text>
              {!isEditing && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>⚙️ Gerado automaticamente</Text>}
            </View>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: FAZ-001" placeholderTextColor={colors.muted} autoCapitalize="characters" style={{ ...inputStyle, borderColor: isEditing ? colors.border : `${colors.primary}50`, fontFamily: "monospace" }} returnKeyType="next" />
          </View>
          <View><Text style={labelStyle}>Endereço</Text><TextInput value={address} onChangeText={setAddress} placeholder="Rua, número, bairro" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 2 }}><Text style={labelStyle}>Cidade</Text><TextInput value={city} onChangeText={setCity} placeholder="Cidade" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
            <View style={{ flex: 1 }}><Text style={labelStyle}>Estado</Text><TextInput value={state} onChangeText={setState} placeholder="MT" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={2} style={inputStyle} returnKeyType="next" /></View>
          </View>
          <View><Text style={labelStyle}>Responsável</Text><TextInput value={responsibleName} onChangeText={setResponsibleName} placeholder="Nome do responsável" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" /></View>
          <View><Text style={labelStyle}>Telefone do Responsável</Text><TextInput value={responsiblePhone} onChangeText={setResponsiblePhone} placeholder="+55 66 99999-9999" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={inputStyle} returnKeyType="done" /></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Department Form Modal ─────────────────────────────────────────────────────
function DepartmentFormModal({
  visible, dept, onClose, onSave, isSaving, existingCodes,
}: {
  visible: boolean;
  dept: any | null;
  onClose: () => void;
  onSave: (data: { code: string; name: string; responsible?: string }) => void;
  isSaving: boolean;
  existingCodes?: string[];
}) {
  const colors = useColors();
  const isEditing = !!dept?.id;
  const [name, setName] = React.useState(dept?.name ?? "");
  const [code, setCode] = React.useState(dept?.code ?? "");
  const [responsible, setResponsible] = React.useState(dept?.responsible ?? "");

  React.useEffect(() => {
    setName(dept?.name ?? "");
    if (!dept?.id) {
      setCode(generateAutoCode("DEP", existingCodes ?? []));
    } else {
      setCode(dept?.code ?? "");
    }
    setResponsible(dept?.responsible ?? "");
  }, [dept, visible]);

  const handleSave = () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert("Campos obrigatórios", "Nome e código são obrigatórios.");
      return;
    }
    onSave({
      name: name.trim(),
      code: code.trim(),
      responsible: responsible.trim() || undefined,
    });
  };

  const inputStyle = {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.foreground,
  };
  const labelStyle = { color: colors.foreground, fontSize: 13, fontWeight: "600" as const, marginBottom: 6 };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={{ color: colors.primary, fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{isEditing ? "Editar Departamento" : "Novo Departamento"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>Salvar</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View>
            <Text style={labelStyle}>Nome do Departamento *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex: Recursos Humanos" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="next" />
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={labelStyle}>Código *</Text>
              {!isEditing && <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>⚙️ Gerado automaticamente</Text>}
            </View>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: DEP-001" placeholderTextColor={colors.muted} autoCapitalize="characters" style={{ ...inputStyle, borderColor: isEditing ? colors.border : `${colors.primary}50`, fontFamily: "monospace" }} returnKeyType="next" />
          </View>
          <View>
            <Text style={labelStyle}>Responsável</Text>
            <TextInput value={responsible} onChangeText={setResponsible} placeholder="Nome do responsável" placeholderTextColor={colors.muted} style={inputStyle} returnKeyType="done" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RegistersScreen() {
  const { isAuthenticated, user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>(
    // Se o usuário só tem acesso a Bens, começa nessa aba
    (() => {
      const extras: string[] = (() => { try { return JSON.parse((user as any)?.extraRoles ?? "[]"); } catch { return []; } })();
      const role = (user as any)?.procurementRole ?? "solicitante";
      const hasAdmin = role === "admin" || extras.includes("admin");
      const hasMaster = (user as any)?.approvalLevel === "master";
      if (!hasAdmin && !hasMaster && extras.includes("assets_admin")) return "assets";
      return "users";
    })()
  );
  const [showCCModal, setShowCCModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showBUModal, setShowBUModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [editingBU, setEditingBU] = useState<any>(null);
  const [editingCC, setEditingCC] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Filters for users tab
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProcurementRole | "all">("all");

  // Filters for assets tab
  const [assetSearch, setAssetSearch] = useState("");
  const [assetMinValue, setAssetMinValue] = useState("");
  const [assetMaxValue, setAssetMaxValue] = useState("");
  const [showAssetFilters, setShowAssetFilters] = useState(false);
  const [isExportingAssets, setIsExportingAssets] = useState(false);

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const userExtraRoles: ProcurementRole[] = (() => { try { return JSON.parse((user as any)?.extraRoles ?? "[]") as ProcurementRole[]; } catch { return []; } })();
  const isAdmin = userRole === "admin" || userExtraRoles.includes("admin");
  const isAssetsAdmin = userExtraRoles.includes("assets_admin") && !isAdmin;
  const isMaster = (user as any)?.approvalLevel === "master";

  const { data: usersList, isLoading: usersLoading } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: costCentersList, isLoading: ccLoading } = trpc.costCenters.listAll.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: assetsList, isLoading: assetsLoading } = trpc.assets.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: unitsList, isLoading: unitsLoading } = trpc.units.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: businessUnitsList, isLoading: buLoading } = trpc.businessUnits.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: departmentsList, isLoading: deptLoading } = trpc.departments.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!usersList) return [];
    return usersList.filter((u) => {
      const matchSearch =
        !userSearch ||
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.department ?? "").toLowerCase().includes(userSearch.toLowerCase());
      const matchRole =
        roleFilter === "all" || (u as any).procurementRole === roleFilter;
      return matchSearch && matchRole;
    });
  }, [usersList, userSearch, roleFilter]);

  const filteredAssets = useMemo(() => {
    if (!assetsList) return [];
    return assetsList.filter((a: any) => {
      const matchSearch =
        !assetSearch ||
        (a.description ?? "").toLowerCase().includes(assetSearch.toLowerCase()) ||
        (a.code ?? "").toLowerCase().includes(assetSearch.toLowerCase()) ||
        (a.category ?? "").toLowerCase().includes(assetSearch.toLowerCase()) ||
        (a.location ?? "").toLowerCase().includes(assetSearch.toLowerCase());
      const numVal = parseFloat((a.value ?? "0").replace(",", ".")) || 0;
      const matchMin = !assetMinValue || numVal >= (parseFloat(assetMinValue.replace(",", ".")) || 0);
      const matchMax = !assetMaxValue || numVal <= (parseFloat(assetMaxValue.replace(",", ".")) || Infinity);
      return matchSearch && matchMin && matchMax;
    });
  }, [assetsList, assetSearch, assetMinValue, assetMaxValue]);

  // Exportação de Bens
  const handleExportAssets = async (format: "csv" | "pdf") => {
    const exportData = (assetsList ?? []);
    if (exportData.length === 0) {
      Alert.alert("Sem dados", "Não há bens para exportar.");
      return;
    }
    setIsExportingAssets(true);
    try {
      const data = exportData as any[];
      if (format === "csv") {
        // Gerar CSV puro (sem dependências externas)
        const headers = ["Cód. Patrimonial", "Código", "Descrição", "Categoria", "Localização", "Valor (R$)", "Possui Chassi", "Nº Chassi", "Placa", "Ativo", "Cadastrado em"];
        const escape = (v: any) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes("\"") || s.includes("\n") ? `"${s.replace(/"/g, "\"\"")}"` : s;
        };
        const csvRows = [
          headers.join(","),
          ...data.map((a) => [
            escape(a.patrimonialCode),
            escape(a.code),
            escape(a.description),
            escape(a.category),
            escape(a.location),
            escape(a.value),
            a.hasChassi ? "Sim" : "Não",
            escape(a.chassiNumber),
            escape(a.licensePlate),
            a.active ? "Sim" : "Não",
            escape(a.createdAt ? new Date(a.createdAt).toLocaleDateString("pt-BR") : ""),
          ].join(",")),
        ].join("\n");
        const filename = `bens_${new Date().toISOString().slice(0, 10)}.csv`;
        if (Platform.OS === "web") {
          const blob = new Blob(["\uFEFF" + csvRows], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          const uri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(uri, csvRows, { encoding: FileSystem.EncodingType.UTF8 });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Exportar Bens CSV", UTI: "public.comma-separated-values-text" });
          } else {
            Alert.alert("Arquivo salvo", `CSV salvo em: ${uri}`);
          }
        }
      } else {
        const rows = data.map((a, idx) => `
          <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'}">
            <td><strong>${a.patrimonialCode ?? ""}</strong></td>
            <td>${a.code ?? ""}</td>
            <td>${a.description ?? ""}</td>
            <td>${a.category ?? ""}</td>
            <td>${a.location ?? ""}</td>
            <td style="text-align:right">${a.value ? "R$&nbsp;" + a.value : ""}</td>
            <td style="text-align:center">${a.hasChassi ? "Sim" : "Não"}</td>
            <td>${a.chassiNumber ?? ""}</td>
            <td>${a.licensePlate ?? ""}</td>
          </tr>`).join("");
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            body { font-family: Arial, sans-serif; font-size: 9px; margin: 0; }
            h1 { font-size: 14px; color: #0a7ea4; margin-bottom: 2px; }
            p { color: #666; font-size: 8px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #0a7ea4; color: white; padding: 5px 6px; text-align: left; font-size: 8px; white-space: nowrap; }
            td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 8px; }
          </style></head><body>
          <h1>Relatório de Bens — CGS Agrícola</h1>
          <p>Gerado em: ${new Date().toLocaleString("pt-BR")} &nbsp;|&nbsp; Total: ${data.length} bens</p>
          <table>
            <thead><tr><th>Cód. Patrimonial</th><th>Código</th><th>Descrição</th><th>Categoria</th><th>Localização</th><th>Valor (R$)</th><th>Chassi</th><th>Nº Chassi</th><th>Placa</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body></html>`;
        if (Platform.OS === "web") {
          const win = window.open("", "_blank");
          if (win) {
            win.document.write(html);
            win.document.close();
            // Aguardar carregamento antes de imprimir
            win.onload = () => win.print();
            // Fallback caso onload não dispare
            setTimeout(() => { try { win.print(); } catch (_) {} }, 800);
          } else {
            Alert.alert("Bloqueado", "Permita pop-ups neste site para exportar o PDF.");
          }
        } else {
          const { uri } = await Print.printToFileAsync({ html, base64: false });
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Exportar Bens PDF", UTI: "com.adobe.pdf" });
          } else {
            Alert.alert("Arquivo salvo", `PDF salvo em: ${uri}`);
          }
        }
      }
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e.message ?? "Não foi possível exportar.");
    } finally {
      setIsExportingAssets(false);
    }
  };

  const saveUser = trpc.users.upsertByAdmin.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUserModal(false);
      setEditingUser(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const toggleActive = trpc.users.toggleActive.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Senha redefinida", "A nova senha foi salva com sucesso.");
    },
    onError: (e) => Alert.alert("Erro ao redefinir senha", e.message),
  });

  const testWhatsApp = trpc.users.testWhatsApp.useMutation({
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (data.success) {
        Alert.alert("✅ Mensagem enviada!", `Mensagem de teste enviada para ${data.phone}.\n\nSe não receber em alguns segundos, verifique se o número está correto e se o WhatsApp está configurado no servidor.`);
      } else {
        Alert.alert("⚠️ Não configurado", "O WhatsApp ainda não está configurado no servidor. Configure WHATSAPP_API_URL e WHATSAPP_API_TOKEN nas variáveis de ambiente.");
      }
    },
    onError: (e) => Alert.alert("Erro ao enviar teste", e.message),
  });

  const createCC = trpc.costCenters.create.useMutation({
    onSuccess: () => {
      utils.costCenters.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCCModal(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

   const createAsset = trpc.assets.create.useMutation({
    onSuccess: () => {
      utils.assets.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAssetModal(false);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const createUnitMutation = trpc.units.create.useMutation({
    onSuccess: () => {
      utils.units.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUnitModal(false);
      setEditingUnit(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const updateUnitMutation = trpc.units.update.useMutation({
    onSuccess: () => {
      utils.units.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowUnitModal(false);
      setEditingUnit(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const updateCC = trpc.costCenters.update.useMutation({
    onSuccess: () => {
      utils.costCenters.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCCModal(false);
      setEditingCC(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const deleteCC = trpc.costCenters.delete.useMutation({
    onSuccess: () => {
      utils.costCenters.listAll.invalidate();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const toggleCCActive = trpc.costCenters.toggleActive.useMutation({
    onSuccess: () => {
      utils.costCenters.listAll.invalidate();
      utils.costCenters.list.invalidate();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateAsset = trpc.assets.update.useMutation({
    onSuccess: () => {
      utils.assets.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAssetModal(false);
      setEditingAsset(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const deleteAsset = trpc.assets.delete.useMutation({
    onSuccess: () => {
      utils.assets.list.invalidate();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const createDept = trpc.departments.create.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeptModal(false);
      setEditingDept(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const updateDept = trpc.departments.update.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeptModal(false);
      setEditingDept(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });
  const deleteDept = trpc.departments.delete.useMutation({
    onSuccess: () => {
      utils.departments.list.invalidate();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const createBU = trpc.businessUnits.create.useMutation({
    onSuccess: () => {
      utils.businessUnits.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBUModal(false);
      setEditingBU(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateBU = trpc.businessUnits.update.useMutation({
    onSuccess: () => {
      utils.businessUnits.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBUModal(false);
      setEditingBU(null);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  // ─── Import Batch mutations ─────────────────────────────────────────────────
  const importCCBatch = trpc.costCenters.importBatch.useMutation({
    onSuccess: (data) => {
      utils.costCenters.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Importação concluída", `${data.imported} registro(s) importado(s) com sucesso.${data.errors.length > 0 ? `\n${data.errors.length} erro(s).` : ""}`);
    },
    onError: (e) => Alert.alert("Erro na importação", e.message),
  });
  const importAssetsBatch = trpc.assets.importBatch.useMutation({
    onSuccess: (data) => {
      utils.assets.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Importação concluída", `${data.imported} registro(s) importado(s) com sucesso.${data.errors.length > 0 ? `\n${data.errors.length} erro(s).` : ""}`);
    },
    onError: (e) => Alert.alert("Erro na importação", e.message),
  });
  const importUnitsBatch = trpc.units.importBatch.useMutation({
    onSuccess: (data) => {
      utils.units.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Importação concluída", `${data.imported} registro(s) importado(s) com sucesso.${data.errors.length > 0 ? `\n${data.errors.length} erro(s).` : ""}`);
    },
    onError: (e) => Alert.alert("Erro na importação", e.message),
  });
  const importBUBatch = trpc.businessUnits.importBatch.useMutation({
    onSuccess: (data) => {
      utils.businessUnits.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Importação concluída", `${data.imported} registro(s) importado(s) com sucesso.${data.errors.length > 0 ? `\n${data.errors.length} erro(s).` : ""}`);
    },
    onError: (e) => Alert.alert("Erro na importação", e.message),
  });
  const importDeptBatch = trpc.departments.importBatch.useMutation({
    onSuccess: (data) => {
      utils.departments.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Importação concluída", `${data.imported} registro(s) importado(s) com sucesso.${data.errors.length > 0 ? `\n${data.errors.length} erro(s).` : ""}`);
    },
    onError: (e) => Alert.alert("Erro na importação", e.message),
  });

  // ─── CSV Parser helper ────────────────────────────────────────────────────────
  function parseCSV(text: string): string[][] {
    return text.split(/\r?\n/).filter(l => l.trim()).map(line => {
      const cols: string[] = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if ((c === ',' || c === ';') && !inQ) { cols.push(cur.trim()); cur = ""; }
        else { cur += c; }
      }
      cols.push(cur.trim());
      return cols;
    });
  }

  // Lê o conteúdo do arquivo: usa FileReader no web (blob URI), FileSystem no mobile
  async function readFileAsText(uri: string, file?: File): Promise<string> {
    if (Platform.OS === "web" && file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string ?? "");
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsText(file, "utf-8");
      });
    }
    return FileSystem.readAsStringAsync(uri);
  }

  // ─── CSV Import handlers ────────────────────────────────────────────────────
  async function handleImportCSV(tab: Tab) {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      // No web, expo-document-picker expõe o File nativo via asset.file
      const nativeFile: File | undefined = (asset as any).file;
      const text = await readFileAsText(asset.uri, nativeFile);
      const rows = parseCSV(text);
      if (rows.length < 2) { Alert.alert("Arquivo vazio", "O arquivo CSV deve ter cabeçalho e pelo menos uma linha de dados."); return; }
      const header = rows[0].map(h => h.toLowerCase().replace(/\s+/g, ""));
      const dataRows = rows.slice(1);
      if (tab === "costcenters") {
        const codeIdx = header.indexOf("codigo") !== -1 ? header.indexOf("codigo") : header.indexOf("code") !== -1 ? header.indexOf("code") : 0;
        const nameIdx = header.indexOf("nome") !== -1 ? header.indexOf("nome") : header.indexOf("name") !== -1 ? header.indexOf("name") : 1;
        const respIdx = header.indexOf("responsavel") !== -1 ? header.indexOf("responsavel") : header.indexOf("responsible") !== -1 ? header.indexOf("responsible") : -1;
        const mapped = dataRows.map(r => ({ code: r[codeIdx] ?? "", name: r[nameIdx] ?? "", responsible: respIdx >= 0 ? r[respIdx] : undefined })).filter(r => r.code && r.name);
        if (mapped.length === 0) { Alert.alert("Sem dados válidos", "Nenhuma linha válida encontrada. Verifique o formato do arquivo."); return; }
        importCCBatch.mutate({ rows: mapped });
      } else if (tab === "assets") {
        const codeIdx = header.indexOf("codigo") !== -1 ? header.indexOf("codigo") : header.indexOf("code") !== -1 ? header.indexOf("code") : 0;
        const descIdx = header.indexOf("descricao") !== -1 ? header.indexOf("descricao") : header.indexOf("description") !== -1 ? header.indexOf("description") : 1;
        const catIdx = header.indexOf("categoria") !== -1 ? header.indexOf("categoria") : header.indexOf("category") !== -1 ? header.indexOf("category") : -1;
        const locIdx = header.indexOf("localizacao") !== -1 ? header.indexOf("localizacao") : header.indexOf("location") !== -1 ? header.indexOf("location") : -1;
        const mapped = dataRows.map(r => ({ code: r[codeIdx] ?? "", description: r[descIdx] ?? "", category: catIdx >= 0 ? r[catIdx] : undefined, location: locIdx >= 0 ? r[locIdx] : undefined })).filter(r => r.code && r.description);
        if (mapped.length === 0) { Alert.alert("Sem dados válidos", "Nenhuma linha válida encontrada. Verifique o formato do arquivo."); return; }
        importAssetsBatch.mutate({ rows: mapped });
      } else if (tab === "units") {
        const codeIdx = header.indexOf("codigo") !== -1 ? header.indexOf("codigo") : header.indexOf("code") !== -1 ? header.indexOf("code") : 0;
        const nameIdx = header.indexOf("nome") !== -1 ? header.indexOf("nome") : header.indexOf("name") !== -1 ? header.indexOf("name") : 1;
        const mapped = dataRows.map(r => ({ code: r[codeIdx] ?? "", name: r[nameIdx] ?? "", city: r[2] || undefined, state: r[3] || undefined, responsibleName: r[4] || undefined, responsiblePhone: r[5] || undefined })).filter(r => r.code && r.name);
        if (mapped.length === 0) { Alert.alert("Sem dados válidos", "Nenhuma linha válida encontrada. Verifique o formato do arquivo."); return; }
        importUnitsBatch.mutate({ rows: mapped });
      } else if (tab === "businessunits") {
        const codeIdx = header.indexOf("codigo") !== -1 ? header.indexOf("codigo") : header.indexOf("code") !== -1 ? header.indexOf("code") : 0;
        const nameIdx = header.indexOf("nome") !== -1 ? header.indexOf("nome") : header.indexOf("name") !== -1 ? header.indexOf("name") : 1;
        const mapped = dataRows.map(r => ({ code: r[codeIdx] ?? "", name: r[nameIdx] ?? "", city: r[2] || undefined, state: r[3] || undefined, responsibleName: r[4] || undefined, responsiblePhone: r[5] || undefined })).filter(r => r.code && r.name);
        if (mapped.length === 0) { Alert.alert("Sem dados válidos", "Nenhuma linha válida encontrada. Verifique o formato do arquivo."); return; }
        importBUBatch.mutate({ rows: mapped });
      } else if (tab === "departments") {
        const codeIdx = header.indexOf("codigo") !== -1 ? header.indexOf("codigo") : header.indexOf("code") !== -1 ? header.indexOf("code") : 0;
        const nameIdx = header.indexOf("nome") !== -1 ? header.indexOf("nome") : header.indexOf("name") !== -1 ? header.indexOf("name") : 1;
        const respIdx = header.indexOf("responsavel") !== -1 ? header.indexOf("responsavel") : header.indexOf("responsible") !== -1 ? header.indexOf("responsible") : -1;
        const mapped = dataRows.map(r => ({ code: r[codeIdx] ?? "", name: r[nameIdx] ?? "", responsible: respIdx >= 0 ? r[respIdx] : undefined })).filter(r => r.code && r.name);
        if (mapped.length === 0) { Alert.alert("Sem dados válidos", "Nenhuma linha válida encontrada. Verifique o formato do arquivo."); return; }
        importDeptBatch.mutate({ rows: mapped });
      }
    } catch (err: any) {
      Alert.alert("Erro ao importar", err.message ?? "Erro desconhecido");
    }
  }

  const TABS: Array<{ key: Tab; label: string; icon: string; count?: number }> = [
    { key: "users", label: "Usuários", icon: "👥", count: usersList?.length },
    { key: "costcenters", label: "Centros de Custo", icon: "🏢", count: costCentersList?.length },
    { key: "assets", label: "Bens", icon: "📦", count: assetsList?.length },
    { key: "units", label: "Fazendas", icon: "🌾", count: unitsList?.length },
    { key: "businessunits", label: "Unidades", icon: "🏗️", count: businessUnitsList?.length },
    { key: "departments", label: "Departamentos", icon: "🏛️", count: departmentsList?.length },
  ];

  // Require PIN verification before sensitive master actions
  const requirePin = useCallback((action: () => void) => {
    if (!isMaster) {
      action();
      return;
    }
    setPendingAction(() => action);
    setShowPinModal(true);
  }, [isMaster]);

  const handleEditUser = (u: any) => {
    if (!isAuthenticated) return;
    // Non-masters cannot edit master users
    if (u?.approvalLevel === "master" && !isMaster) {
      Alert.alert("Acesso Restrito", "Apenas usuários master podem editar outro usuário master.");
      return;
    }
    requirePin(() => {
      setEditingUser(u);
      setShowUserModal(true);
    });
  };

  const handleNewUser = () => {
    requirePin(() => {
      setEditingUser(null);
      setShowUserModal(true);
    });
  };

  const handleToggleActive = (u: any) => {
    Alert.alert(
      u.active ? "Desativar Usuário" : "Ativar Usuário",
      `Deseja ${u.active ? "desativar" : "ativar"} o usuário ${u.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: u.active ? "Desativar" : "Ativar",
          style: u.active ? "destructive" : "default",
          onPress: () => toggleActive.mutate({ id: u.id, active: !u.active }),
        },
      ]
    );
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = () => requirePin(async () => {
    if (!usersList || usersList.length === 0) {
      Alert.alert("Exportar CSV", "Nenhum usuário para exportar.");
      return;
    }

    setIsExporting(true);
    try {
      // Build CSV content
      const headers = ["Nome", "E-mail", "WhatsApp", "Cargo", "Nível de Aprovação", "Perfil de Acesso", "Departamento", "Status"];
      const approvalLabel: Record<string, string> = {
        nenhum: "Nenhum",
        gerente: "Gerente de Unidade",
        controladoria: "Controladoria",
        diretoria: "Diretoria",
        financeiro: "Financeiro",
        master: "Master",
      };
      const rows = usersList.map((u: any) => [
        u.name ?? "",
        u.email ?? "",
        u.phone ?? "",
        u.jobTitle ?? "",
        approvalLabel[u.approvalLevel ?? "nenhum"] ?? (u.approvalLevel ?? "Nenhum"),
        ROLE_LABELS[u.procurementRole as ProcurementRole] ?? (u.procurementRole ?? ""),
        u.department ?? "",
        u.active !== false ? "Ativo" : "Inativo",
      ]);

      const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
      const csvContent = [
        headers.map(escape).join(","),
        ...rows.map((row) => row.map(escape).join(",")),
      ].join("\n");

      if (Platform.OS === "web") {
        // Web: trigger download via anchor element
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // Native: write file and share
        const fileName = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
        const fileUri = (FileSystem.documentDirectory ?? "") + fileName;
        await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const available = await Sharing.isAvailableAsync();
        if (!available) {
          Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
          return;
        }
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Exportar lista de usuários",
          UTI: "public.comma-separated-values-text",
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("[CSV Export] Error:", err);
      Alert.alert("Erro", "Não foi possível exportar o CSV.");
    } finally {
      setIsExporting(false);
    }
  });

  return (
    <ScreenContainer>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>
            Cadastros
          </Text>
          {isMaster && (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "#7C3AED20",
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: "#7C3AED40",
            }}>
              <Text style={{ fontSize: 12 }}>⭐</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#7C3AED" }}>MASTER</Text>
            </View>
          )}
        </View>
        {!isAdmin && !isMaster && !isAssetsAdmin && (
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Apenas administradores podem criar ou editar registros
          </Text>
        )}
        {isAssetsAdmin && (
          <Text style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>
            Acesso restrito — você pode cadastrar e editar Bens
          </Text>
        )}
        {isMaster && (
          <Text style={{ fontSize: 12, color: "#7C3AED", marginTop: 2 }}>
            Acesso master — gerencie usuários, cargos e níveis de aprovação
          </Text>
        )}
      </View>

      {/* Tab Selector */}
      <View style={{ flex: 1, flexDirection: isDesktop ? "row" : "column" }}>
        {/* Sidebar de abas (desktop) ou tab bar horizontal (mobile) */}
        {isDesktop ? (
          <View style={{ width: 180, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 12, paddingHorizontal: 8 }}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  marginBottom: 2,
                  backgroundColor: activeTab === tab.key ? `${colors.primary}18` : pressed ? `${colors.primary}08` : "transparent",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
                <Text style={{ fontSize: 13, fontWeight: activeTab === tab.key ? "700" : "500", color: activeTab === tab.key ? colors.primary : colors.foreground, flex: 1 }}>{tab.label}</Text>
                {tab.count !== undefined && (
                  <View style={{ backgroundColor: activeTab === tab.key ? colors.primary : colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: activeTab === tab.key ? "white" : colors.muted }}>{tab.count}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border }}
            contentContainerStyle={{ flexDirection: "row" }}
          >
            {TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minWidth: 80 })}>
                <View
                  style={{
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 2,
                    borderBottomColor: activeTab === tab.key ? colors.primary : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{tab.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", marginTop: 2, color: activeTab === tab.key ? colors.primary : colors.muted }}>{tab.label}</Text>
                  {tab.count !== undefined && (
                    <View style={{ backgroundColor: activeTab === tab.key ? colors.primary : colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: activeTab === tab.key ? "white" : colors.muted }}>{tab.count}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {/* Conteúdo das abas */}
        <View style={{ flex: 1 }}>
      {/* ── Users Tab ── */}
      {activeTab === "users" && (
        <View style={{ flex: 1 }}>
          {/* List with header containing search/filters/buttons */}
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={{ gap: 8, paddingTop: 12, paddingBottom: 4 }}>
                {/* Search bar */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔍</Text>
                  <TextInput
                    value={userSearch}
                    onChangeText={setUserSearch}
                    placeholder="Buscar por nome, e-mail ou departamento..."
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, fontSize: 13, color: colors.foreground }}
                    returnKeyType="search"
                  />
                  {userSearch.length > 0 && (
                    <Pressable onPress={() => setUserSearch("")} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                      <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
                    </Pressable>
                  )}
                </View>

                {/* Role filter chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
                    {([{ key: "all", label: "Todos" }, ...ROLES.map((r) => ({ key: r, label: ROLE_LABELS[r] }))] as Array<{ key: string; label: string }>).map(
                      (item) => {
                        const selected = roleFilter === item.key;
                        const roleColor =
                          item.key === "all" ? colors.primary : ROLE_COLORS[item.key as ProcurementRole];
                        return (
                          <Pressable
                            key={item.key}
                            onPress={() => setRoleFilter(item.key as ProcurementRole | "all")}
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                          >
                            <View
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20,
                                backgroundColor: selected ? roleColor : colors.surface,
                                borderWidth: 1,
                                borderColor: selected ? roleColor : colors.border,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: selected ? "white" : colors.muted,
                                }}
                              >
                                {item.label}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                </ScrollView>

                {/* Add user button + Export CSV — master only */}
                {isMaster && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={handleNewUser}
                      style={{
                        flex: 1,
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                        + Novo Usuário
                      </Text>
                    </TouchableOpacity>

                    {/* Export CSV — master only */}
                    {isMaster && (
                      <TouchableOpacity
                        onPress={handleExportCSV}
                        disabled={isExporting}
                        style={{
                          backgroundColor: isExporting ? colors.surface : "#7C3AED",
                          borderRadius: 12,
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                          opacity: isExporting ? 0.6 : 1,
                        }}
                      >
                        {isExporting ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={{ fontSize: 16 }}>📄</Text>
                        )}
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
                          {isExporting ? "Exportando..." : "CSV"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Approval Levels Panel */}
                {usersList && usersList.length > 0 && (() => {
                  const approverLevels = [
                    { key: "master", label: "Master", icon: "⭐", color: "#7C3AED" },
                    { key: "gerente", label: "Gerente", icon: "🏢", color: "#0EA5E9" },
                    { key: "orcamento", label: "Orçamento", icon: "📋", color: "#8B5CF6" },
                    { key: "controladoria", label: "Controladoria", icon: "📊", color: "#F59E0B" },
                    { key: "diretoria", label: "Diretoria", icon: "🏆", color: "#EF4444" },
                    { key: "financeiro", label: "Financeiro", icon: "💰", color: "#10B981" },
                  ];
                  // Verifica cobertura considerando approvalLevel primário + extraApprovalLevels
                  const getResponsible = (levelKey: string) => usersList.filter((u) => {
                    if ((u as any).active === false) return false;
                    if ((u as any).approvalLevel === levelKey) return true;
                    try {
                      const extras: string[] = JSON.parse((u as any).extraApprovalLevels ?? "[]");
                      return extras.includes(levelKey);
                    } catch { return false; }
                  });
                  const uncoveredLevels = approverLevels.filter(l => l.key !== "master" && getResponsible(l.key).length === 0);
                  return (
                    <View style={{ paddingBottom: 4, gap: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Painel de Aprovadores
                      </Text>
                      {/* Alerta consolidado quando há níveis sem cobertura */}
                      {uncoveredLevels.length > 0 && (
                        <View style={{ backgroundColor: `${colors.error}12`, borderWidth: 1, borderColor: `${colors.error}40`, borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <Text style={{ fontSize: 16 }}>⚠️</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.error, marginBottom: 2 }}>
                              {uncoveredLevels.length} nível{uncoveredLevels.length > 1 ? "is" : ""} sem aprovador ativo
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.error }}>
                              {uncoveredLevels.map(l => l.label).join(", ")} — solicitações podem ficar travadas nestas etapas.
                            </Text>
                          </View>
                        </View>
                      )}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {approverLevels.map((lvl) => {
                            const responsible = getResponsible(lvl.key);
                            const isEmpty = responsible.length === 0;
                            const isCritical = isEmpty && lvl.key !== "master";
                            return (
                              <View
                                key={lvl.key}
                                style={{
                                  backgroundColor: isCritical ? `${colors.error}10` : `${lvl.color}12`,
                                  borderWidth: isCritical ? 1.5 : 1,
                                  borderColor: isCritical ? `${colors.error}50` : `${lvl.color}30`,
                                  borderRadius: 12,
                                  padding: 10,
                                  minWidth: 120,
                                  maxWidth: 160,
                                }}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                  <Text style={{ fontSize: 14 }}>{lvl.icon}</Text>
                                  <Text style={{ fontSize: 11, fontWeight: "700", color: isCritical ? colors.error : lvl.color }}>
                                    {lvl.label}
                                  </Text>
                                  {responsible.length > 0 && (
                                    <View style={{ backgroundColor: `${lvl.color}25`, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                      <Text style={{ fontSize: 9, fontWeight: "700", color: lvl.color }}>{responsible.length}</Text>
                                    </View>
                                  )}
                                </View>
                                {isEmpty ? (
                                  <Text style={{ fontSize: 10, color: isCritical ? colors.error : colors.muted, fontWeight: "600" }}>
                                    {isCritical ? "⚠️ Sem responsável" : "— Não configurado"}
                                  </Text>
                                ) : (
                                  responsible.slice(0, 2).map((u) => (
                                    <Text key={(u as any).id} style={{ fontSize: 10, color: colors.foreground, marginBottom: 1 }} numberOfLines={1}>
                                      • {(u as any).name ?? (u as any).email ?? "—"}
                                    </Text>
                                  ))
                                )}
                                {responsible.length > 2 && (
                                  <Text style={{ fontSize: 10, color: colors.muted }}>+{responsible.length - 2} mais</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  );
                })()}

                {/* Results count */}
                <Text style={{ fontSize: 12, color: colors.muted, paddingBottom: 4 }}>
                  {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""} encontrado{filteredUsers.length !== 1 ? "s" : ""}
                </Text>
              </View>
            }
            ListEmptyComponent={
              usersLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>
                    Nenhum usuário encontrado
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    {userSearch || roleFilter !== "all"
                      ? "Tente ajustar os filtros de busca"
                      : "Adicione o primeiro usuário clicando em \"+ Novo Usuário\""}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const roleColor = ROLE_COLORS[(item as any).procurementRole as ProcurementRole] ?? colors.primary;
              const isActive = (item as any).active !== false;
              return (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  {/* Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: `${roleColor}20`,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: `${roleColor}40`,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800", color: roleColor }}>
                      {(item.name ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {item.name ?? "Sem nome"}
                      </Text>
                      {!isActive && (
                        <View style={{ backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600" }}>INATIVO</Text>
                        </View>
                      )}
                    </View>
                    {(item as any).jobTitle && (
                      <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }} numberOfLines={1}>
                        {(item as any).jobTitle}
                      </Text>
                    )}
                    {item.email && (
                      <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                        {item.email}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                      {(item as any).department && (
                        <Text style={{ fontSize: 11, color: colors.muted }}>🏢 {(item as any).department}</Text>
                      )}
                      {(item as any).phone && (
                        <Text style={{ fontSize: 11, color: colors.muted }}>📱 {(item as any).phone}</Text>
                      )}
                      {(() => {
                        const allLevels: string[] = [];
                        if ((item as any).approvalLevel && (item as any).approvalLevel !== "nenhum" && (item as any).approvalLevel !== "master") {
                          allLevels.push((item as any).approvalLevel);
                        }
                        try {
                          if ((item as any).extraApprovalLevels) {
                            const extras = JSON.parse((item as any).extraApprovalLevels);
                            extras.forEach((l: string) => { if (l !== "nenhum" && l !== "master" && !allLevels.includes(l)) allLevels.push(l); });
                          }
                        } catch {}
                        if (allLevels.length === 0) return null;
                        return (
                          <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "600" }}>
                            ✓ Aprova: {allLevels.map(l => APPROVAL_LEVELS.find(a => a.key === l)?.label ?? l).join(", ")}
                          </Text>
                        );
                      })()}
                    </View>
                  </View>

                  {/* Right side: role badges + edit + toggle */}
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {/* Badge papel primário */}
                    <View style={{ backgroundColor: `${roleColor}15`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${roleColor}30` }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: roleColor }}>
                        {ROLE_LABELS[(item as any).procurementRole as ProcurementRole] ?? "—"}
                      </Text>
                    </View>
                    {/* Badges de papéis extras */}
                    {(() => {
                      const extras: string[] = [];
                      try { if ((item as any).extraRoles) extras.push(...JSON.parse((item as any).extraRoles)); } catch {}
                      return extras.map((r: string) => {
                        const ec = ROLE_COLORS[r as ProcurementRole] ?? colors.muted;
                        return (
                          <View key={r} style={{ backgroundColor: `${ec}15`, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: `${ec}30` }}>
                            <Text style={{ fontSize: 10, fontWeight: "600", color: ec }}>{ROLE_LABELS[r as ProcurementRole] ?? r}</Text>
                          </View>
                        );
                      });
                    })()}
                    {(item as any).approvalLevel === "master" && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#7C3AED20", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#7C3AED40" }}>
                        <Text style={{ fontSize: 9 }}>⭐</Text>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#7C3AED" }}>MASTER</Text>
                      </View>
                    )}
                    {/* Edit button: master can edit anyone; non-master can only edit themselves (password only) */}
                    {(isMaster || (user as any)?.id === (item as any).id) && (
                      <Pressable
                        onPress={() => handleEditUser(item)}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.6 : 1,
                          backgroundColor: `${colors.primary}15`,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: `${colors.primary}30`,
                        })}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                          {isMaster ? "✏️ Editar" : "🔒 Minha Senha"}
                        </Text>
                      </Pressable>
                    )}
                    {/* Botão de teste WhatsApp — apenas Master, apenas se tiver telefone */}
                    {isMaster && !!(item as any).phone && (
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "📱 Testar WhatsApp",
                            `Enviar mensagem de teste para ${(item as any).phone}?`,
                            [
                              { text: "Cancelar", style: "cancel" },
                              {
                                text: "Enviar",
                                onPress: () => testWhatsApp.mutate({ userId: (item as any).id }),
                              },
                            ]
                          );
                        }}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.6 : 1,
                          backgroundColor: "#25D36615",
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: "#25D36630",
                        })}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#25D366" }}>
                          {testWhatsApp.isPending && testWhatsApp.variables?.userId === (item as any).id
                            ? "⏳ Enviando..."
                            : "📱 Testar WA"}
                        </Text>
                      </Pressable>
                    )}
                    {/* Aviso quando não tem telefone */}
                    {isMaster && !(item as any).phone && (
                      <Text style={{ fontSize: 10, color: colors.warning, fontWeight: "600" }}>⚠️ Sem WA</Text>
                    )}
                    {(isAdmin || isMaster) && (
                      <Pressable
                        onPress={() => handleToggleActive(item)}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                      >
                        <Text style={{ fontSize: 11, color: isActive ? colors.error : colors.success }}>
                          {isActive ? "Desativar" : "Ativar"}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Cost Centers Tab ── */}
      {activeTab === "costcenters" && (
        <View style={{ flex: 1 }}>
          {isAdmin && (
            <View style={{ padding: 12, flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowCCModal(true)}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Novo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleImportCSV("costcenters")}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>📥 Importar Arquivo</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={costCentersList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              ccLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🏢</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                    Nenhum centro de custo
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>
                    {item.code}
                  </Text>
                  <View
                    style={{
                      backgroundColor: item.active ? "#22C55E20" : colors.border,
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: item.active ? "#22C55E" : colors.muted,
                      }}
                    >
                      {item.active ? "Ativo" : "Inativo"}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                  {item.name}
                </Text>
                {item.responsible && (
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    👤 {item.responsible}
                  </Text>
                )}
                {isAdmin && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => { setEditingCC(item); setShowCCModal(true); }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: `${colors.primary}15`, borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: `${colors.primary}30` })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>✏️ Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const isActive = (item as any).active;
                        const label = isActive ? "Inativar" : "Reativar";
                        const msg = isActive
                          ? `Inativar "${(item as any).name}"? Ele não aparecerá nas novas solicitações, mas o histórico será preservado.`
                          : `Reativar "${(item as any).name}"? Ele voltará a aparecer nas novas solicitações.`;
                        const doToggle = () => toggleCCActive.mutate({ id: (item as any).id, active: !isActive });
                        if (typeof window !== "undefined") {
                          if (window.confirm(msg)) doToggle();
                        } else {
                          Alert.alert(label + " Centro de Custo", msg, [
                            { text: "Cancelar", style: "cancel" },
                            { text: label, style: isActive ? "destructive" : "default", onPress: doToggle },
                          ]);
                        }
                      }}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.6 : 1,
                        flex: 1,
                        backgroundColor: (item as any).active ? "#FEE2E215" : "#22C55E15",
                        borderRadius: 8,
                        paddingVertical: 6,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: (item as any).active ? "#FCA5A530" : "#22C55E30",
                      })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: (item as any).active ? "#EF4444" : "#22C55E" }}>
                        {(item as any).active ? "⏸️ Inativar" : "▶️ Reativar"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      )}

      {/* ── Assets Tab ── */}
      {activeTab === "assets" && (
        <View style={{ flex: 1 }}>
          {/* Barra de ações: Novo, Importar, Exportar */}
          {(isAdmin || isAssetsAdmin) && (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
              {/* Linha 1: Novo + Importar */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { setEditingAsset(null); setShowAssetModal(true); }}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>+ Novo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleImportCSV("assets")}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>📥 Importar Arquivo</Text>
                </TouchableOpacity>
              </View>
              {/* Linha 2: Exportar CSV + Exportar PDF */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => handleExportAssets("csv")}
                  disabled={isExportingAssets}
                  style={{ flex: 1, backgroundColor: "#059669", borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}
                >
                  {isExportingAssets
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>📄 Exportar CSV</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleExportAssets("pdf")}
                  disabled={isExportingAssets}
                  style={{ flex: 1, backgroundColor: "#34D399", borderRadius: 12, paddingVertical: 10, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4 }}
                >
                  {isExportingAssets
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>📄 Exportar PDF</Text>
                  }
                </TouchableOpacity>
              </View>

              {/* Barra de busca + toggle filtros */}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  value={assetSearch}
                  onChangeText={setAssetSearch}
                  placeholder="🔍 Buscar bens..."
                  placeholderTextColor={colors.muted}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    fontSize: 13,
                    color: colors.foreground,
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowAssetFilters((v) => !v)}
                  style={{
                    backgroundColor: (assetMinValue || assetMaxValue) ? colors.primary : colors.surface,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderWidth: 1,
                    borderColor: (assetMinValue || assetMaxValue) ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: (assetMinValue || assetMaxValue) ? "white" : colors.foreground }}>🔧 Filtros{(assetMinValue || assetMaxValue) ? " ●" : ""}</Text>
                </TouchableOpacity>
              </View>

              {/* Painel de filtros por valor */}
              {showAssetFilters && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Filtrar por Valor (R$)</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Mínimo</Text>
                      <TextInput
                        value={assetMinValue}
                        onChangeText={setAssetMinValue}
                        placeholder="0,00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontSize: 13,
                          color: colors.foreground,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Máximo</Text>
                      <TextInput
                        value={assetMaxValue}
                        onChangeText={setAssetMaxValue}
                        placeholder="999999,00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          fontSize: 13,
                          color: colors.foreground,
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => { setAssetMinValue(""); setAssetMaxValue(""); }}
                      style={{ justifyContent: "flex-end", paddingBottom: 2 }}
                    >
                      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {filteredAssets.length} de {assetsList?.length ?? 0} bens
                  </Text>
                </View>
              )}
            </View>
          )}

          <FlatList
            data={filteredAssets}
            keyExtractor={(item: any) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              assetsLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                    {assetSearch || assetMinValue || assetMaxValue ? "Nenhum bem encontrado" : "Nenhum bem cadastrado"}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }: { item: any }) => (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {item.patrimonialCode && (
                      <View style={{ backgroundColor: `${colors.primary}18`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "800" }}>{item.patrimonialCode}</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 12, fontFamily: "monospace", color: colors.muted, fontWeight: "600" }}>
                      {item.code}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {item.hasChassi && (
                      <View style={{ backgroundColor: "#F59E0B20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#F59E0B" }}>🚗 Chassi</Text>
                      </View>
                    )}
                    {item.category && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>{item.category}</Text>
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                  {item.description}
                </Text>
                {item.value && (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.success, marginTop: 3 }}>
                    R$ {item.value}
                  </Text>
                )}
                {item.location && (
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    📍 {item.location}
                  </Text>
                )}
                {item.hasChassi && (item.chassiNumber || item.licensePlate) && (
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    {item.chassiNumber && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>Chassi: {item.chassiNumber}</Text>
                    )}
                    {item.licensePlate && (
                      <Text style={{ fontSize: 11, color: colors.muted }}>Placa: {item.licensePlate}</Text>
                    )}
                  </View>
                )}
                {(isAdmin || isAssetsAdmin) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => { setEditingAsset(item); setShowAssetModal(true); }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: `${colors.primary}15`, borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: `${colors.primary}30` })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>✏️ Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const doDelete = () => deleteAsset.mutate({ id: item.id });
                        if (typeof window !== "undefined") {
                          if (window.confirm(`Deseja excluir o bem "${item.description}"?`)) doDelete();
                        } else {
                          Alert.alert("Excluir Bem", `Deseja excluir "${item.description}"?`, [
                            { text: "Cancelar", style: "cancel" },
                            { text: "Excluir", style: "destructive", onPress: doDelete },
                          ]);
                        }
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: "#FEE2E215", borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "#FCA5A530" })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>🗑️ Excluir</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      )}

      {/* ── Units Tab ── */}
      {activeTab === "units" && (
        <View style={{ flex: 1 }}>
          {(isAdmin || isMaster) && (
            <View style={{ padding: 12, flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setEditingUnit(null); setShowUnitModal(true); }}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Nova</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleImportCSV("units")}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>📥 Importar Arquivo</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={unitsList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              unitsLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🌾</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Nenhuma fazenda cadastrada</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Cadastre as fazendas e escritórios para usar nos malotes</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { if (isAdmin || isMaster) { setEditingUnit(item); setShowUnitModal(true); } }}
                activeOpacity={0.7}
              >
                <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{item.code}</Text>
                    </View>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.active ? "#22C55E" : "#EF4444" }} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>{item.name}</Text>
                  {(item.city || item.state) && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>📍 {[item.city, item.state].filter(Boolean).join(" - ")}</Text>
                  )}
                  {item.address && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.address}</Text>
                  )}
                  {item.responsibleName && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>👤 {item.responsibleName}{item.responsiblePhone ? ` · ${item.responsiblePhone}` : ""}</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
      {/* ── Business Units Tab ── */}
      {activeTab === "businessunits" && (
        <View style={{ flex: 1 }}>
          {(isAdmin || isMaster) && (
            <View style={{ padding: 12, flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setEditingBU(null); setShowBUModal(true); }}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Nova</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleImportCSV("businessunits")}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>📥 Importar Arquivo</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={businessUnitsList ?? []}
            keyExtractor={(item) => String((item as any).id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              buLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🏗️</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Nenhuma unidade cadastrada</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Cadastre escritórios, filiais e depósitos</Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const typeIcons: Record<string, string> = { escritorio: "🏢", filial: "🏗️", deposito: "📦", outro: "📍" };
              const typeLabels: Record<string, string> = { escritorio: "Escritório", filial: "Filial", deposito: "Depósito", outro: "Outro" };
              const t = (item as any).type ?? "outro";
              return (
                <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{(item as any).code}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.muted }}>{typeIcons[t]} {typeLabels[t]}</Text>
                    </View>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (item as any).active ? "#22C55E" : "#EF4444" }} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>{(item as any).name}</Text>
                  {((item as any).city || (item as any).state) && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>📍 {[(item as any).city, (item as any).state].filter(Boolean).join(" - ")}</Text>
                  )}
                  {(item as any).responsibleName && (
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>👤 {(item as any).responsibleName}{(item as any).responsiblePhone ? ` · ${(item as any).responsiblePhone}` : ""}</Text>
                  )}
                  {(isAdmin || isMaster) && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Pressable
                        onPress={() => { setEditingBU(item); setShowBUModal(true); }}
                        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: `${colors.primary}15`, borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: `${colors.primary}30` })}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>✏️ Editar</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── Departments Tab ── */}
      {activeTab === "departments" && (
        <View style={{ flex: 1 }}>
          {(isAdmin || isMaster) && (
            <View style={{ padding: 12, flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setEditingDept(null); setShowDeptModal(true); }}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Novo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleImportCSV("departments")}
                style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>📥 Importar Arquivo</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={departmentsList ?? []}
            keyExtractor={(item) => String((item as any).id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              deptLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🏛️</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>Nenhum departamento cadastrado</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Cadastre os departamentos da empresa</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <View style={{ backgroundColor: colors.primary + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{(item as any).code}</Text>
                  </View>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: (item as any).active ? "#22C55E" : "#EF4444" }} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>{(item as any).name}</Text>
                {(item as any).responsible && (
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>👤 {(item as any).responsible}</Text>
                )}
                {(isAdmin || isMaster) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => { setEditingDept(item); setShowDeptModal(true); }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: `${colors.primary}15`, borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: `${colors.primary}30` })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>✏️ Editar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Alert.alert("Excluir Departamento", `Deseja excluir o departamento "${(item as any).name}"?`, [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Excluir", style: "destructive", onPress: () => deleteDept.mutate({ id: (item as any).id }) },
                        ]);
                      }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: "#EF444415", borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: "#EF444430" })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>🗑️ Excluir</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          />
        </View>
      )}

        </View>{/* fecha View conteúdo das abas */}
      </View>{/* fecha View wrapper principal */}

      {/* Modals */}
      <CostCenterModal
        visible={showCCModal}
        item={editingCC}
        onClose={() => { setShowCCModal(false); setEditingCC(null); }}
        onSave={(data) => {
          if (editingCC?.id) {
            updateCC.mutate({ id: editingCC.id, ...data });
          } else {
            createCC.mutate(data);
          }
        }}
        isSaving={createCC.isPending || updateCC.isPending}
        existingCodes={(costCentersList ?? []).map((c: any) => c.code)}
      />
      <AssetModal
        visible={showAssetModal}
        item={editingAsset}
        onClose={() => { setShowAssetModal(false); setEditingAsset(null); }}
        onSave={(data) => {
          if (editingAsset?.id) {
            updateAsset.mutate({ id: editingAsset.id, ...data });
          } else {
            createAsset.mutate(data);
          }
        }}
        isSaving={createAsset.isPending || updateAsset.isPending}
        existingCodes={(assetsList ?? []).map((a: any) => a.code)}
      />
      <UserFormModal
        visible={showUserModal}
        user={editingUser}
        onClose={() => { setShowUserModal(false); setEditingUser(null); }}
        onSave={(data) => saveUser.mutate(data)}
        isSaving={saveUser.isPending}
        isMasterCaller={isMaster}
        onResetPassword={(userId, newPassword) => resetPassword.mutate({ userId, newPassword })}
        isResettingPassword={resetPassword.isPending}
        passwordOnlyMode={!isMaster && !!editingUser && (user as any)?.id === editingUser?.id}
      />
      <PinVerificationModal
        visible={showPinModal}
        onClose={() => { setShowPinModal(false); setPendingAction(null); }}
        onSuccess={() => {
          setShowPinModal(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        title="Verificar PIN Master"
        subtitle="Digite seu PIN para confirmar a ação administrativa"
      />
      <UnitFormModal
        visible={showUnitModal}
        unit={editingUnit}
        onClose={() => { setShowUnitModal(false); setEditingUnit(null); }}
        onSave={(data) => {
          if (editingUnit?.id) {
            updateUnitMutation.mutate({ id: editingUnit.id, ...data });
          } else {
            createUnitMutation.mutate(data);
          }
        }}
        isSaving={createUnitMutation.isPending || updateUnitMutation.isPending}
        existingCodes={(unitsList ?? []).map((u: any) => u.code)}
      />
      <BusinessUnitFormModal
        visible={showBUModal}
        unit={editingBU}
        onClose={() => { setShowBUModal(false); setEditingBU(null); }}
        onSave={(data) => {
          if (editingBU?.id) {
            updateBU.mutate({ id: editingBU.id, ...data });
          } else {
            createBU.mutate(data);
          }
        }}
        isSaving={createBU.isPending || updateBU.isPending}
        existingCodes={(businessUnitsList ?? []).map((u: any) => u.code)}
      />
      <DepartmentFormModal
        visible={showDeptModal}
        dept={editingDept}
        onClose={() => { setShowDeptModal(false); setEditingDept(null); }}
        onSave={(data) => {
          if (editingDept?.id) {
            updateDept.mutate({ id: editingDept.id, ...data });
          } else {
            createDept.mutate(data);
          }
        }}
        isSaving={createDept.isPending || updateDept.isPending}
        existingCodes={(departmentsList ?? []).map((d: any) => d.code)}
      />
    </ScreenContainer>
  );
}
