import { ScreenContainer } from "@/components/screen-container";
import { RequestCard } from "@/components/procurement/RequestCard";
import { EmptyState } from "@/components/procurement/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useState } from "react";
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
  { key: "pending", label: "⏳ Em Andamento" },
  { key: "aguardando_gerente", label: "Gerente" },
  { key: "aguardando_orcamento", label: "Orçamento" },
  { key: "aguardando_controladoria", label: "Controladoria" },
  { key: "aguardando_diretoria", label: "Diretoria" },
  { key: "aguardando_ordem_compra", label: "Emissão OC" },
  { key: "aguardando_aprovacao_compra", label: "Aprov. Financeiro" },
  { key: "aguardando_comprovante_pagamento", label: "Comprovante" },
  { key: "aguardando_verificacao_compras", label: "Verif. Compras" },
  { key: "concluida", label: "Concluídas" },
  { key: "rejeitada", label: "Rejeitadas" },
  { key: "cancelada", label: "Canceladas" },
];

const URGENCY_FILTERS = [
  { key: "all", label: "Todas", color: "bg-surface border-border", textColor: "text-muted" },
  { key: "emergencial", label: "🔴 Emergencial", color: "bg-error border-error", textColor: "text-white" },
  { key: "urgente", label: "🟡 Urgente", color: "bg-warning border-warning", textColor: "text-white" },
  { key: "normal", label: "🟢 Normal", color: "bg-success border-success", textColor: "text-white" },
];

// Mapa de status que cada papel pode agir
const ROLE_PENDING_STATUSES: Record<string, string[]> = {
  gerente: ["aguardando_gerente"],
  orcamento: ["aguardando_orcamento", "aguardando_ordem_compra", "aguardando_verificacao_compras"],
  controladoria: ["aguardando_controladoria"],
  diretoria: ["aguardando_diretoria"],
  financeiro: ["aguardando_comprovante_pagamento", "aguardando_aprovacao_compra"],
  admin: [],
  solicitante: [],
};

