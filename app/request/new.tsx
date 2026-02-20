import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

          {/* Solicitante (readonly) */}
          <View className="mb-4 bg-surface border border-border rounded-xl p-3">
            <Text className="text-xs text-muted mb-1">Solicitante</Text>
            <Text className="text-sm font-semibold text-foreground">{user?.name ?? "—"}</Text>
            <Text className="text-xs text-muted">{user?.email ?? "—"}</Text>
          </View>

          {/* Departamento */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-1">Departamento <Text className="text-error">*</Text></Text>
            <TextInput
              value={department}
              onChangeText={setDepartment}
              placeholder="Ex: Tecnologia da Informação"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              returnKeyType="next"
            />
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

          {/* Aplicação */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-1">Aplicação / Finalidade <Text className="text-error">*</Text></Text>
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
            <Text className="text-sm font-semibold text-foreground mb-1">Observações</Text>
            <TextInput
              value={observations}
              onChangeText={setObservations}
              placeholder="Informações adicionais, especificações técnicas..."
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: "top" }}
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
    </ScreenContainer>
  );
}
