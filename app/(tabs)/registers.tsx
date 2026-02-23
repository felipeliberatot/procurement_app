import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
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

type Tab = "users" | "costcenters" | "assets";

const ROLES: ProcurementRole[] = [
  "solicitante",
  "gerente",
  "controladoria",
  "diretoria",
  "financeiro",
  "admin",
];

type ApprovalLevel = "nenhum" | "gerente" | "controladoria" | "diretoria" | "financeiro";

const APPROVAL_LEVELS: Array<{ key: ApprovalLevel; label: string; description: string; color: string }> = [
  { key: "nenhum", label: "Nenhum", description: "Não participa do fluxo de aprovação", color: "#9CA3AF" },
  { key: "gerente", label: "Gerente de Unidade", description: "Aprova na 1ª etapa do fluxo", color: "#0EA5E9" },
  { key: "controladoria", label: "Controladoria", description: "Aprova na 3ª etapa (plano orçamentário)", color: "#F59E0B" },
  { key: "diretoria", label: "Diretoria", description: "Aprova na 4ª etapa do fluxo", color: "#EF4444" },
  { key: "financeiro", label: "Financeiro", description: "Confirma pagamento na etapa final", color: "#10B981" },
];

const ROLE_COLORS: Record<ProcurementRole, string> = {
  solicitante: "#6366F1",
  gerente: "#0EA5E9",
  controladoria: "#F59E0B",
  diretoria: "#EF4444",
  financeiro: "#10B981",
  admin: "#8B5CF6",
};

// ─── User Form Modal ──────────────────────────────────────────────────────────

function UserFormModal({
  visible,
  user,
  onClose,
  onSave,
  isSaving,
}: {
  visible: boolean;
  user: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
  isSaving: boolean;
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
  }, [user]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Campo obrigatório", "O nome do usuário é obrigatório.");
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
          {/* Nome */}
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
              placeholder="+55 11 99999-9999"
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

          {/* Departamento */}
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
              returnKeyType="next"
            />
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
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              Título do cargo ou função do usuário na empresa
            </Text>
          </View>

          {/* Nível de Aprovação */}
          <View>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 4 }}>
              Nível de Aprovação
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 10 }}>
              Define em qual etapa do fluxo de compras este usuário pode aprovar
            </Text>
            <View style={{ gap: 8 }}>
              {APPROVAL_LEVELS.map((level) => {
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
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const colors = useColors();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [responsible, setResponsible] = useState("");

  const handleSave = () => {
    if (!code.trim() || !name.trim()) {
      Alert.alert("Campos obrigatórios", "Código e nome são obrigatórios.");
      return;
    }
    onSave({ code: code.trim(), name: name.trim(), responsible: responsible.trim() || undefined });
    setCode("");
    setName("");
    setResponsible("");
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
            Novo Centro de Custo
          </Text>
          <TouchableOpacity onPress={handleSave}>
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
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const colors = useColors();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

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
    setCode("");
    setDescription("");
    setCategory("");
    setLocation("");
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
            Novo Bem
          </Text>
          <TouchableOpacity onPress={handleSave}>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RegistersScreen() {
  const { isAuthenticated, user } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [showCCModal, setShowCCModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Filters for users tab
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ProcurementRole | "all">("all");

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const isAdmin = userRole === "admin";

  const { data: usersList, isLoading: usersLoading } = trpc.users.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: costCentersList, isLoading: ccLoading } = trpc.costCenters.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: assetsList, isLoading: assetsLoading } = trpc.assets.list.useQuery(undefined, {
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

  const TABS: Array<{ key: Tab; label: string; icon: string; count?: number }> = [
    { key: "users", label: "Usuários", icon: "👥", count: usersList?.length },
    { key: "costcenters", label: "Centros de Custo", icon: "🏢", count: costCentersList?.length },
    { key: "assets", label: "Bens", icon: "📦", count: assetsList?.length },
  ];

  const handleEditUser = (u: any) => {
    if (!isAdmin) return;
    setEditingUser(u);
    setShowUserModal(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
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
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>
          Cadastros
        </Text>
        {!isAdmin && (
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            Apenas administradores podem criar ou editar registros
          </Text>
        )}
      </View>

      {/* Tab Selector */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border,
        }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flex: 1 })}
          >
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
      </View>

      {/* ── Users Tab ── */}
      {activeTab === "users" && (
        <View style={{ flex: 1 }}>
          {/* Search + Add */}
          <View style={{ padding: 12, gap: 8 }}>
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

            {/* Add user button (admin only) */}
            {isAdmin && (
              <TouchableOpacity
                onPress={handleNewUser}
                style={{
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
            )}
          </View>

          {/* Results count */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""} encontrado{filteredUsers.length !== 1 ? "s" : ""}
            </Text>
          </View>

          {/* List */}
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
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
                <Pressable
                  onPress={() => handleEditUser(item)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
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
                      <Text
                        style={{ fontSize: 18, fontWeight: "800", color: roleColor }}
                      >
                        {(item.name ?? "?")[0].toUpperCase()}
                      </Text>
                    </View>

                    {/* Info */}
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: colors.foreground,
                              flexShrink: 1,
                            }}
                            numberOfLines={1}
                          >
                            {item.name ?? "Sem nome"}
                          </Text>
                          {!isActive && (
                            <View
                              style={{
                                backgroundColor: colors.border,
                                borderRadius: 6,
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                              }}
                            >
                              <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600" }}>
                                INATIVO
                              </Text>
                            </View>
                          )}
                        </View>
                        {/* Cargo */}
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
                            <Text style={{ fontSize: 11, color: colors.muted }}>
                              🏢 {(item as any).department}
                            </Text>
                          )}
                          {(item as any).phone && (
                            <Text style={{ fontSize: 11, color: colors.muted }}>
                              📱 {(item as any).phone}
                            </Text>
                          )}
                          {(item as any).approvalLevel && (item as any).approvalLevel !== "nenhum" && (
                            <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "600" }}>
                              ✓ Aprova: {APPROVAL_LEVELS.find(l => l.key === (item as any).approvalLevel)?.label ?? (item as any).approvalLevel}
                            </Text>
                          )}
                        </View>
                      </View>

                    {/* Role badge + actions */}
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View
                        style={{
                          backgroundColor: `${roleColor}15`,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderWidth: 1,
                          borderColor: `${roleColor}30`,
                        }}
                      >
                        <Text
                          style={{ fontSize: 11, fontWeight: "700", color: roleColor }}
                        >
                          {ROLE_LABELS[(item as any).procurementRole as ProcurementRole] ?? "—"}
                        </Text>
                      </View>
                      {isAdmin && (
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleToggleActive(item);
                          }}
                          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        >
                          <Text style={{ fontSize: 11, color: isActive ? colors.error : colors.success }}>
                            {isActive ? "Desativar" : "Ativar"}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>
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
              </View>
            )}
          />
        </View>
      )}

      {/* Modals */}
      <CostCenterModal
        visible={showCCModal}
        onClose={() => setShowCCModal(false)}
        onSave={(data) => createCC.mutate(data)}
      />
      <AssetModal
        visible={showAssetModal}
        onClose={() => setShowAssetModal(false)}
        onSave={(data) => createAsset.mutate(data)}
      />
      <UserFormModal
        visible={showUserModal}
        user={editingUser}
        onClose={() => { setShowUserModal(false); setEditingUser(null); }}
        onSave={(data) => saveUser.mutate(data)}
        isSaving={saveUser.isPending}
      />
    </ScreenContainer>
  );
}
