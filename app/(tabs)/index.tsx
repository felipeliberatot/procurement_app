import { ScreenContainer } from "@/components/screen-container";
import { RequestCard } from "@/components/procurement/RequestCard";
import { MetricCard } from "@/components/procurement/MetricCard";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function DashboardScreen() {
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login" as any);
    }
  }, [isAuthenticated, loading]);

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";

  const { data: stats, isLoading: statsLoading } = trpc.requests.dashboardStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: pending } = trpc.requests.pendingForMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: myRequests } = trpc.requests.myRequests.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: maloteStats } = trpc.malotes.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const recentRequests = (myRequests ?? []).slice(0, 3);
  const pendingRequests = (pending ?? []).slice(0, 3);

  if (loading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4">
          <Text className="text-sm text-muted">Bem-vindo,</Text>
          <Text className="text-2xl font-bold text-foreground">{user?.name?.split(" ")[0] ?? "Usuário"}</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <View className="bg-primary/10 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-primary font-semibold">{ROLE_LABELS[userRole]}</Text>
            </View>
            {user?.email && <Text className="text-xs text-muted">{user.email}</Text>}
          </View>
        </View>

        {/* Métricas */}
        {statsLoading ? (
          <View className="px-5 mb-4">
            <ActivityIndicator />
          </View>
        ) : stats ? (
          <View className="px-5 mb-4">
            <Text className="text-sm font-semibold text-foreground mb-3">Resumo Geral</Text>
            <View className="flex-row gap-3 mb-3">
              <MetricCard label="Total" value={stats.total ?? 0} icon="📋" color="primary" />
              <MetricCard label="Em Andamento" value={stats.pending ?? 0} icon="⏳" color="warning" />
              <MetricCard label="Concluídas" value={stats.approved ?? 0} icon="✅" color="success" />
            </View>
            <View className="flex-row gap-3 mb-3">
              <MetricCard label="Rejeitadas" value={stats.rejected ?? 0} icon="❌" color="error" />
              <MetricCard label="Canceladas" value={stats.rejected ?? 0} icon="🚫" color="muted" />

            </View>

            {/* Urgências */}
            {(stats.emergency ?? 0) > 0 && (
              <View className="bg-error/10 border border-error/30 rounded-2xl p-3 mb-3 flex-row items-center gap-3">
                <Text className="text-2xl">🔴</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-error">
                    {stats.emergency} Emergencial{(stats.emergency ?? 0) > 1 ? "ais" : ""}
                  </Text>
                  <Text className="text-xs text-muted">Prazo: 1 dia — ação imediata necessária</Text>
                </View>
              </View>
            )}
            {(stats.urgent ?? 0) > 0 && (
              <View className="bg-warning/10 border border-warning/30 rounded-2xl p-3 mb-3 flex-row items-center gap-3">
                <Text className="text-2xl">🟡</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-warning">
                    {stats.urgent} Urgente{(stats.urgent ?? 0) > 1 ? "s" : ""}
                  </Text>
                  <Text className="text-xs text-muted">Prazo: 3 dias</Text>
                </View>
              </View>
            )}
            {(stats.expiringSoon ?? 0) > 0 && (
              <View className="bg-error/20 border-2 border-error rounded-2xl p-3 mb-3 flex-row items-center gap-3">
                <Text className="text-2xl">⏰</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-error">
                    {stats.expiringSoon} prazo{(stats.expiringSoon ?? 0) > 1 ? "s" : ""} vencendo em 24h!
                  </Text>
                  <Text className="text-xs text-muted">Ação imediata necessária</Text>
                </View>
              </View>
            )}

            {/* Malotes — sempre visível */}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/malotes" as any)}
              className="bg-surface border border-border rounded-2xl p-3 mb-3"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-bold text-foreground">📦 Malotes</Text>
                <Text className="text-xs text-primary font-semibold">Ver todos →</Text>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 bg-blue-500/10 rounded-xl p-2 items-center">
                  <Text className="text-lg font-bold text-blue-500">{maloteStats?.abertos ?? 0}</Text>
                  <Text className="text-xs text-muted">Abertos</Text>
                </View>
                <View className="flex-1 bg-warning/10 rounded-xl p-2 items-center">
                  <Text className="text-lg font-bold text-warning">{maloteStats?.enviados ?? 0}</Text>
                  <Text className="text-xs text-muted">Em Trânsito</Text>
                </View>
                <View className="flex-1 bg-success/10 rounded-xl p-2 items-center">
                  <Text className="text-lg font-bold text-success">{maloteStats?.recebidos ?? 0}</Text>
                  <Text className="text-xs text-muted">Recebidos</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Ação Rápida */}
        <View className="px-5 mb-4">
          <TouchableOpacity
            onPress={() => router.push("/request/new" as any)}
            className="bg-primary rounded-2xl p-4 flex-row items-center gap-3"
          >
            <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
              <Text className="text-xl">+</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">Nova Solicitação</Text>
              <Text className="text-white/70 text-xs">Criar uma nova solicitação de compra</Text>
            </View>
            <Text className="text-white text-lg">→</Text>
          </TouchableOpacity>
        </View>

        {/* Aprovações Pendentes */}
        {pendingRequests.length > 0 && (
          <View className="px-5 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-foreground">Aguardando Sua Ação</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/approvals" as any)}>
                <Text className="text-xs text-primary font-semibold">Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {pendingRequests.map((item) => (
              <RequestCard
                key={item.id}
                request={item}
                onPress={() => router.push(`/request/${item.id}` as any)}
              />
            ))}
          </View>
        )}

        {/* Minhas Solicitações Recentes */}
        {recentRequests.length > 0 && (
          <View className="px-5 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-bold text-foreground">Minhas Solicitações</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/requests" as any)}>
                <Text className="text-xs text-primary font-semibold">Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {recentRequests.map((item) => (
              <RequestCard
                key={item.id}
                request={item}
                onPress={() => router.push(`/request/${item.id}` as any)}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {recentRequests.length === 0 && pendingRequests.length === 0 && !statsLoading && (
          <View className="px-5 items-center py-8">
            <Text className="text-5xl mb-4">🛒</Text>
            <Text className="text-lg font-semibold text-foreground text-center mb-2">
              Nenhuma solicitação ainda
            </Text>
            <Text className="text-sm text-muted text-center">
              Toque em "Nova Solicitação" para começar o processo de compras.
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
