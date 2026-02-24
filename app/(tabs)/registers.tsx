import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";
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

type Tab = "users" | "costcenters" | "assets" | "units" | "businessunits";

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
  const [role, setRole] = useState<ProcurementRole>(user?.procurementRole ?? "solicitante");
  const [approvalLevel, setApprovalLevel] = useState<ApprovalLevel>(user?.approvalLevel ?? "nenhum");
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
    setRole(user?.procurementRole ?? "solicitante");
    setApprovalLevel(user?.approvalLevel ?? "nenhum");
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
    onSave({
      id: user?.id,
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      department: department.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      procurementRole: role,
      approvalLevel,
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

          {/* Nível de Aprovação */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
              Nível de Aprovação
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 10 }}>
              Define em qual etapa do fluxo de compras este usuário pode aprovar
            </Text>
            <View style={{ gap: 8 }}>
              {APPROVAL_LEVELS.filter(l => isMasterCaller || l.key !== "master").map((level) => {
                const selected = approvalLevel === level.key;
                return (
                  <Pressable
                    key={level.key}
                    onPress={() => setApprovalLevel(level.key)}
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
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: selected ? level.color : colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                          backgroundColor: selected ? level.color : "transparent",
                        }}
                      >
                        {selected && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "white" }} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: selected ? level.color : colors.foreground,
                          }}
                        >
                          {level.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                          {level.description}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Papel / Perfil */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Perfil de Acesso *
            </Text>
            <View style={{ gap: 8 }}>
              {ROLES.map((r) => {
                const selected = role === r;
                const roleColor = ROLE_COLORS[r];
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRole(r)}
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
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: selected ? roleColor : colors.border,
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                          backgroundColor: selected ? roleColor : "transparent",
                        }}
                      >
                        {selected && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "white" }} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: selected ? roleColor : colors.foreground,
                          }}
                        >
                          {ROLE_LABELS[r]}
                        </Text>
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
                trackColor={{ false: colors.border, true: `${ROLE_COLORS[role]}80` }}
                thumbColor={active ? ROLE_COLORS[role] : colors.muted}
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

