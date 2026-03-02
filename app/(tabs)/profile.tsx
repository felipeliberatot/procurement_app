import { ScreenContainer } from "@/components/screen-container";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, logout: authLogout } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  // Fetch full user data from server (includes phone, department, etc.)
  const { data: fullUser, isLoading: userLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const userRole = (fullUser as any)?.procurementRole as ProcurementRole ?? "solicitante";
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync form fields when fullUser data arrives
  useEffect(() => {
    if (fullUser) {
      setPhone((fullUser as any).phone ?? "");
      setDepartment((fullUser as any).department ?? "");
    }
  }, [fullUser]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const handleLogout = async () => {
    await authLogout();
    // Na web, forçar reload completo da página para limpar todo o estado React
    // e garantir que o cookie de sessão seja descartado antes de navegar
    if (Platform.OS === "web") {
      window.location.href = "/login";
    } else {
      router.replace("/login" as any);
    }
  };

  const handleSave = () => {
    updateProfile.mutate({
      phone: phone.trim() || undefined,
      department: department.trim() || undefined,
    });
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <View className="px-5 pt-4 pb-3 border-b border-border">
          <Text className="text-2xl font-bold text-foreground">Meu Perfil</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom + 24, 40) }} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-3">
              <Text className="text-3xl font-bold text-primary">
                {((fullUser as any)?.name ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <Text className="text-lg font-bold text-foreground">{(fullUser as any)?.name ?? "—"}</Text>
            <Text className="text-sm text-muted">{(fullUser as any)?.email}</Text>
            <View className="mt-2 bg-primary/10 px-3 py-1 rounded-full">
              <Text className="text-xs text-primary font-semibold">{ROLE_LABELS[userRole]}</Text>
            </View>
            {(fullUser as any)?.jobTitle && (
              <Text className="text-xs text-muted mt-1">{(fullUser as any).jobTitle}</Text>
            )}
          </View>

          {/* Campos editáveis */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4 gap-4">
            <Text className="text-sm font-bold text-foreground">Informações de Contato</Text>
            <View>
              <Text className="text-xs text-muted mb-1">WhatsApp</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+55 11 99999-9999"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                keyboardType="phone-pad"
                returnKeyType="next"
              />
              <Text className="text-xs text-muted mt-1">Usado para notificações de aprovação via WhatsApp</Text>
            </View>
            <View>
              <Text className="text-xs text-muted mb-1">Departamento</Text>
              <TextInput
                value={department}
                onChangeText={setDepartment}
                placeholder="Ex: Tecnologia da Informação"
                placeholderTextColor={colors.muted}
                className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                returnKeyType="done"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={updateProfile.isPending || userLoading}
            className="bg-primary rounded-2xl py-4 items-center mb-4"
            style={{ opacity: updateProfile.isPending ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {saved ? "✅ Salvo!" : updateProfile.isPending ? "Salvando..." : "Salvar Alterações"}
            </Text>
          </TouchableOpacity>

          {/* Informações do sistema */}
          <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
            <Text className="text-sm font-bold text-foreground mb-3">Prazos do Sistema</Text>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base">🔴</Text>
                  <Text className="text-sm text-foreground">Emergencial</Text>
                </View>
                <Text className="text-sm font-semibold text-error">1 dia</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base">🟡</Text>
                  <Text className="text-sm text-foreground">Urgente</Text>
                </View>
                <Text className="text-sm font-semibold text-warning">3 dias</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base">🟢</Text>
                  <Text className="text-sm text-foreground">Normal</Text>
                </View>
                <Text className="text-sm font-semibold text-success">7 dias</Text>
              </View>
              <View className="mt-2 pt-2 border-t border-border">
                <Text className="text-xs text-muted">
                  Se não aprovado em cada etapa, a solicitação retorna ao solicitante para correção em 48h. Após esse prazo, é cancelada automaticamente.
                </Text>
              </View>
            </View>
          </View>

          {/* WhatsApp Setup */}
          <TouchableOpacity
            onPress={() => router.push("/whatsapp-config" as any)}
            className="bg-surface border border-border rounded-2xl py-4 px-4 flex-row items-center justify-between mb-4"
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-xl">💬</Text>
              <View>
                <Text className="text-sm font-semibold text-foreground">Integração WhatsApp</Text>
                <Text className="text-xs text-muted">Configurar aprovações via WhatsApp</Text>
              </View>
            </View>
            <Text className="text-muted">→</Text>
          </TouchableOpacity>

          {/* Sair */}
          <TouchableOpacity
            onPress={() => Alert.alert("Sair", "Deseja sair da sua conta?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: handleLogout },
            ])}
            className="border border-error/30 rounded-2xl py-4 items-center"
          >
            <Text className="text-error font-semibold">Sair da Conta</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
