import { ScreenContainer } from "@/components/screen-container";
import { RequestCard } from "@/components/procurement/RequestCard";
import { EmptyState } from "@/components/procurement/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const FILTER_TABS = [
  { key: "all", label: "Todas" },
  { key: "aguardando_gerente", label: "Gerente" },
  { key: "aguardando_orcamento", label: "Orçamento" },
  { key: "aguardando_controladoria", label: "Controladoria" },
  { key: "aguardando_diretoria", label: "Diretoria" },
  { key: "aguardando_ordem_compra", label: "Ord. Compra" },
  { key: "aguardando_financeiro", label: "Financeiro" },
  { key: "concluida", label: "Concluídas" },
  { key: "rejeitada", label: "Rejeitadas" },
  { key: "cancelada", label: "Canceladas" },
];

export default function RequestsScreen() {
  const { isAuthenticated } = useAuth();
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: requests, isLoading, refetch, isRefetching } = trpc.requests.myRequests.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const filtered = (requests ?? []).filter((r) =>
    activeFilter === "all" ? true : r.status === activeFilter
  );

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-3 border-b border-border">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-bold text-foreground">Solicitações</Text>
          <TouchableOpacity
            onPress={() => router.push("/request/new" as any)}
            className="flex-row items-center gap-1 bg-primary px-4 py-2 rounded-full"
          >
            <Text className="text-white text-sm font-semibold">+ Nova</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-muted">{filtered.length} solicitação{filtered.length !== 1 ? "ões" : ""}</Text>
      </View>

      <View className="border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
          {FILTER_TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setActiveFilter(tab.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className={`px-3 py-1.5 rounded-full border ${activeFilter === tab.key ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                <Text className={`text-xs font-semibold ${activeFilter === tab.key ? "text-white" : "text-muted"}`}>{tab.label}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <EmptyState
              title="Nenhuma solicitação"
              description={activeFilter === "all" ? "Toque em '+ Nova' para criar sua primeira solicitação de compra." : "Nenhuma solicitação com este status."}
              icon="📋"
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
