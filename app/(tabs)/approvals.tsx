import { ScreenContainer } from "@/components/screen-container";
import { RequestCard } from "@/components/procurement/RequestCard";
import { EmptyState } from "@/components/procurement/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

const ROLE_DESCRIPTIONS: Record<ProcurementRole, string> = {
  solicitante: "Você não tem pendências de aprovação.",
  gerente: "Solicitações aguardando sua aprovação como Gerente de Unidade.",
  orcamento: "Solicitações aguardando anexo de orçamento (PDF).",
  controladoria: "Solicitações aguardando aprovação da Controladoria.",
  diretoria: "Solicitações aguardando aprovação da Diretoria.",
  financeiro: "Solicitações aguardando Ordem de Compra ou Pagamento.",
  admin: "Todas as solicitações pendentes no sistema.",
};

export default function ApprovalsScreen() {
  const { isAuthenticated, user } = useAuth();
  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";

  const { data: pending, isLoading, refetch, isRefetching } = trpc.requests.pendingForMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-3 border-b border-border">
        <Text className="text-2xl font-bold text-foreground">Aprovações</Text>
        <Text className="text-sm text-muted mt-0.5">{ROLE_LABELS[userRole] ?? "Usuário"}</Text>
        {pending && pending.length > 0 && (
          <View className="mt-2 bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
            <Text className="text-xs text-warning font-semibold">
              ⚠️ {pending.length} solicitação{pending.length !== 1 ? "ões" : ""} aguardando sua ação
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={pending ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <EmptyState
              title="Nenhuma aprovação pendente"
              description={ROLE_DESCRIPTIONS[userRole]}
              icon="✅"
            />
          }
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onPress={() => router.push(`/request/${item.id}` as any)}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}
