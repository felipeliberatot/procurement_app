import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
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

const UNIT_OPTIONS = ["un", "kg", "g", "t", "L", "mL", "m", "m²", "m³", "cx", "pc", "par", "rolo", "saco", "bd", "hr", "sc", "fardo", "galao"];

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
  const [osMyfarm, setOsMyfarm] = useState("");
  const [items, setItems] = useState<Item[]>([newItem()]);
  // Fazenda e Safra (obrigatórios)
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [selectedFarmName, setSelectedFarmName] = useState("");
  const [selectedHarvestId, setSelectedHarvestId] = useState<number | null>(null);
  const [selectedHarvestName, setSelectedHarvestName] = useState("");
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [showHarvestPicker, setShowHarvestPicker] = useState(false);
  // Tipo de Manutenção (obrigatório quando CC = Manutenção – Grupo Operativo)
  const [maintenanceType, setMaintenanceType] = useState<"preventiva" | "corretiva" | null>(null);
  // Tipo de Combustível/Lubrificante (obrigatório quando CC = Combustíveis e Lubrificantes)
  const [fuelType, setFuelType] = useState<"diesel" | "diesel_s10" | "alcool_gasolina_fazenda" | "alcool_gasolina_administrativo" | "lubrificantes" | null>(null);

  const { data: costCenters } = trpc.costCenters.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: departments } = trpc.departments.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: assets } = trpc.assets.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: farms } = trpc.units.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: harvests } = trpc.harvests.list.useQuery(undefined, { enabled: isAuthenticated });

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showCostCenterPicker, setShowCostCenterPicker] = useState(false);
  const [showOsPicker, setShowOsPicker] = useState(false);
  const [unitPickerItemId, setUnitPickerItemId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [costCenterSearch, setCostCenterSearch] = useState("");
  const [osSearch, setOsSearch] = useState("");
  const [selectedOs, setSelectedOs] = useState<{ orderNumber: string; description: string | null; equipment: { name: string; code: string } } | null>(null);

  const { data: workOrders, isLoading: osLoading, refetch: refetchOs } = trpc.maintenance.listWorkOrders.useQuery(
    undefined,
    { enabled: showOsPicker, staleTime: 30_000 }
  );

  const filteredOs = (workOrders ?? []).filter((os) =>
    !osSearch ||
    os.orderNumber.toLowerCase().includes(osSearch.toLowerCase()) ||
    (os.description ?? "").toLowerCase().includes(osSearch.toLowerCase()) ||
    os.equipment.name.toLowerCase().includes(osSearch.toLowerCase()) ||
    os.equipment.code.toLowerCase().includes(osSearch.toLowerCase())
  );

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
  const filteredCostCenters = (costCenters ?? []).filter((cc) =>
    !costCenterSearch ||
    cc.name.toLowerCase().includes(costCenterSearch.toLowerCase()) ||
    cc.code.toLowerCase().includes(costCenterSearch.toLowerCase())
  );

  // Detecta CC especiais pelo código (mais confiável que o nome)
  const MAINTENANCE_CC_CODE = "CC-013"; // Manutenção – Grupo Operativo
  const FUEL_CC_CODE = "OP-001";        // Combustíveis e Lubrificantes
  const [isMaintenanceCC, setIsMaintenanceCC] = useState(false);
  const [isFuelCC, setIsFuelCC] = useState(false);

  // Atualiza os flags quando o CC muda
  useEffect(() => {
    const trimmed = costCenterCode.trim();
    setIsMaintenanceCC(trimmed === MAINTENANCE_CC_CODE);
    setIsFuelCC(trimmed === FUEL_CC_CODE);
    console.log('[NewRequest] costCenterCode:', JSON.stringify(trimmed), 'isFuelCC:', trimmed === FUEL_CC_CODE, 'isMaintenanceCC:', trimmed === MAINTENANCE_CC_CODE);
  }, [costCenterCode]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const createMutation = trpc.requests.create.useMutation({
    onSuccess: () => {
      utils.requests.all.invalidate();
      utils.requests.myRequests.invalidate();
      utils.requests.dashboardStats.invalidate();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Navegar imediatamente — Alert.alert não bloqueia na web
      router.back();
    },
    onError: (error) => {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setSuccessMsg(null);
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
    if (!costCenterCode.trim()) { Alert.alert("Campo obrigatório", "Selecione o Centro de Custo antes de continuar."); return; }
    if (!application.trim()) { Alert.alert("Campo obrigatório", "Informe a aplicação/finalidade."); return; }
    // Observação obrigatória para urgentes e emergenciais
    if ((urgency === "urgente" || urgency === "emergencial") && !observations.trim()) {
      Alert.alert(
        "Campo obrigatório",
        `Para solicitações ${urgency === "emergencial" ? "emergenciais" : "urgentes"}, é obrigatório descrever o motivo no campo Observações.`
      );
      return;
    }
    // Fazenda obrigatória
    if (!selectedFarmId) { Alert.alert("Campo obrigatório", "Selecione a Fazenda/Unidade antes de continuar."); return; }
    // Safra obrigatória
    if (!selectedHarvestId) { Alert.alert("Campo obrigatório", "Selecione a Safra antes de continuar."); return; }
    // Tipo de Manutenção obrigatório quando CC = Manutenção – Grupo Operativo
    if (isMaintenanceCC && !maintenanceType) { Alert.alert("Campo obrigatório", "Selecione o Tipo de Manutenção (Preventiva ou Corretiva)."); return; }
    // Tipo de Combustível obrigatório quando CC = Combustíveis e Lubrificantes
    if (isFuelCC && !fuelType) { Alert.alert("Campo obrigatório", "Selecione o Tipo de Combustível/Lubrificante."); return; }

    const validItems = items.filter((i) => i.description.trim());
    if (validItems.length === 0) { Alert.alert("Campo obrigatório", "Adicione ao menos um item com descrição."); return; }
    const itemSemUnidade = validItems.find((i) => !i.unit.trim());
    if (itemSemUnidade) { Alert.alert("Campo obrigatório", "Selecione a unidade de medida de todos os itens."); return; }

    createMutation.mutate({
      department: department.trim(),
      costCenterCode: costCenterCode,
      application: application.trim(),
      urgencyLevel: urgency,
      observations: observations.trim() || undefined,
      osMyfarm: osMyfarm.trim() || undefined,
      farmId: selectedFarmId!,
      farmName: selectedFarmName!,
      harvestId: selectedHarvestId!,
      harvestName: selectedHarvestName!,
      maintenanceType: isMaintenanceCC ? (maintenanceType ?? undefined) : undefined,
      fuelType: isFuelCC ? (fuelType ?? undefined) : undefined,
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

          {/* Fazenda (obrigatório) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Fazenda/Unidade <Text className="text-error">*</Text></Text>
            <Pressable
              onPress={() => setShowFarmPicker(true)}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: selectedFarmId ? colors.primary : colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 13, color: selectedFarmId ? colors.foreground : colors.muted, flex: 1 }}>
                {selectedFarmName || "Selecionar fazenda..."}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {selectedFarmId && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); setSelectedFarmId(null); setSelectedFarmName(""); }} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 16, color: colors.muted }}>✕</Text>
                  </Pressable>
                )}
                <Text style={{ fontSize: 16, color: colors.muted }}>🌾</Text>
              </View>
            </Pressable>
          </View>

          {/* Safra (obrigatório) */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Safra <Text className="text-error">*</Text></Text>
            <Pressable
              onPress={() => setShowHarvestPicker(true)}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: selectedHarvestId ? colors.primary : colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 13, color: selectedHarvestId ? colors.foreground : colors.muted, flex: 1 }}>
                {selectedHarvestName || "Selecionar safra..."}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {selectedHarvestId && (
                  <Pressable onPress={(e) => { e.stopPropagation?.(); setSelectedHarvestId(null); setSelectedHarvestName(""); }} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 16, color: colors.muted }}>✕</Text>
                  </Pressable>
                )}
                <Text style={{ fontSize: 16, color: colors.muted }}>🌱</Text>
              </View>
            </Pressable>
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

          {/* Centro de Custo — Modal Picker */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Centro de Custo <Text className="text-error">*</Text></Text>
            <TouchableOpacity
              onPress={() => { setCostCenterSearch(""); setShowCostCenterPicker(true); }}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: costCenterCode ? colors.primary : colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 13,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: costCenterCode ? colors.foreground : colors.muted, fontSize: 14, flex: 1 }}>
                {costCenterCode
                  ? (() => { const cc = (costCenters ?? []).find(c => c.code === costCenterCode); return cc ? `${cc.code} — ${cc.name}` : costCenterCode; })()
                  : "Selecionar centro de custo..."}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {costCenterCode ? (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); setCostCenterCode(""); }}
                    style={{ padding: 2 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 16 }}>▼</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Tipo de Manutenção (condicional: aparece apenas quando CC = Manutenção – Grupo Operativo) */}
          {isMaintenanceCC && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Tipo de Manutenção <Text className="text-error">*</Text></Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["preventiva", "corretiva"] as const).map((tipo) => (
                  <TouchableOpacity
                    key={tipo}
                    onPress={() => setMaintenanceType(tipo)}
                    style={{
                      flex: 1,
                      backgroundColor: maintenanceType === tipo ? colors.primary : colors.surface,
                      borderWidth: 1.5,
                      borderColor: maintenanceType === tipo ? colors.primary : colors.border,
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: maintenanceType === tipo ? "#fff" : colors.foreground }}>
                      {tipo === "preventiva" ? "🛡️ Preventiva" : "🔧 Corretiva"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Tipo de Combustível/Lubrificante (condicional: aparece apenas quando CC = Combustíveis e Lubrificantes) */}
          {isFuelCC && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Tipo de Combustível / Lubrificante <Text className="text-error">*</Text></Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {([
                  { key: "diesel", label: "⛽ Diesel" },
                  { key: "diesel_s10", label: "⛽ Diesel S-10" },
                  { key: "alcool_gasolina_fazenda", label: "🌾 Álcool/Gasolina – Fazenda" },
                  { key: "alcool_gasolina_administrativo", label: "🏢 Álcool/Gasolina – Adm." },
                  { key: "lubrificantes", label: "🛢️ Lubrificantes" },
                ] as const).map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFuelType(key)}
                    style={{
                      backgroundColor: fuelType === key ? colors.primary : colors.surface,
                      borderWidth: 1.5,
                      borderColor: fuelType === key ? colors.primary : colors.border,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: fuelType === key ? "#fff" : colors.foreground }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
                  {/* Picker de unidade — botão que abre modal */}
                  <TouchableOpacity
                    onPress={() => setUnitPickerItemId(item.id)}
                    style={{
                      width: 72,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: item.unit ? colors.primary : colors.error,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: item.unit ? colors.primary : colors.error }}>
                      {item.unit || "Un ⚠"}
                    </Text>
                    <Text style={{ fontSize: 9, color: colors.muted }}>toque</Text>
                  </TouchableOpacity>
                  <View className="flex-1">
                    <TextInput
                      value={item.unitPrice}
                      onChangeText={(v) => {
                        // Aceita apenas dígitos, vírgula e ponto
                        const sanitized = v.replace(/[^0-9.,]/g, "");
                        updateItem(item.id, "unitPrice", sanitized);
                      }}
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

          {/* OS Manutenção */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">OS Manutenção <Text className="text-muted font-normal">(opcional)</Text></Text>
            <Pressable
              onPress={() => { setShowOsPicker(true); refetchOs(); }}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: selectedOs ? colors.primary : colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1 }}>
                {selectedOs ? (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{selectedOs.orderNumber}</Text>
                    <Text style={{ fontSize: 12, color: colors.foreground, marginTop: 1 }}>
                      {selectedOs.description ?? selectedOs.equipment.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{selectedOs.equipment.code} · {selectedOs.equipment.name}</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 13, color: colors.muted }}>Selecionar OS de Manutenção...</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {selectedOs && (
                  <Pressable
                    onPress={(e) => { e.stopPropagation?.(); setSelectedOs(null); setOsMyfarm(""); }}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 16, color: colors.muted }}>✕</Text>
                  </Pressable>
                )}
                <Text style={{ fontSize: 18, color: colors.muted }}>🔧</Text>
              </View>
            </Pressable>
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

      {/* Modal: Selecionar Unidade de Medida */}
      {unitPickerItemId !== null && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 9999 }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "60%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Unidade de Medida</Text>
              <Pressable onPress={() => setUnitPickerItemId(null)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {UNIT_OPTIONS.map((u) => {
                  const currentItem = items.find((i) => i.id === unitPickerItemId);
                  const isSelected = currentItem?.unit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => {
                        updateItem(unitPickerItemId!, "unit", u);
                        setUnitPickerItemId(null);
                      }}
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? `${colors.primary}15` : colors.surface,
                        minWidth: 60,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: isSelected ? colors.primary : colors.foreground }}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Digitar manualmente */}
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 16, marginBottom: 8 }}>Ou digitar manualmente:</Text>
              <TextInput
                placeholder="Ex: pct, gl, balde..."
                placeholderTextColor={colors.muted}
                defaultValue={items.find((i) => i.id === unitPickerItemId)?.unit ?? ""}
                onSubmitEditing={(e) => {
                  const val = e.nativeEvent.text.trim();
                  if (val) { updateItem(unitPickerItemId!, "unit", val); setUnitPickerItemId(null); }
                }}
                returnKeyType="done"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
              />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Modal: Selecionar Centro de Custo */}
      {showCostCenterPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>🏦 Selecionar Centro de Custo</Text>
              <Pressable onPress={() => { setShowCostCenterPicker(false); setCostCenterSearch(""); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600" }}>Fechar</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <TextInput
                value={costCenterSearch}
                onChangeText={setCostCenterSearch}
                placeholder="Buscar por código ou nome..."
                placeholderTextColor={colors.muted}
                autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.foreground }}
              />
            </View>
            <FlatList
              data={filteredCostCenters}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
              ListHeaderComponent={
                <Pressable
                  onPress={() => { setCostCenterCode(""); setShowCostCenterPicker(false); setCostCenterSearch(""); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: !costCenterCode ? `${colors.primary}15` : colors.surface,
                    borderWidth: 1,
                    borderColor: !costCenterCode ? colors.primary : colors.border,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: !costCenterCode ? colors.primary : colors.muted }}>Nenhum</Text>
                  {!costCenterCode && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
                </Pressable>
              }
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🏦</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhum centro de custo encontrado</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setCostCenterCode(item.code); setFuelType(null); setMaintenanceType(null); setShowCostCenterPicker(false); setCostCenterSearch(""); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: costCenterCode === item.code ? `${colors.primary}15` : colors.surface,
                    borderWidth: 1,
                    borderColor: costCenterCode === item.code ? colors.primary : colors.border,
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
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.code}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ backgroundColor: `${colors.primary}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontFamily: "monospace", color: colors.primary, fontWeight: "700" }}>{item.code}</Text>
                    </View>
                    {costCenterCode === item.code && <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>}
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      )}

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
      {/* Modal: Selecionar OS de Manutenção */}
      {showOsPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 9999 }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>🔧 Selecionar OS de Manutenção</Text>
              <Pressable onPress={() => setShowOsPicker(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <TextInput
                value={osSearch}
                onChangeText={setOsSearch}
                placeholder="Buscar por número, descrição ou equipamento..."
                placeholderTextColor={colors.muted}
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.foreground }}
                autoFocus
              />
            </View>
            {osLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 13, color: colors.muted }}>Buscando OS no CGS Manutenções...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredOs}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Nenhuma OS encontrada</Text>
                    <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Tente outro termo de busca</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const statusColors: Record<string, string> = {
                    in_progress: "#F59E0B",
                    open: "#22C55E",
                    pending: "#6B7280",
                    completed: "#3B82F6",
                  };
                  const statusLabels: Record<string, string> = {
                    in_progress: "Em andamento",
                    open: "Aberta",
                    pending: "Pendente",
                    completed: "Concluída",
                  };
                  const color = statusColors[item.status] ?? colors.muted;
                  return (
                    <Pressable
                      onPress={() => {
                        setSelectedOs(item);
                        setOsMyfarm(item.orderNumber);
                        setShowOsPicker(false);
                        setOsSearch("");
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.7 : 1,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      })}
                    >
                      <View style={{ backgroundColor: color + "20", borderRadius: 10, padding: 10 }}>
                        <Text style={{ fontSize: 20 }}>🔧</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>{item.orderNumber}</Text>
                          <View style={{ backgroundColor: color + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color }}>{statusLabels[item.status] ?? item.status}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, color: colors.foreground, marginBottom: 2 }} numberOfLines={2}>
                          {item.description ?? "(sem descrição)"}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.muted }}>
                          🚜 {item.equipment.code} · {item.equipment.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      )}
      {/* Modal: Selecionar Fazenda */}
      {showFarmPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 9999 }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>🌾 Selecionar Fazenda</Text>
              <Pressable onPress={() => setShowFarmPicker(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={farms ?? []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🌾</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhuma fazenda cadastrada</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Cadastre fazendas em Cadastros → Fazendas</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelectedFarmId(item.id); setSelectedFarmName(item.name); setShowFarmPicker(false); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: selectedFarmId === item.id ? `${colors.primary}15` : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedFarmId === item.id ? colors.primary : colors.border,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.name}</Text>
                  {item.code && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{item.code}</Text>}
                </Pressable>
              )}
            />
          </View>
        </View>
      )}

      {/* Modal: Selecionar Safra */}
      {showHarvestPicker && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", zIndex: 9999 }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>🌱 Selecionar Safra</Text>
              <Pressable onPress={() => setShowHarvestPicker(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}>
                <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
              </Pressable>
            </View>
            <FlatList
              data={harvests ?? []}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🌱</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>Nenhuma safra cadastrada</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Cadastre safras em Cadastros → Safras</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { setSelectedHarvestId(item.id); setSelectedHarvestName(item.name); setShowHarvestPicker(false); }}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: selectedHarvestId === item.id ? `${colors.primary}15` : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedHarvestId === item.id ? colors.primary : colors.border,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 8,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{item.name}</Text>
                  {item.year && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>Ano: {item.year}</Text>}
                </Pressable>
              )}
            />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