export default function RequestsScreen() {
  const { isAuthenticated, user } = useAuth();
  const { isDesktop } = useBreakpoint();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ filter?: string; urgency?: string }>();
  const [activeFilter, setActiveFilter] = useState(params.filter ?? "all");
  const [activeUrgency, setActiveUrgency] = useState(params.urgency ?? "all");
  const [activeDepartment, setActiveDepartment] = useState<string>("all");
  const [myActionOnly, setMyActionOnly] = useState(false);

  // Calcula os status pendentes para o usuário logado (todos os papéis)
  const myPendingStatuses = React.useMemo(() => {
    const allRoles: string[] = [];
    const primaryRole = (user as any)?.procurementRole;
    if (primaryRole) allRoles.push(primaryRole);
    try {
      const extras: string[] = JSON.parse((user as any)?.extraRoles ?? "[]");
      extras.forEach(r => { if (!allRoles.includes(r)) allRoles.push(r); });
    } catch {}
    const statuses = new Set<string>();
    allRoles.forEach(r => (ROLE_PENDING_STATUSES[r] ?? []).forEach(s => statuses.add(s)));
    return [...statuses];
  }, [user]);

  // Sincroniza filtros sempre que a tela recebe foco (inclui navegação por tab)
  useFocusEffect(
    useCallback(() => {
      setActiveFilter(params.filter ?? "all");
      setActiveUrgency(params.urgency ?? "all");
    }, [params.filter, params.urgency])
  );

  // Também sincroniza quando os params mudam sem perda de foco
  useEffect(() => {
    setActiveFilter(params.filter ?? "all");
    setActiveUrgency(params.urgency ?? "all");
  }, [params.filter, params.urgency]);

  const { data: requests, isLoading, refetch, isRefetching } = trpc.requests.all.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: departments } = trpc.departments.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const filtered = (requests ?? []).filter((r) => {
    // "pending" é um filtro especial que agrupa todos os status "aguardando_*"
    const statusMatch =
      activeFilter === "all" ? true
      : activeFilter === "pending" ? r.status.startsWith("aguardando")
      : r.status === activeFilter;
    const urgencyMatch = activeUrgency === "all" ? true : r.urgencyLevel === activeUrgency;
    const deptMatch = activeDepartment === "all" ? true : r.department === activeDepartment;
    const myActionMatch = myActionOnly ? myPendingStatuses.includes(r.status) : true;
    return statusMatch && urgencyMatch && deptMatch && myActionMatch;
  });

  if (isDesktop) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, flexDirection: "row" }}>
          {/* Sidebar de filtros (desktop) */}
          <View style={{ width: 200, borderRightWidth: 1, borderRightColor: colors.border, paddingTop: 20, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 8, paddingHorizontal: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Status</Text>
            {FILTER_TABS.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginBottom: 2,
                  backgroundColor: activeFilter === tab.key ? `${colors.primary}18` : pressed ? `${colors.primary}08` : "transparent",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontWeight: activeFilter === tab.key ? "700" : "500", color: activeFilter === tab.key ? colors.primary : colors.foreground, flex: 1 }}>{tab.label}</Text>
              </Pressable>
            ))}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 8, paddingHorizontal: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Departamento</Text>
            <Pressable
              onPress={() => setActiveDepartment("all")}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 2,
                backgroundColor: activeDepartment === "all" ? `${colors.primary}18` : pressed ? `${colors.primary}08` : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: activeDepartment === "all" ? "700" : "500", color: activeDepartment === "all" ? colors.primary : colors.foreground }}>Todos</Text>
            </Pressable>
            {(departments ?? []).map((dept: any) => (
              <Pressable
                key={dept.id}
                onPress={() => setActiveDepartment(dept.name)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 2,
                  backgroundColor: activeDepartment === dept.name ? `${colors.primary}18` : pressed ? `${colors.primary}08` : "transparent",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontWeight: activeDepartment === dept.name ? "700" : "500", color: activeDepartment === dept.name ? colors.primary : colors.foreground }} numberOfLines={1}>{dept.name}</Text>
              </Pressable>
            ))}
            {myPendingStatuses.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 8, paddingHorizontal: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Minha Ação</Text>
                <Pressable
                  onPress={() => setMyActionOnly(v => !v)}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 8,
                    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 2,
                    backgroundColor: myActionOnly ? `${colors.warning}20` : pressed ? `${colors.primary}08` : "transparent",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: myActionOnly ? colors.warning : colors.border, backgroundColor: myActionOnly ? colors.warning : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {myActionOnly && <Text style={{ color: "white", fontSize: 10, fontWeight: "700", lineHeight: 14 }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: myActionOnly ? "700" : "500", color: myActionOnly ? colors.warning : colors.foreground, flex: 1 }}>Aguardando Minha Ação</Text>
                </Pressable>
              </>
            )}
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 8, paddingHorizontal: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Urgência</Text>
            {URGENCY_FILTERS.map((uf) => (
              <Pressable
                key={uf.key}
                onPress={() => setActiveUrgency(uf.key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginBottom: 2,
                  backgroundColor: activeUrgency === uf.key ? `${colors.primary}18` : pressed ? `${colors.primary}08` : "transparent",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 13, fontWeight: activeUrgency === uf.key ? "700" : "500", color: activeUrgency === uf.key ? colors.primary : colors.foreground }}>{uf.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Conteúdo principal */}
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>Solicitações</Text>
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{filtered.length} {filtered.length === 1 ? "solicitação" : "solicitações"}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/request/new" as any)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
              >
                <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>+ Nova Solicitação</Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 20, paddingBottom: 32, flexGrow: 1, maxWidth: 900, alignSelf: "center" as any, width: "100%" }}
                onRefresh={refetch}
                refreshing={isRefetching}
                numColumns={2}
                columnWrapperStyle={{ gap: 16 }}
                ListEmptyComponent={
                  <EmptyState
                    title="Nenhuma solicitação"
                    description={activeFilter !== "all" || activeUrgency !== "all" || activeDepartment !== "all" ? "Nenhuma solicitação com esses filtros." : "Clique em '+ Nova Solicitação' para criar sua primeira solicitação de compra."}
                    icon="📋"
                  />
                }
                renderItem={({ item }) => (
                  <View style={{ flex: 1 }}>
                    <RequestCard request={item} onPress={() => router.push(`/request/${item.id}` as any)} />
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </ScreenContainer>
    );
  }

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
        <Text className="text-sm text-muted">{filtered.length} {filtered.length === 1 ? "solicitação" : "solicitações"}</Text>
      </View>

      {/* Filtro rápido: Aguardando Minha Ação */}
      {myPendingStatuses.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable
            onPress={() => setMyActionOnly(v => !v)}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 8,
              backgroundColor: myActionOnly ? `${colors.warning}18` : colors.surface,
              borderWidth: 1.5, borderColor: myActionOnly ? colors.warning : colors.border,
              paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
              opacity: pressed ? 0.8 : 1,
              alignSelf: "flex-start",
            })}
          >
            <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: myActionOnly ? colors.warning : colors.border, backgroundColor: myActionOnly ? colors.warning : "transparent", alignItems: "center", justifyContent: "center" }}>
              {myActionOnly && <Text style={{ color: "white", fontSize: 10, fontWeight: "700", lineHeight: 14 }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: myActionOnly ? colors.warning : colors.foreground }}>⏳ Aguardando Minha Ação</Text>
            {myActionOnly && (
              <View style={{ backgroundColor: colors.warning, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{filtered.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}

      {/* Filtro por status */}
      <View className="border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          {FILTER_TABS.map((tab) => (
            <Pressable key={tab.key} onPress={() => setActiveFilter(tab.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className={`px-3 py-1.5 rounded-full border ${activeFilter === tab.key ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                <Text className={`text-xs font-semibold ${activeFilter === tab.key ? "text-white" : "text-muted"}`}>{tab.label}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Filtro por departamento */}
      {departments && departments.length > 0 && (
        <View className="border-b border-border bg-background">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
            <Pressable onPress={() => setActiveDepartment("all")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <View className={`px-3 py-1.5 rounded-full border ${activeDepartment === "all" ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                <Text className={`text-xs font-semibold ${activeDepartment === "all" ? "text-white" : "text-muted"}`}>🏛️ Todos</Text>
              </View>
            </Pressable>
            {(departments ?? []).map((dept: any) => (
              <Pressable key={dept.id} onPress={() => setActiveDepartment(dept.name)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className={`px-3 py-1.5 rounded-full border ${activeDepartment === dept.name ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                  <Text className={`text-xs font-semibold ${activeDepartment === dept.name ? "text-white" : "text-muted"}`}>{dept.name}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filtro por urgência */}
      <View className="border-b border-border bg-background">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          {URGENCY_FILTERS.map((uf) => {
            const isActive = activeUrgency === uf.key;
            const inactiveStyle = "bg-surface border-border";
            const inactiveText = "text-muted";
            return (
              <Pressable key={uf.key} onPress={() => setActiveUrgency(uf.key)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
                <View className={`px-3 py-1.5 rounded-full border ${isActive ? uf.color : inactiveStyle}`}>
                  <Text className={`text-xs font-semibold ${isActive ? uf.textColor : inactiveText}`}>{uf.label}</Text>
                </View>
              </Pressable>
            );
          })}
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
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom + 16, 32), flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <EmptyState
              title="Nenhuma solicitação"
              description={
                activeFilter !== "all" || activeUrgency !== "all"
                  ? "Nenhuma solicitação com esses filtros."
                  : activeDepartment !== "all"
                  ? "Nenhuma solicitação neste departamento."
                  : "Toque em '+ Nova' para criar sua primeira solicitação de compra."
              }
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
