import { ScreenContainer } from "@/components/screen-container";
import { MetricCard } from "@/components/procurement/MetricCard";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

export default function DashboardScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isDesktop } = useBreakpoint();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login" as any);
    }
  }, [isAuthenticated, loading]);

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";

  const { data: stats, isLoading: statsLoading } = trpc.requests.dashboardStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: maloteStats, isLoading: maloteLoading } = trpc.malotes.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: pending } = trpc.requests.pendingForMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const pendingCount = (pending ?? []).length;

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, maxWidth: isDesktop ? 1200 : undefined, alignSelf: isDesktop ? "center" as any : undefined, width: isDesktop ? "100%" : undefined, paddingHorizontal: isDesktop ? 32 : 0 }}>

        {/* Header */}
        <View className="px-5 pt-5 pb-4" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs text-muted capitalize">{today}</Text>
              <Text className="text-2xl font-bold text-foreground mt-0.5">
                Olá, {user?.name?.split(" ")[0] ?? "Usuário"} 👋
              </Text>
              <View className="mt-1.5 self-start bg-primary/10 px-2.5 py-0.5 rounded-full">
                <Text className="text-xs text-primary font-semibold">{ROLE_LABELS[userRole]}</Text>
              </View>
            </View>
            {!isDesktop && (
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: 52, height: 52, borderRadius: 12 }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>

        {/* Alerta de aprovações pendentes */}
        {pendingCount > 0 && (
          <View className="px-5 mb-4">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/approvals" as any)}
              style={{ backgroundColor: "#FEF3C7", borderColor: "#F59E0B", borderWidth: 1 }}
              className="rounded-2xl p-4 flex-row items-center gap-3"
            >
              <Text className="text-2xl">⚠️</Text>
              <View className="flex-1">
                <Text className="text-sm font-bold" style={{ color: "#92400E" }}>
                  {pendingCount} solicitaç{pendingCount !== 1 ? "ões aguardam" : "ão aguarda"} sua aprovação
                </Text>
                <Text className="text-xs" style={{ color: "#B45309" }}>Toque para revisar</Text>
              </View>
              <Text style={{ color: "#92400E" }}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main content: two-column on desktop, single column on mobile */}
        <View style={isDesktop ? { flexDirection: "row", gap: 24, paddingHorizontal: 0 } : {}}>

          {/* Left column (or full width on mobile) */}
          <View style={isDesktop ? { flex: 2 } : {}}>

            {/* Métricas de Solicitações */}
            <View className="px-5 mb-5" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
              <Text className="text-sm font-bold text-foreground mb-3">Solicitações de Compra</Text>
              {statsLoading ? (
                <View className="items-center py-4"><ActivityIndicator /></View>
              ) : (
                <>
                  <View className="flex-row gap-3 mb-3">
                    <MetricCard label="Total" value={stats?.total ?? 0} icon="📋" color="primary" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "all" } })} />
                    <MetricCard label="Em Andamento" value={stats?.pending ?? 0} icon="⏳" color="warning" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "pending" } })} />
                    <MetricCard label="Concluídas" value={stats?.approved ?? 0} icon="✅" color="success" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "concluida" } })} />
                  </View>
                  <View className="flex-row gap-3">
                    <MetricCard label="Rejeitadas" value={stats?.rejected ?? 0} icon="❌" color="error" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "rejeitada" } })} />
                    <MetricCard label="Canceladas" value={(stats as any)?.cancelled ?? 0} icon="🚫" color="muted" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "cancelada" } })} />
                    <MetricCard label="Emergenciais" value={stats?.emergency ?? 0} icon="🔴" color="error" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { urgency: "emergencial" } })} />
                  </View>
                </>
              )}
            </View>

            {/* Ações Rápidas */}
            <View className="px-5 mb-5" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
              <Text className="text-sm font-bold text-foreground mb-3">Ações Rápidas</Text>
              <View style={{ gap: 12 }}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/request/new" as any)} className="bg-primary rounded-2xl p-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center"><Text className="text-xl">+</Text></View>
                  <View className="flex-1">
                    <Text className="text-white font-bold text-base">Nova Solicitação</Text>
                    <Text className="text-white/70 text-xs">Criar solicitação de compra</Text>
                  </View>
                  <Text className="text-white text-lg">→</Text>
                </TouchableOpacity>
                <View className="flex-row gap-3">
                  <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(tabs)/malotes" as any)} className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center gap-2">
                    <Text className="text-2xl">📦</Text>
                    <Text className="text-xs font-semibold text-foreground text-center">Novo Malote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(tabs)/approvals" as any)} className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center gap-2">
                    <Text className="text-2xl">✅</Text>
                    <Text className="text-xs font-semibold text-foreground text-center">Aprovações</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(tabs)/registers" as any)} className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center gap-2">
                    <Text className="text-2xl">📂</Text>
                    <Text className="text-xs font-semibold text-foreground text-center">Cadastros</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </View>{/* end left column */}

          {/* Right column (desktop only) */}
          {isDesktop && (
            <View style={{ flex: 1, gap: 20 }}>

              {/* Métricas de Malotes */}
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-sm font-bold text-foreground">Malotes</Text>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/malotes" as any)}>
                    <Text className="text-xs text-primary font-semibold">Ver todos →</Text>
                  </TouchableOpacity>
                </View>
                {maloteLoading ? (
                  <View className="items-center py-4"><ActivityIndicator /></View>
                ) : (
                  <View className="bg-surface border border-border rounded-2xl p-4">
                    <View className="flex-row gap-3">
                      <View className="flex-1 items-center py-2">
                        <Text className="text-2xl font-bold text-primary">{maloteStats?.abertos ?? 0}</Text>
                        <Text className="text-xs text-muted mt-0.5">Abertos</Text>
                      </View>
                      <View className="w-px bg-border" />
                      <View className="flex-1 items-center py-2">
                        <Text className="text-2xl font-bold text-warning">{maloteStats?.enviados ?? 0}</Text>
                        <Text className="text-xs text-muted mt-0.5">Em Trânsito</Text>
                      </View>
                      <View className="w-px bg-border" />
                      <View className="flex-1 items-center py-2">
                        <Text className="text-2xl font-bold text-success">{maloteStats?.recebidos ?? 0}</Text>
                        <Text className="text-xs text-muted mt-0.5">Recebidos</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Módulos do Sistema */}
              <View>
                <Text className="text-sm font-bold text-foreground mb-3">Módulos do Sistema</Text>
                <View className="bg-surface border border-border rounded-2xl overflow-hidden">
                  {[
                    { icon: "📋", label: "Solicitações", desc: "Criar e acompanhar", route: "/(tabs)/requests" },
                    { icon: "✅", label: "Aprovações", desc: "Revisar e aprovar", route: "/(tabs)/approvals" },
                    { icon: "📦", label: "Malotes", desc: "Envio e recebimento", route: "/(tabs)/malotes" },
                    { icon: "📂", label: "Cadastros", desc: "Bens, fazendas, unidades", route: "/(tabs)/registers" },
                  ].map((item, index, arr) => (
                    <TouchableOpacity key={item.route} activeOpacity={0.7} onPress={() => router.push(item.route as any)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: index < arr.length - 1 ? 1 : 0, borderBottomColor: "transparent" }}
                      className={index < arr.length - 1 ? "border-b border-border" : ""}
                    >
                      <View className="w-9 h-9 bg-primary/10 rounded-xl items-center justify-center">
                        <Text className="text-lg">{item.icon}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                        <Text className="text-xs text-muted">{item.desc}</Text>
                      </View>
                      <Text className="text-muted text-sm">›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

            </View>
          )}

        </View>{/* end two-column */}

        {/* Malotes + Módulos (mobile only) */}
        {!isDesktop && (
          <>
            {/* Métricas de Malotes */}
            <View className="px-5 mb-5">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-bold text-foreground">Malotes</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/malotes" as any)}>
                  <Text className="text-xs text-primary font-semibold">Ver todos →</Text>
                </TouchableOpacity>
              </View>
              {maloteLoading ? (
                <View className="items-center py-4"><ActivityIndicator /></View>
              ) : (
                <View className="bg-surface border border-border rounded-2xl p-4">
                  <View className="flex-row gap-3">
                    <View className="flex-1 items-center py-2">
                      <Text className="text-2xl font-bold text-primary">{maloteStats?.abertos ?? 0}</Text>
                      <Text className="text-xs text-muted mt-0.5">Abertos</Text>
                    </View>
                    <View className="w-px bg-border" />
                    <View className="flex-1 items-center py-2">
                      <Text className="text-2xl font-bold text-warning">{maloteStats?.enviados ?? 0}</Text>
                      <Text className="text-xs text-muted mt-0.5">Em Trânsito</Text>
                    </View>
                    <View className="w-px bg-border" />
                    <View className="flex-1 items-center py-2">
                      <Text className="text-2xl font-bold text-success">{maloteStats?.recebidos ?? 0}</Text>
                      <Text className="text-xs text-muted mt-0.5">Recebidos</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Módulos do Sistema */}
            <View className="px-5">
              <Text className="text-sm font-bold text-foreground mb-3">Módulos do Sistema</Text>
              <View className="bg-surface border border-border rounded-2xl overflow-hidden">
                {[
                  { icon: "📋", label: "Solicitações de Compra", desc: "Criar e acompanhar pedidos", route: "/(tabs)/requests" },
                  { icon: "✅", label: "Aprovações", desc: "Revisar e aprovar solicitações", route: "/(tabs)/approvals" },
                  { icon: "📦", label: "Malotes", desc: "Controle de envio e recebimento", route: "/(tabs)/malotes" },
                  { icon: "📂", label: "Cadastros", desc: "Bens, fazendas, unidades e centros de custo", route: "/(tabs)/registers" },
                  { icon: "👤", label: "Perfil", desc: "Dados pessoais e configurações", route: "/(tabs)/profile" },
                ].map((item, index, arr) => (
                  <TouchableOpacity key={item.route} activeOpacity={0.7} onPress={() => router.push(item.route as any)}
                    className={`flex-row items-center gap-3 px-4 py-3.5 ${index < arr.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <View className="w-9 h-9 bg-primary/10 rounded-xl items-center justify-center">
                      <Text className="text-lg">{item.icon}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{item.label}</Text>
                      <Text className="text-xs text-muted">{item.desc}</Text>
                    </View>
                    <Text className="text-muted text-sm">›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}
