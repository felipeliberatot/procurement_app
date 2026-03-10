/**
 * Tela de Edição pela Controladoria
 *
 * Permite que usuários com role "controladoria" editem os dados de uma solicitação
 * que está na etapa "aguardando_controladoria" SEM reiniciar o fluxo de aprovação.
 * O status permanece "aguardando_controladoria" após a edição.
 */

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function EditByControladoriaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const utils = trpc.useUtils();

  const { data: request, isLoading: isLoadingRequest } = trpc.requests.getById.useQuery(
    { id: requestId },
    { enabled: !!requestId }
  );

  const { data: costCenters } = trpc.costCenters.list.useQuery();
  const { data: departments } = trpc.departments.list.useQuery();
  const { data: assets } = trpc.assets.list.useQuery();

  const [initialized, setInitialized] = useState(false);
  const [department, setDepartment] = useState("");
  const [costCenterCode, setCostCenterCode] = useState("");
  const [application, setApplication] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [observations, setObservations] = useState("");
  const [osMyfarm, setOsMyfarm] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");

  // Pré-preencher formulário com dados da solicitação
  useEffect(() => {
    if (request && !initialized) {
      setDepartment(request.department ?? "");
      setCostCenterCode(request.costCenterCode ?? "");
      setApplication(request.application ?? "");
      setUrgency((request.urgencyLevel as UrgencyLevel) ?? "normal");
      setObservations(request.observations ?? "");
      setOsMyfarm(request.osMyfarm ?? "");
      if (request.items && request.items.length > 0) {
        setItems(request.items.map((item: any) => ({
          id: String(item.id ?? Date.now() + Math.random()),
          description: item.description ?? "",
          quantity: item.quantity ?? "1",
          unit: item.unit ?? "un",
          unitPrice: item.unitPrice ?? "",
        })));
      }
      setInitialized(true);
    }
  }, [request, initialized]);

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

  // Encontrar o costCenterId pelo código
  const selectedCostCenter = (costCenters ?? []).find((cc) => cc.code === costCenterCode);

  const updateMutation = trpc.requests.updateByControladoria.useMutation({
    onSuccess: () => {
      utils.requests.getById.invalidate({ id: requestId });
      utils.requests.all.invalidate();
      utils.requests.myRequests.invalidate();
      utils.requests.pendingForMe.invalidate();
      utils.requests.dashboardStats.invalidate();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "✅ Solicitação Atualizada!",
          "Os dados foram editados. O fluxo de aprovação continua na etapa da Controladoria.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        router.back();
        setTimeout(() => Alert.alert("✅ Solicitação Atualizada!", "Os dados foram editados. O fluxo continua na etapa da Controladoria."), 400);
      }
    },
    onError: (error) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Erro ao editar", error.message || "Não foi possível editar a solicitação.");
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
    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) { Alert.alert("Campo obrigatório", "Adicione ao menos um item com descrição."); return; }

    Alert.alert(
      "Confirmar Edição",
      "Os dados serão atualizados. O fluxo de aprovação NÃO será reiniciado — a solicitação permanecerá na etapa da Controladoria. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salvar",
          onPress: () => {
            updateMutation.mutate({
              requestId,
              department: department.trim(),
              costCenterId: selectedCostCenter?.id,
              costCenterCode: costCenterCode || undefined,
              application: application.trim(),
              urgencyLevel: urgency,
              observations: observations.trim() || undefined,
              osMyfarm: osMyfarm.trim() || undefined,
              items: validItems.map((i) => ({
                description: i.description.trim(),
                quantity: i.quantity || "1",
                unit: i.unit || "un",
                unitPrice: i.unitPrice.replace(",", ".") || undefined,
              })),
            });
          },
        },
      ]
    );
  };

  if (isLoadingRequest) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-3 text-sm">Carregando solicitação...</Text>
      </ScreenContainer>
    );
  }

  if (!request) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-2xl mb-2">❌</Text>
        <Text className="text-foreground font-semibold text-base mb-1">Solicitação não encontrada</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary text-sm">← Voltar</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (request.status !== "aguardando_controladoria") {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-4xl mb-3">🔒</Text>
        <Text className="text-foreground font-bold text-lg mb-2 text-center">Edição não disponível</Text>
        <Text className="text-muted text-sm text-center mb-4">
          Esta edição só está disponível quando a solicitação está na etapa da Controladoria.
        </Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-2">
          <Text className="text-primary text-sm">← Voltar</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-border">
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <Text className="text-primary text-base">← Voltar</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">Editar (Controladoria)</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Aviso: sem reinício de aprovação */}
        <View className="mx-4 mt-3 mb-1 bg-success/10 border border-success/30 rounded-xl px-4 py-3 flex-row items-start gap-3">
          <Text className="text-lg">✅</Text>
          <View className="flex-1">
            <Text className="text-xs font-bold text-success mb-0.5">Edição sem reinício de aprovação</Text>
            <Text className="text-xs text-muted">O fluxo permanecerá na etapa da Controladoria após salvar as alterações.</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 24, 40) }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Número da solicitação (readonly) */}
          <View className="mb-4 bg-surface border border-border rounded-xl p-3">
            <Text className="text-xs text-muted mb-1">Solicitação</Text>
            <Text className="text-sm font-bold text-primary">{request.requestNumber}</Text>
          </View>

          {/* Urgência */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-foreground mb-2">Urgência *</Text>
            <View className="flex-row gap-2">
              {URGENCY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setUrgency(opt.value)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flex: 1 })}
                  className={`border-2 rounded-xl p-3 items-center ${urgency === opt.value ? opt.color : "border-border bg-surface"}`}
                >
                  <Text className="text-lg mb-1">{opt.icon}</Text>
                  <Text className={`text-xs font-bold ${urgency === opt.value ? "text-foreground" : "text-muted"}`}>{opt.label}</Text>
                  <Text className={`text-xs ${urgency === opt.value ? "text-muted" : "text-muted/60"}`}>{opt.days}d</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Departamento */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Departamento *</Text>
            <Pressable
              onPress={() => setShowDeptPicker(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className={department ? "text-foreground text-sm" : "text-muted text-sm"}>
                {department || "Selecionar departamento..."}
              </Text>
              <Text className="text-muted text-xs">▼</Text>
            </Pressable>
          </View>

          {/* Centro de Custo */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Centro de Custo</Text>
            <View className="bg-surface border border-border rounded-xl px-4 py-3 flex-row flex-wrap gap-2">
              {(costCenters ?? []).length === 0 ? (
                <Text className="text-muted text-sm">Nenhum centro de custo cadastrado</Text>
              ) : (
                (costCenters ?? []).map((cc) => (
                  <Pressable
                    key={cc.id}
                    onPress={() => setCostCenterCode(costCenterCode === cc.code ? "" : cc.code)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    className={`px-3 py-1.5 rounded-full border ${costCenterCode === cc.code ? "bg-primary border-primary" : "bg-surface border-border"}`}
                  >
                    <Text className={`text-xs font-semibold ${costCenterCode === cc.code ? "text-white" : "text-foreground"}`}>
                      {cc.code} — {cc.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>

          {/* Aplicação / Finalidade */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Aplicação / Finalidade *</Text>
              <Pressable
                onPress={() => setShowAssetPicker(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1"
              >
                <Text className="text-primary text-xs font-semibold">📦 Selecionar Bem</Text>
              </Pressable>
            </View>
            <TextInput
              value={application}
              onChangeText={setApplication}
              placeholder="Ex: Manutenção do trator John Deere 7215R"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* OS Myfarm */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">OS Myfarm</Text>
            <TextInput
              value={osMyfarm}
              onChangeText={setOsMyfarm}
              placeholder="Número da OS no Myfarm (opcional)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
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
            />
          </View>

          {/* Observações */}
          <View className="mb-5">
            <Text className="text-sm font-semibold text-foreground mb-2">Observações</Text>
            <TextInput
              value={observations}
              onChangeText={setObservations}
              placeholder="Informações adicionais (opcional)"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: colors.foreground,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>

          {/* Itens */}
          <View className="mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-foreground">Itens *</Text>
              <Pressable
                onPress={addItem}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5"
              >
                <Text className="text-primary text-xs font-semibold">+ Adicionar Item</Text>
              </Pressable>
            </View>

            {items.map((item, index) => (
              <View key={item.id} className="bg-surface border border-border rounded-xl p-4 mb-3">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xs font-bold text-muted">ITEM {index + 1}</Text>
                  {items.length > 1 && (
                    <Pressable
                      onPress={() => removeItem(item.id)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text className="text-error text-xs font-semibold">✕ Remover</Text>
                    </Pressable>
                  )}
                </View>

                {/* Descrição */}
                <Text className="text-xs text-muted mb-1">Descrição *</Text>
                <TextInput
                  value={item.description}
                  onChangeText={(v) => updateItem(item.id, "description", v)}
                  placeholder="Ex: Filtro de óleo hidráulico"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: colors.foreground,
                    marginBottom: 10,
                  }}
                />

                {/* Quantidade, Unidade e Preço */}
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-1">Qtd *</Text>
                    <TextInput
                      value={item.quantity}
                      onChangeText={(v) => updateItem(item.id, "quantity", v)}
                      placeholder="1"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: colors.foreground,
                      }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-1">Unidade</Text>
                    <TextInput
                      value={item.unit}
                      onChangeText={(v) => updateItem(item.id, "unit", v)}
                      placeholder="un"
                      placeholderTextColor={colors.muted}
                      style={{
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: colors.foreground,
                      }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-1">Preço Unit.</Text>
                    <TextInput
                      value={item.unitPrice}
                      onChangeText={(v) => updateItem(item.id, "unitPrice", v)}
                      placeholder="0,00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: colors.background,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: colors.foreground,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}

            {/* Total estimado */}
            {totalValue > 0 && (
              <View className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">Total Estimado</Text>
                <Text className="text-base font-bold text-primary">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </Text>
              </View>
            )}
          </View>

          {/* Botão Salvar */}
          <Pressable
            onPress={handleSubmit}
            disabled={updateMutation.isPending}
            style={({ pressed }) => ({
              opacity: pressed || updateMutation.isPending ? 0.7 : 1,
              transform: pressed ? [{ scale: 0.98 }] : [],
              backgroundColor: colors.success,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              marginTop: 8,
            })}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                ✅ Salvar Alterações
              </Text>
            )}
          </Pressable>
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
