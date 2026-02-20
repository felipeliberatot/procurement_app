import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

type Tab = "users" | "costcenters" | "assets";

// ─── Cost Center Modal ────────────────────────────────────────────────────────

function CostCenterModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (data: any) => void }) {
  const colors = useColors();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [responsible, setResponsible] = useState("");

  const handleSave = () => {
    if (!code.trim() || !name.trim()) { Alert.alert("Campos obrigatórios", "Código e nome são obrigatórios."); return; }
    onSave({ code: code.trim(), name: name.trim(), responsible: responsible.trim() || undefined });
    setCode(""); setName(""); setResponsible("");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <TouchableOpacity onPress={onClose}><Text className="text-primary">Cancelar</Text></TouchableOpacity>
          <Text className="text-base font-bold text-foreground">Novo Centro de Custo</Text>
          <TouchableOpacity onPress={handleSave}><Text className="text-primary font-bold">Salvar</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Código *</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: CC-001" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="next" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Nome *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex: Departamento de TI" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="next" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Responsável</Text>
            <TextInput value={responsible} onChangeText={setResponsible} placeholder="Nome do responsável" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="done" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Asset Modal ──────────────────────────────────────────────────────────────

function AssetModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (data: any) => void }) {
  const colors = useColors();
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const handleSave = () => {
    if (!code.trim() || !description.trim()) { Alert.alert("Campos obrigatórios", "Código e descrição são obrigatórios."); return; }
    onSave({ code: code.trim(), description: description.trim(), category: category.trim() || undefined, location: location.trim() || undefined });
    setCode(""); setDescription(""); setCategory(""); setLocation("");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <TouchableOpacity onPress={onClose}><Text className="text-primary">Cancelar</Text></TouchableOpacity>
          <Text className="text-base font-bold text-foreground">Novo Bem</Text>
          <TouchableOpacity onPress={handleSave}><Text className="text-primary font-bold">Salvar</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Código *</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="Ex: BEM-001" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="next" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Descrição *</Text>
            <TextInput value={description} onChangeText={setDescription} placeholder="Ex: Notebook Dell Inspiron" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="next" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Categoria</Text>
            <TextInput value={category} onChangeText={setCategory} placeholder="Ex: Equipamento de TI" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="next" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground mb-1">Localização</Text>
            <TextInput value={location} onChangeText={setLocation} placeholder="Ex: Sala 101" placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" returnKeyType="done" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── User Role Modal ──────────────────────────────────────────────────────────

function UserRoleModal({ visible, user, onClose, onSave }: { visible: boolean; user: any; onClose: () => void; onSave: (data: any) => void }) {
  const [role, setRole] = useState<ProcurementRole>(user?.procurementRole ?? "solicitante");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const colors = useColors();

  const roles: ProcurementRole[] = ["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin"];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <TouchableOpacity onPress={onClose}><Text className="text-primary">Cancelar</Text></TouchableOpacity>
          <Text className="text-base font-bold text-foreground">Editar Usuário</Text>
          <TouchableOpacity onPress={() => onSave({ id: user?.id, procurementRole: role, phone: phone.trim() || undefined })}>
            <Text className="text-primary font-bold">Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-base font-bold text-foreground">{user?.name}</Text>
            <Text className="text-sm text-muted">{user?.email}</Text>
          </View>
          <Text className="text-sm font-semibold text-foreground mb-2">Perfil de Acesso</Text>
          <View className="gap-2 mb-4">
            {roles.map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className={`flex-row items-center p-3 rounded-xl border ${role === r ? "border-primary bg-primary/10" : "border-border bg-surface"}`}>
                  <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${role === r ? "border-primary bg-primary" : "border-border"}`}>
                    {role === r && <View className="w-2 h-2 rounded-full bg-white" />}
                  </View>
                  <Text className={`text-sm font-medium ${role === r ? "text-primary" : "text-foreground"}`}>{ROLE_LABELS[r]}</Text>
                </View>
              </Pressable>
            ))}
          </View>
          <Text className="text-sm font-semibold text-foreground mb-1">WhatsApp</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="+55 11 99999-9999" placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground" keyboardType="phone-pad" returnKeyType="done" />
          <Text className="text-xs text-muted mt-1">Número usado para notificações via WhatsApp</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RegistersScreen() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [showCCModal, setShowCCModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const isAdmin = userRole === "admin";

  const { data: usersList, isLoading: usersLoading } = trpc.users.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: costCentersList, isLoading: ccLoading } = trpc.costCenters.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: assetsList, isLoading: assetsLoading } = trpc.assets.list.useQuery(undefined, { enabled: isAuthenticated });

  const createCC = trpc.costCenters.create.useMutation({
    onSuccess: () => { utils.costCenters.list.invalidate(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setShowCCModal(false); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const createAsset = trpc.assets.create.useMutation({
    onSuccess: () => { utils.assets.list.invalidate(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setShowAssetModal(false); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const updateUser = trpc.users.upsertByAdmin.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setEditingUser(null); },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const TABS: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "users", label: "Usuários", icon: "👥" },
    { key: "costcenters", label: "Centros de Custo", icon: "🏢" },
    { key: "assets", label: "Bens", icon: "📦" },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-3 border-b border-border">
        <Text className="text-2xl font-bold text-foreground">Cadastros</Text>
        {!isAdmin && <Text className="text-xs text-muted mt-0.5">Apenas administradores podem editar</Text>}
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-border">
        {TABS.map((tab) => (
          <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flex: 1 }]}>
            <View className={`items-center py-3 border-b-2 ${activeTab === tab.key ? "border-primary" : "border-transparent"}`}>
              <Text className="text-base">{tab.icon}</Text>
              <Text className={`text-xs font-semibold mt-0.5 ${activeTab === tab.key ? "text-primary" : "text-muted"}`}>{tab.label}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Users Tab */}
      {activeTab === "users" && (
        <FlatList
          data={usersList ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          ListEmptyComponent={usersLoading ? <ActivityIndicator className="mt-8" /> : <Text className="text-center text-muted mt-8">Nenhum usuário encontrado</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => isAdmin && setEditingUser(item)} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
              <View className="bg-surface border border-border rounded-2xl p-4 mb-3 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <Text className="text-base font-bold text-primary">{(item.name ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.name ?? "—"}</Text>
                  <Text className="text-xs text-muted">{item.email}</Text>
                  {item.phone && <Text className="text-xs text-muted">📱 {item.phone}</Text>}
                </View>
                <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                  <Text className="text-xs text-primary font-semibold">{ROLE_LABELS[(item as any).procurementRole as ProcurementRole] ?? "—"}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Cost Centers Tab */}
      {activeTab === "costcenters" && (
        <>
          {isAdmin && (
            <View className="px-4 pt-3">
              <TouchableOpacity onPress={() => setShowCCModal(true)} className="bg-primary rounded-xl py-3 items-center mb-3">
                <Text className="text-white font-bold text-sm">+ Novo Centro de Custo</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={costCentersList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
            ListEmptyComponent={ccLoading ? <ActivityIndicator className="mt-8" /> : <Text className="text-center text-muted mt-8">Nenhum centro de custo cadastrado</Text>}
            renderItem={({ item }) => (
              <View className="bg-surface border border-border rounded-2xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-mono text-primary font-bold">{item.code}</Text>
                  <View className={`px-2 py-0.5 rounded-full ${item.active ? "bg-success/10" : "bg-muted/10"}`}>
                    <Text className={`text-xs font-semibold ${item.active ? "text-success" : "text-muted"}`}>{item.active ? "Ativo" : "Inativo"}</Text>
                  </View>
                </View>
                <Text className="text-sm font-semibold text-foreground">{item.name}</Text>
                {item.responsible && <Text className="text-xs text-muted mt-0.5">Responsável: {item.responsible}</Text>}
              </View>
            )}
          />
        </>
      )}

      {/* Assets Tab */}
      {activeTab === "assets" && (
        <>
          {isAdmin && (
            <View className="px-4 pt-3">
              <TouchableOpacity onPress={() => setShowAssetModal(true)} className="bg-primary rounded-xl py-3 items-center mb-3">
                <Text className="text-white font-bold text-sm">+ Novo Bem</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={assetsList ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
            ListEmptyComponent={assetsLoading ? <ActivityIndicator className="mt-8" /> : <Text className="text-center text-muted mt-8">Nenhum bem cadastrado</Text>}
            renderItem={({ item }) => (
              <View className="bg-surface border border-border rounded-2xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-mono text-primary font-bold">{item.code}</Text>
                  {item.category && <Text className="text-xs text-muted">{item.category}</Text>}
                </View>
                <Text className="text-sm font-semibold text-foreground">{item.description}</Text>
                {item.location && <Text className="text-xs text-muted mt-0.5">📍 {item.location}</Text>}
              </View>
            )}
          />
        </>
      )}

      {/* Modals */}
      <CostCenterModal visible={showCCModal} onClose={() => setShowCCModal(false)} onSave={(data) => createCC.mutate(data)} />
      <AssetModal visible={showAssetModal} onClose={() => setShowAssetModal(false)} onSave={(data) => createAsset.mutate(data)} />
      {editingUser && (
        <UserRoleModal
          visible={!!editingUser}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(data) => updateUser.mutate(data)}
        />
      )}
    </ScreenContainer>
  );
}