function CostCenterModal({
  visible,
  onClose,
  onSave,
  item,
  isSaving,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  item?: any | null;
  isSaving?: boolean;
}) {
  const colors = useColors();
  const isEditing = !!item?.id;
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [responsible, setResponsible] = useState(item?.responsible ?? "");

  React.useEffect(() => {
    setCode(item?.code ?? "");
    setName(item?.name ?? "");
    setResponsible(item?.responsible ?? "");
  }, [item]);

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
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Código *
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Ex: CC-001"
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
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  item?: any | null;
  isSaving?: boolean;
}) {
  const colors = useColors();
  const isEditing = !!item?.id;
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [location, setLocation] = useState(item?.location ?? "");

  React.useEffect(() => {
    setCode(item?.code ?? "");
    setDescription(item?.description ?? "");
    setCategory(item?.category ?? "");
    setLocation(item?.location ?? "");
  }, [item]);

  const handleSave = () => {
    if (!code.trim() || !description.trim()) {
      Alert.alert("Campos obrigatórios", "Código e descrição são obrigatórios.");
      return;
    }
    onSave({
      code: code.trim(),
      description: description.trim(),
      category: category.trim() || undefined,
      location: location.trim() || undefined,
    });
    if (!isEditing) {
      setCode("");
      setDescription("");
      setCategory("");
      setLocation("");
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
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>
              Código *
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Ex: BEM-001"
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
              returnKeyType="done"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Business Unit Form Modal ───────────────────────────────────────────────
function BusinessUnitFormModal({
  visible, unit, onClose, onSave, isSaving,
}: {
  visible: boolean;
  unit: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
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
    setCode(unit?.code ?? "");
    setType(unit?.type ?? "escritorio");
    setAddress(unit?.address ?? "");
    setCity(unit?.city ?? "");
    setState(unit?.state ?? "");
    setResponsibleName(unit?.responsibleName ?? "");
    setResponsiblePhone(unit?.responsiblePhone ?? "");
  }, [unit]);

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
          <View><Text style={labelStyle}>Código *</Text><TextInput value={code} onChangeText={setCode} placeholder="Ex: ESC01, FILIAL-MT" placeholderTextColor={colors.muted} autoCapitalize="characters" style={inputStyle} returnKeyType="next" /></View>
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
  visible, unit, onClose, onSave, isSaving,
}: {
  visible: boolean;
  unit: any | null;
  onClose: () => void;
  onSave: (data: { name: string; code: string; address?: string; city?: string; state?: string; responsibleName?: string; responsiblePhone?: string }) => void;
  isSaving: boolean;
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
    setCode(unit?.code ?? "");
    setAddress(unit?.address ?? "");
    setCity(unit?.city ?? "");
    setState(unit?.state ?? "");
    setResponsibleName(unit?.responsibleName ?? "");
    setResponsiblePhone(unit?.responsiblePhone ?? "");
  }, [unit]);

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
          <View><Text style={labelStyle}>Código *</Text><TextInput value={code} onChangeText={setCode} placeholder="Ex: FSJ, MATRIZ, FILIAL01" placeholderTextColor={colors.muted} autoCapitalize="characters" style={inputStyle} returnKeyType="next" /></View>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RegistersScreen() {
  const { isAuthenticated, user } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [showCCModal, setShowCCModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showBUModal, setShowBUModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [editingBU, setEditingBU] = useState<any>(null);
  const [editingCC, setEditingCC] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Filters for users tab
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProcurementRole | "all">("all");

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const isAdmin = userRole === "admin";
  const isMaster = (user as any)?.approvalLevel === "master";

  const { data: usersList, isLoading: usersLoading } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: costCentersList, isLoading: ccLoading } = trpc.costCenters.list.useQuery(undefined, {
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

  const updateAsset = trpc.assets.update.useMutation({
    onSuccess: () => {
      utils.assets.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAssetModal(false);
      setEditingAsset(null);
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

  const TABS: Array<{ key: Tab; label: string; icon: string; count?: number }> = [
    { key: "users", label: "Usuários", icon: "👥", count: usersList?.length },
    { key: "costcenters", label: "Centros de Custo", icon: "🏢", count: costCentersList?.length },
    { key: "assets", label: "Bens", icon: "📦", count: assetsList?.length },
    { key: "units", label: "Fazendas", icon: "🌾", count: unitsList?.length },
    { key: "businessunits", label: "Unidades", icon: "🏗️", count: businessUnitsList?.length },
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
        {!isAdmin && !isMaster && (
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Apenas administradores podem criar ou editar registros
          </Text>
        )}
        {isMaster && (
          <Text style={{ fontSize: 12, color: "#7C3AED", marginTop: 2 }}>
            Acesso master — gerencie usuários, cargos e níveis de aprovação
          </Text>
        )}
      </View>

      {/* Tab Selector */}
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
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  marginTop: 2,
                  color: activeTab === tab.key ? colors.primary : colors.muted,
                }}
              >
                {tab.label}
              </Text>
              {tab.count !== undefined && (
                <View
                  style={{
                    backgroundColor: activeTab === tab.key ? colors.primary : colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: activeTab === tab.key ? "white" : colors.muted,
                    }}
                  >
                    {tab.count}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {/* ── Users Tab ── */}
      {activeTab === "users" && (
        <View style={{ flex: 1 }}>
          {/* List with header containing search/filters/buttons */}
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
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
                {usersList && usersList.length > 0 && (
                  <View style={{ paddingBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Painel de Aprovadores
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { key: "master", label: "Master", icon: "⭐", color: "#7C3AED" },
                          { key: "gerente", label: "Gerente", icon: "🏢", color: "#0EA5E9" },
                          { key: "orcamento", label: "Orçamento", icon: "📋", color: "#8B5CF6" },
                          { key: "controladoria", label: "Controladoria", icon: "📊", color: "#F59E0B" },
                          { key: "diretoria", label: "Diretoria", icon: "🏆", color: "#EF4444" },
                          { key: "financeiro", label: "Financeiro", icon: "💰", color: "#10B981" },
                        ].map((lvl) => {
                          const responsible = usersList.filter(
                            (u) => (u as any).approvalLevel === lvl.key && (u as any).active !== false
                          );
                          const isEmpty = responsible.length === 0;
                          return (
                            <View
                              key={lvl.key}
                              style={{
                                backgroundColor: isEmpty ? `${colors.error}10` : `${lvl.color}12`,
                                borderWidth: 1,
                                borderColor: isEmpty ? `${colors.error}40` : `${lvl.color}30`,
                                borderRadius: 12,
                                padding: 10,
                                minWidth: 120,
                                maxWidth: 160,
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                <Text style={{ fontSize: 14 }}>{lvl.icon}</Text>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: isEmpty ? colors.error : lvl.color }}>
                                  {lvl.label}
                                </Text>
                              </View>
                              {isEmpty ? (
                                <Text style={{ fontSize: 10, color: colors.error, fontWeight: "600" }}>
                                  ⚠️ Sem responsável
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
                )}

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
                      {(item as any).approvalLevel && (item as any).approvalLevel !== "nenhum" && (item as any).approvalLevel !== "master" && (
                        <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "600" }}>
                          ✓ Aprova: {APPROVAL_LEVELS.find(l => l.key === (item as any).approvalLevel)?.label ?? (item as any).approvalLevel}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Right side: role badge + edit + toggle */}
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={{ backgroundColor: `${roleColor}15`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${roleColor}30` }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: roleColor }}>
                        {ROLE_LABELS[(item as any).procurementRole as ProcurementRole] ?? "—"}
                      </Text>
                    </View>
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
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => setShowCCModal(true)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                  + Novo Centro de Custo
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={costCentersList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
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
          {isAdmin && (
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => setShowAssetModal(true)}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                  + Novo Bem
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={assetsList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              assetsLoading ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
              ) : (
                <View style={{ alignItems: "center", marginTop: 60 }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>
                    Nenhum bem cadastrado
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
                  {item.category && (
                    <Text style={{ fontSize: 11, color: colors.muted }}>{item.category}</Text>
                  )}
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                  {item.description}
                </Text>
                {item.location && (
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                    📍 {item.location}
                  </Text>
                )}
                {isAdmin && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => { setEditingAsset(item); setShowAssetModal(true); }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flex: 1, backgroundColor: `${colors.primary}15`, borderRadius: 8, paddingVertical: 6, alignItems: "center", borderWidth: 1, borderColor: `${colors.primary}30` })}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>✏️ Editar</Text>
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
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => { setEditingUnit(null); setShowUnitModal(true); }}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Nova Fazenda</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={unitsList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
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
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => { setEditingBU(null); setShowBUModal(true); }}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Nova Unidade</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={businessUnitsList ?? []}
            keyExtractor={(item) => String((item as any).id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
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
      />
    </ScreenContainer>
  );
}
