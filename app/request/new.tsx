import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type UrgencyLevel = "normal" | "urgente" | "emergencial";

interface Item {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const URGENCY_OPTIONS: Array<{ value: UrgencyLevel; label: string; icon: string; days: number; color: string }> = [
  { value: "normal",      label: "Normal",      icon: "🔵", days: 7, color: "border-primary bg-primary/10" },
  { value: "urgente",     label: "Urgente",     icon: "🟡", days: 3, color: "border-warning bg-warning/10" },
  { value: "emergencial", label: "Emergencial", icon: "🔴", days: 1, color: "border-error bg-error/10" },
];

function newItem(): Item {
  return { id: String(Date.now()), description: "", quantity: "1", unit: "un", unitPrice: "" };
}

export default function NewRequestScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [department, setDepartment] = useState("");
  const [costCenterCode, setCostCenterCode] = useState("");
  const [application, setApplication] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [observations, setObservations] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);

  const { data: costCenters } = trpc.costCenters.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: departments } = trpc.departments.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: assets } = trpc.assets.list.useQuery(undefined, { enabled: isAuthenticated });

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");

  const filteredAssets = (assets ?? []).filter((a) =>
    !assetSearch ||
    a.description.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(assetSearch.toLowerCase())
  );
  const filteredDepts = (departments ?? []).filter((d) =>
    !deptSearch ||
    d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
    d.code.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const createMutation = trpc.requests.create.useMutation({
    onSuccess: () => {
      utils.requests.all.invalidate();
      utils.requests.myRequests.invalidate();
      utils.requests.dashboardStats.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "✅ Solicitação Criada!",
        "Sua solicitação foi enviada para aprovação do Gerente de Unidade.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erro", error.message || "Não foi possível criar a solicitação.");
    },
  });

  const totalValue = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice.replace(",", ".")) || 0;
    return sum + qty * price;
  }, 0);

  const addItem = () => setItems((prev) => [...prev, newItem()]);

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof Item, value: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSubmit = () => {
    if (!department.trim()) { Alert.alert("Campo obrigatório", "Informe o departamento."); return; }
    if (!application.trim()) { Alert.alert("Campo obrigatório", "Informe a aplicação/finalidade."); return; }
    // Observação obrigatória para urgentes e emergenciais
    if ((urgency === "urgente" || urgency === "emergencial") && !observations.trim()) {
      Alert.alert(
        "Campo obrigatório",
        `Para solicitações ${urgency === "emergencial" ? "emergenciais" : "urgentes"}, é obrigatório descrever o motivo no campo Observações.`
      );
      return;
    }
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) { Alert.alert("Campo obrigatório", "Adicione ao menos um item com descrição."); return; }

    createMutation.mutate({
      department: department.trim(),
      costCenterCode: costCenterCode || undefined,
      application: application.trim(),
      urgencyLevel: urgency,
      observations: observations.trim() || undefined,
      items: validItems.map((i) => ({
        description: i.description.trim(),
        quantity: i.quantity || "1",
        unit: i.unit || "un",
        unitPrice: i.unitPrice.replace(",", ".") || undefined,
      })),
    });
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-border">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text className="text-primary text-base">← Voltar</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">Nova Solicitação</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 24, 40) }} keyboardShouldPersistTaps="handled">

          {/* Solicitante (readonly) */}
          <View className="mb-4 bg-surface border border-border rounded-xl p-3">
            <Text className="text-xs text-muted mb-1">Solicitante</Text>
            <Text className="text-sm font-semibold text-foreground">{user?.name ?? "—"}</Text>
            <Text className="text-xs text-muted">{user?.email ?? "—"}</Text>
          </View>

          {/* Departamento */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-1">Departamento <Text className="text-error">*</Text></Text>
            <Pressable
              onPress={() => setShowDeptPicker(true)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: department ? colors.primary : colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              })}
            >
              <Text style={{ fontSize: 14, color: department ? colors.foreground : colors.muted, flex: 1 }}>
                {department || "Selecione o departamento..."}
              </Text>
              <Text style={{ fontSize: 16, color: colors.muted }}>▾</Text>
            </Pressable>
          </View>

          {/* Centro de Custo */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Centro de Custo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <Pressable onPress={() => setCostCenterCode("")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                  <View className={`px-3 py-2 rounded-xl border ${!costCenterCode ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                    <Text className={`text-xs font-medium ${!costCenterCode ? "text-white" : "text-muted"}`}>Nenhum</Text>
                  </View>
                </Pressable>
                {(costCenters ?? []).map((cc) => (
                  <Pressable key={cc.id} onPress={() => setCostCenterCode(cc.code)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                    <View className={`px-3 py-2 rounded-xl border ${costCenterCode === cc.code ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                      <Text className={`text-xs font-medium ${costCenterCode === cc.code ? "text-white" : "text-muted"}`}>{cc.code} — {cc.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Aplicação / Bem */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-1">Aplicação / Finalidade <Text className="text-error">*</Text></Text>
            {/* Botão para selecionar bem cadastrado */}
            <Pressable
              onPress={() => setShowAssetPicker(true)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              })}
            >
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: "600" }}>📦 Selecionar bem cadastrado</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>▾</Text>
            </Pressable>
            <TextInput
              value={application}
              onChangeText={setApplication}
              placeholder="Para qual projeto ou finalidade?"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              multiline
              numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
          </View>

          {/* Nível de Atendimento */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Nível de Atendimento <Text className="text-error">*</Text></Text>
            <View className="gap-2">
              {URGENCY_OPTIONS.map((opt) => (
                <Pressable key={opt.value} onPress={() => setUrgency(opt.value)} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
                  <View className={`flex-row items-center p-3 rounded-xl border-2 ${urgency === opt.value ? opt.color : "border-border bg-surface"}`}>
                    <Text className="text-xl mr-3">{opt.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{opt.label}</Text>
                      <Text className="text-xs text-muted">Prazo de atendimento: {opt.days} dia{opt.days > 1 ? "s" : ""}</Text>
                    </View>
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${urgency === opt.value ? "border-primary bg-primary" : "border-border"}`}>
                      {urgency === opt.value && <View className="w-2 h-2 rounded-full bg-white" />}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Itens */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Itens <Text className="text-error">*</Text></Text>
              <TouchableOpacity onPress={addItem} className="flex-row items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full">
                <Text className="text-primary text-xs font-semibold">+ Adicionar Item</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={item.id} className="bg-surface border border-border rounded-xl p-3 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold text-muted">Item {index + 1}</Text>
                  {items.length > 1 && (
                    <Pressable onPress={() => removeItem(item.id)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                      <Text className="text-error text-xs">Remover</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  value={item.description}
                  onChangeText={(v) => updateItem(item.id, "description", v)}
                  placeholder="Descrição do item *"
                  placeholderTextColor={colors.muted}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mb-2"
                  returnKeyType="next"
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <TextInput
                      value={item.quantity}
                      onChangeText={(v) => updateItem(item.id, "quantity", v)}
                      placeholder="Qtd"
                      placeholderTextColor={colors.muted}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={{ width: 60 }}>
                    <TextInput
                      value={item.unit}
                      onChangeText={(v) => updateItem(item.id, "unit", v)}
                      placeholder="Un"
                      placeholderTextColor={colors.muted}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      returnKeyType="next"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={item.unitPrice}
                      onChangeText={(v) => updateItem(item.id, "unitPrice", v)}
                      placeholder="Valor unit."
                      placeholderTextColor={colors.muted}
                      className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>
            ))}

            {/* Total */}
            {totalValue > 0 && (
              <View className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-primary">Valor Total Estimado</Text>
                <Text className="text-base font-bold text-primary">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </Text>
              </View>
            )}
          </View>

          {/* Observações */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1 mb-1">
              <Text className="text-sm font-semibold text-foreground">Observações</Text>
              {(urgency === "urgente" || urgency === "emergencial") && (
                <Text className="text-error text-sm font-bold"> * obrigatório</Text>
              )}
            </View>
            {(urgency === "urgente" || urgency === "emergencial") && (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-2 mb-2 flex-row items-center gap-2">
                <Text className="text-base">⚠️</Text>
                <Text className="text-xs text-warning flex-1">
                  Descreva o motivo da urgência. Esta solicitação será encaminhada diretamente à Diretoria.
                </Text>
              </View>
            )}
            <TextInput
              value={observations}
              onChangeText={setObservations}
              placeholder={(urgency === "urgente" || urgency === "emergencial") ? "Descreva o motivo da urgência..." : "Informações adicionais, especificações técnicas..."}
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top", borderColor: (urgency === "urgente" || urgency === "emergencial") && !observations.trim() ? colors.warning : undefined }}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={createMutation.isPending}
            className="bg-primary rounded-2xl py-4 items-center"
            style={{ opacity: createMutation.isPending ? 0.7 : 1 }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Enviar Solicitação</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: Selecionar Departamento */}
      {showDeptPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>🏛️ Selecionar Departamento</Text>
              <Pressable onPress={() => { setShowDeptPicker(false); setDeptSearch(""); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <TextInput
                value={deptSearch}
                onChangeText={setDeptSearch}
                placeholder="Buscar departamento..."
                placeholderTextColor={colors.muted}
                autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
              />
            </View>
            <FlatList
              data={filteredDepts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🏛️</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum departamento encontrado</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setDepartment(item.name); setShowDeptPicker(false); setDeptSearch(""); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: department === item.name ? `${colors.primary}15` : colors.surface,
                    borderWidth: 1,
                    borderColor: department === item.name ? colors.primary : colors.border,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.name}</Text>
                    {item.responsible && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>👤 {item.responsible}</Text>}
                  </View>
                  <View style={{ backgroundColor: `${colors.primary}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{item.code}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}

      {/* Modal: Selecionar Bem */}
      {showAssetPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>📦 Selecionar Bem</Text>
              <Pressable onPress={() => { setShowAssetPicker(false); setAssetSearch(""); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <TextInput
                value={assetSearch}
                onChangeText={setAssetSearch}
                placeholder="Buscar bem por código ou descrição..."
                placeholderTextColor={colors.muted}
                autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
              />
            </View>
            <FlatList
              data={filteredAssets}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum bem encontrado</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Cadastre bens em Cadastros → Bens</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setApplication(`${item.code} — ${item.description}`);
                    setShowAssetPicker(false);
                    setAssetSearch("");
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
                    {item.location && <Text style={{ fontSize: 12, color: colors.muted }}>📍 {item.location}</Text>}
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
