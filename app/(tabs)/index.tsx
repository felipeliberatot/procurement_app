import { ScreenContainer } from "@/components/screen-container";
import { MetricCard } from "@/components/procurement/MetricCard";
import { useAuth } from "@/hooks/use-auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { redirectToLogin } from "@/lib/redirect-to-login";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText, G } from "react-native-svg";
import type { ProcurementRole, RequestStatus } from "@/shared/types";
import { ROLE_LABELS, STATUS_LABELS } from "@/shared/types";
import { useColors } from "@/hooks/use-colors";

// ─── Gráfico de Tempo Médio de Aprovação ─────────────────────────────────────
function ApprovalTimingChart({ data, colors }: {
  data: { step: string; label: string; avgHours: number; count: number }[];
  colors: ReturnType<typeof useColors>;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  if (!data || data.length === 0) {
    return (
      <View className="bg-surface border border-border rounded-2xl p-6 items-center">
        <Text className="text-3xl mb-2">⏱️</Text>
        <Text className="text-sm text-muted text-center">Sem dados suficientes ainda.{"\n"}Os tempos aparecerão após as primeiras aprovações.</Text>
      </View>
    );
  }

  const maxHours = Math.max(...data.map(d => d.avgHours), 1);
  const BAR_HEIGHT = 28;
  const ROW_GAP = 14;
  const LABEL_WIDTH = isDesktop ? 140 : 110;
  const VALUE_WIDTH = 60;
  const PADDING_H = 16;
  const chartWidth = Math.min(screenWidth - (isDesktop ? 0 : 40), 700);
  const barAreaWidth = chartWidth - LABEL_WIDTH - VALUE_WIDTH - PADDING_H * 2;
  const svgHeight = data.length * (BAR_HEIGHT + ROW_GAP) + 8;

  // Cores por ranking: vermelho → laranja → amarelo → verde
  const barColor = (index: number, total: number) => {
    if (total === 1) return colors.warning;
    const t = index / (total - 1); // 0 = mais lento, 1 = mais rápido
    if (t < 0.33) return colors.error;
    if (t < 0.66) return colors.warning;
    return colors.success;
  };

  const formatHours = (h: number) => {
    if (h < 1) return `${Math.round(h * 60)}min`;
    if (h < 24) return `${h.toFixed(1)}h`;
    return `${(h / 24).toFixed(1)}d`;
  };

  return (
    <View className="bg-surface border border-border rounded-2xl overflow-hidden">
      <View style={{ paddingHorizontal: PADDING_H, paddingTop: 16, paddingBottom: 12 }}>
        <Svg width={chartWidth - PADDING_H * 2} height={svgHeight}>
          {data.map((item, i) => {
            const y = i * (BAR_HEIGHT + ROW_GAP);
            const barW = Math.max((item.avgHours / maxHours) * barAreaWidth, 4);
            const color = barColor(i, data.length);
            const labelFontSize = isDesktop ? 12 : 10;
            const valueFontSize = isDesktop ? 12 : 10;

            return (
              <G key={item.step} y={y}>
                {/* Label da etapa */}
                <SvgText
                  x={0}
                  y={BAR_HEIGHT / 2 + labelFontSize * 0.35}
                  fontSize={labelFontSize}
                  fill={colors.foreground}
                  fontWeight="500"
                >
                  {item.label}
                </SvgText>
                {/* Barra de fundo (track) */}
                <Rect
                  x={LABEL_WIDTH}
                  y={0}
                  width={barAreaWidth}
                  height={BAR_HEIGHT}
                  rx={6}
                  fill={`${color}20`}
                />
                {/* Barra de valor */}
                <Rect
                  x={LABEL_WIDTH}
                  y={0}
                  width={barW}
                  height={BAR_HEIGHT}
                  rx={6}
                  fill={color}
                />
                {/* Valor numérico */}
                <SvgText
                  x={LABEL_WIDTH + barAreaWidth + 8}
                  y={BAR_HEIGHT / 2 + valueFontSize * 0.35}
                  fontSize={valueFontSize}
                  fill={colors.foreground}
                  fontWeight="700"
                >
                  {formatHours(item.avgHours)}
                </SvgText>
                {/* Contador de amostras */}
                <SvgText
                  x={LABEL_WIDTH + barAreaWidth + 8}
                  y={BAR_HEIGHT / 2 + valueFontSize * 0.35 + valueFontSize + 2}
                  fontSize={valueFontSize - 1}
                  fill={colors.muted}
                >
                  {item.count}x
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      {/* Legenda */}
      <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: PADDING_H, paddingBottom: 12 }}>
        {[
          { color: colors.error, label: "Mais lento" },
          { color: colors.warning, label: "Médio" },
          { color: colors.success, label: "Mais rápido" },
        ].map(leg => (
          <View key={leg.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: leg.color }} />
            <Text style={{ fontSize: 10, color: colors.muted }}>{leg.label}</Text>
          </View>
        ))}
        <Text style={{ fontSize: 10, color: colors.muted, marginLeft: "auto" }}>Tempo médio · Nº de aprovações</Text>
      </View>
    </View>
  );
}

// ─── Gráfico Comparativo IA por Categoria ───────────────────────────────────
type CategoryAnalysis = {
  name: string;
  totalPaid: number;
  marketMin: number;
  marketMax: number;
  variation: number;
  status: "OTIMO" | "BOM" | "ADEQUADO" | "ATENCAO" | "CRITICO";
  observation: string;
};

type CategoryAnalysisResult = {
  categories: CategoryAnalysis[];
  overallEfficiency: number;
  summary: string;
  topOpportunity: string;
  generatedAt: string;
};

function CategoryComparisonChart({
  data,
  colors,
  isDesktop,
}: {
  data: CategoryAnalysisResult;
  colors: ReturnType<typeof useColors>;
  isDesktop: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();

  const statusColor = (status: CategoryAnalysis["status"]) => {
    switch (status) {
      case "OTIMO": return colors.success;
      case "BOM": return "#4ADE80";
      case "ADEQUADO": return colors.primary;
      case "ATENCAO": return colors.warning;
      case "CRITICO": return colors.error;
    }
  };
  const statusLabel = (status: CategoryAnalysis["status"]) => {
    switch (status) {
      case "OTIMO": return "Ótimo";
      case "BOM": return "Bom";
      case "ADEQUADO": return "Adequado";
      case "ATENCAO": return "Atenção";
      case "CRITICO": return "Crítico";
    }
  };

  const effColor = data.overallEfficiency <= -10 ? colors.success
    : data.overallEfficiency <= 0 ? colors.primary
    : data.overallEfficiency <= 20 ? colors.warning
    : colors.error;

  const BAR_HEIGHT = 22;
  const ROW_GAP = 10;
  const LABEL_WIDTH = isDesktop ? 150 : 120;
  const VALUE_WIDTH = 70;
  const PADDING_H = 16;
  const chartWidth = Math.min(screenWidth - (isDesktop ? 0 : 40), 700);
  const barAreaWidth = chartWidth - LABEL_WIDTH - VALUE_WIDTH - PADDING_H * 2;

  const maxPaid = Math.max(...data.categories.map(c => c.totalPaid), 1);
  const svgHeight = data.categories.length * (BAR_HEIGHT + ROW_GAP) + 8;
  const labelFontSize = isDesktop ? 11 : 10;

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `R$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
    return `R$${v.toFixed(0)}`;
  };

  return (
    <View className="bg-surface border border-border rounded-2xl overflow-hidden">
      {/* Card de eficiência geral */}
      <View style={{ backgroundColor: `${effColor}15`, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>Eficiência Geral de Compras</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: effColor, marginTop: 2 }}>
              {data.overallEfficiency > 0 ? "+" : ""}{data.overallEfficiency.toFixed(1)}% vs mercado
            </Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${effColor}20`, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>
              {data.overallEfficiency <= -10 ? "🏆" : data.overallEfficiency <= 0 ? "✅" : data.overallEfficiency <= 20 ? "⚠️" : "🚨"}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 16 }}>{data.summary}</Text>
      </View>

      {/* Gráfico de barras por categoria */}
      <View style={{ paddingHorizontal: PADDING_H, paddingTop: 16, paddingBottom: 8 }}>
        <Svg width={chartWidth - PADDING_H * 2} height={svgHeight}>
          {data.categories.map((cat, i) => {
            const y = i * (BAR_HEIGHT + ROW_GAP);
            const barW = Math.max((cat.totalPaid / maxPaid) * barAreaWidth, 4);
            const marketMidW = Math.max(((cat.marketMin + cat.marketMax) / 2 / maxPaid) * barAreaWidth, 4);
            const color = statusColor(cat.status);
            const shortName = cat.name.length > 18 ? cat.name.substring(0, 16) + "…" : cat.name;
            return (
              <G key={cat.name} y={y}>
                {/* Label */}
                <SvgText x={0} y={BAR_HEIGHT / 2 + labelFontSize * 0.35} fontSize={labelFontSize} fill={colors.foreground} fontWeight="500">{shortName}</SvgText>
                {/* Track */}
                <Rect x={LABEL_WIDTH} y={0} width={barAreaWidth} height={BAR_HEIGHT} rx={5} fill={`${color}18`} />
                {/* Barra pago */}
                <Rect x={LABEL_WIDTH} y={0} width={barW} height={BAR_HEIGHT} rx={5} fill={color} opacity={0.85} />
                {/* Linha de mercado médio */}
                <Rect x={LABEL_WIDTH + marketMidW - 1} y={-2} width={2} height={BAR_HEIGHT + 4} rx={1} fill={colors.foreground} opacity={0.4} />
                {/* Valor */}
                <SvgText x={LABEL_WIDTH + barAreaWidth + 4} y={BAR_HEIGHT / 2 + labelFontSize * 0.35} fontSize={labelFontSize} fill={color} fontWeight="700">{formatCurrency(cat.totalPaid)}</SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legenda */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PADDING_H, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 2, height: 14, backgroundColor: colors.foreground, opacity: 0.4, borderRadius: 1 }} />
          <Text style={{ fontSize: 10, color: colors.muted }}>Preço médio de mercado</Text>
        </View>
        <Text style={{ fontSize: 10, color: colors.muted }}>· Barra = valor pago</Text>
      </View>

      {/* Lista de categorias com status */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
        {data.categories.map((cat, i) => (
          <View key={cat.name} style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: i < data.categories.length - 1 ? 1 : 0,
            borderBottomColor: colors.border,
          }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor(cat.status), flexShrink: 0 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{cat.name}</Text>
              <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{cat.observation}</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: `${statusColor(cat.status)}20` }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: statusColor(cat.status) }}>{statusLabel(cat.status)}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: cat.variation > 0 ? colors.error : colors.success, minWidth: 40, textAlign: "right" }}>
              {cat.variation > 0 ? "+" : ""}{cat.variation.toFixed(1)}%
            </Text>
          </View>
        ))}
      </View>

      {/* Oportunidade de economia */}
      {data.topOpportunity && (
        <View style={{ padding: 12, backgroundColor: `${colors.warning}10`, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "700" }}>💡 Oportunidade de Economia</Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{data.topOpportunity}</Text>
        </View>
      )}

      {/* Timestamp */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 }}>
        <Text style={{ fontSize: 10, color: colors.muted }}>Análise gerada em {new Date(data.generatedAt).toLocaleString("pt-BR")}</Text>
      </View>
    </View>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isDesktop } = useBreakpoint();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [isAuthenticated, loading]);

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";

  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: stats, isLoading: statsLoading } = trpc.requests.dashboardStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: allRequests, isLoading: allRequestsLoading } = trpc.requests.all.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: maloteStats, isLoading: maloteLoading } = trpc.malotes.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: pending } = trpc.requests.pendingForMe.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: timingStats, isLoading: timingLoading } = trpc.requests.approvalTimingStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const [categoryAnalysis, setCategoryAnalysis] = useState<CategoryAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analyzeCategories = trpc.ai.analyzePurchasesByCategory.useMutation({
    onSuccess: (data) => {
      setCategoryAnalysis(data as CategoryAnalysisResult);
      setAnalysisError(null);
    },
    onError: (err) => {
      setAnalysisError(err.message);
    },
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 40), maxWidth: isDesktop ? 1200 : undefined, alignSelf: isDesktop ? "center" as any : undefined, width: isDesktop ? "100%" : undefined, paddingHorizontal: isDesktop ? 32 : 0 }}>

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
                  <View className="flex-row gap-3 mb-3">
                    <MetricCard label="Parciais" value={(stats as any)?.partial ?? 0} icon="🔄" color="primary" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "parcialmente_concluida" } })} />
                    <MetricCard label="Rejeitadas" value={stats?.rejected ?? 0} icon="❌" color="error" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "rejeitada" } })} />
                    <MetricCard label="Canceladas" value={(stats as any)?.cancelled ?? 0} icon="🚫" color="muted" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "cancelada" } })} />
                  </View>
                  <View className="flex-row gap-3">
                    <MetricCard label="Emergenciais" value={stats?.emergency ?? 0} icon="🔴" color="error" onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { urgency: "emergencial" } })} />
                    {(userRole === "ceo" || (user as any)?.approvalLevel === "ceo") && (
                      <MetricCard
                        label="Aprov. CEO"
                        value={(allRequests ?? []).filter((r: any) => r.status === "aguardando_aprovacao_ceo").length}
                        icon="👔"
                        color="warning"
                        onPress={() => router.push({ pathname: "/(tabs)/requests" as any, params: { filter: "aguardando_aprovacao_ceo" } })}
                      />
                    )}
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
                  <TouchableOpacity activeOpacity={0.8} onPress={() => router.push("/(tabs)/report" as any)} className="flex-1 bg-surface border border-border rounded-2xl p-4 items-center gap-2">
                    <Text className="text-2xl">📊</Text>
                    <Text className="text-xs font-semibold text-foreground text-center">Relatório</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Gráfico de Tempo de Aprovação */}
            <View className="px-5 mb-5" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
              <View className="flex-row items-center justify-between mb-3">
                <View>
                  <Text className="text-sm font-bold text-foreground">Tempo Médio por Etapa</Text>
                  <Text className="text-xs text-muted mt-0.5">Ranqueado do mais lento ao mais rápido</Text>
                </View>
                <Text className="text-lg">⏱️</Text>
              </View>
              {timingLoading ? (
                <View className="items-center py-6"><ActivityIndicator /></View>
              ) : (
                <ApprovalTimingChart data={timingStats ?? []} colors={colors} />
              )}
            </View>

            {/* Gráfico Comparativo IA por Categoria */}
            <View className="px-5 mb-5" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
              <View className="flex-row items-center justify-between mb-3">
                <View style={{ flex: 1 }}>
                  <Text className="text-sm font-bold text-foreground">Análise de Compras por Categoria</Text>
                  <Text className="text-xs text-muted mt-0.5">Comparativo IA: valor pago vs. preço de mercado</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => analyzeCategories.mutate()}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 6,
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: analyzeCategories.isPending ? colors.muted + "30" : colors.primary,
                  }}
                >
                  {analyzeCategories.isPending ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={{ fontSize: 13 }}>✨</Text>
                  )}
                  <Text style={{ fontSize: 12, fontWeight: "700", color: analyzeCategories.isPending ? colors.muted : colors.background }}>
                    {analyzeCategories.isPending ? "Analisando..." : categoryAnalysis ? "Atualizar" : "Analisar com IA"}
                  </Text>
                </TouchableOpacity>
              </View>

              {analysisError && (
                <View className="bg-error/10 border border-error/30 rounded-2xl p-4 mb-3">
                  <Text className="text-sm text-error">❌ {analysisError}</Text>
                </View>
              )}

              {categoryAnalysis ? (
                <CategoryComparisonChart data={categoryAnalysis} colors={colors} isDesktop={isDesktop} />
              ) : !analyzeCategories.isPending && (
                <View className="bg-surface border border-border rounded-2xl p-6 items-center">
                  <Text className="text-4xl mb-3">🧠</Text>
                  <Text className="text-sm font-semibold text-foreground mb-1">Análise Inteligente de Compras</Text>
                  <Text className="text-xs text-muted text-center mb-4">A IA avalia suas compras concluídas e compara com os preços de mercado, identificando onde você está economizando e onde há oportunidades de melhoria.</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => analyzeCategories.mutate()}
                    style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                  >
                    <Text style={{ color: colors.background, fontWeight: "700", fontSize: 13 }}>✨ Gerar Análise Agora</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                    { icon: "👤", label: "Perfil", desc: "Dados e configurações", route: "/(tabs)/profile" },
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

        {/* Todas as Solicitações — somente visualização */}
        <View className="px-5 mt-6 mb-5" style={isDesktop ? { paddingHorizontal: 0 } : {}}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-foreground">Todas as Solicitações</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/requests" as any)}>
              <Text className="text-xs text-primary font-semibold">Ver todas →</Text>
            </TouchableOpacity>
          </View>
          {allRequestsLoading ? (
            <View className="items-center py-6"><ActivityIndicator /></View>
          ) : !allRequests || allRequests.length === 0 ? (
            <View className="bg-surface border border-border rounded-2xl p-6 items-center">
              <Text className="text-3xl mb-2">📋</Text>
              <Text className="text-sm text-muted text-center">Nenhuma solicitação cadastrada ainda</Text>
            </View>
          ) : (
            <View className="bg-surface border border-border rounded-2xl overflow-hidden">
              {(allRequests.slice(0, isDesktop ? 10 : 5)).map((req: any, index: number, arr: any[]) => (
                <TouchableOpacity
                  key={req.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/request/${req.id}` as any)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: index < arr.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  {/* Status dot */}
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: {
                      rascunho: colors.muted,
                      aguardando_gerente: colors.warning,
                      aguardando_orcamento: colors.warning,
                      aguardando_controladoria: colors.warning,
                      aguardando_diretoria: colors.warning,
                      aguardando_ordem_compra: colors.warning,
                      aguardando_aprovacao_ceo: colors.warning,
                      aguardando_aprovacao_compra: colors.warning,
                      aguardando_comprovante_pagamento: colors.warning,
                      aguardando_verificacao_compras: colors.warning,
                      concluida: colors.success,
                      parcialmente_concluida: colors.primary,
                      rejeitada: colors.error,
                      cancelada: colors.muted,
                    }[req.status as RequestStatus] ?? colors.muted,
                    flexShrink: 0,
                  }} />
                  {/* Info */}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
                      {req.title ?? `Solicitação #${req.id}`}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {req.requesterName ?? "Solicitante"} · {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  {/* Status badge */}
                  {(() => {
                    const statusColor = {
                      rascunho: colors.muted,
                      aguardando_gerente: colors.warning,
                      aguardando_orcamento: colors.warning,
                      aguardando_controladoria: colors.warning,
                      aguardando_diretoria: colors.warning,
                      aguardando_ordem_compra: colors.warning,
                      aguardando_aprovacao_ceo: colors.warning,
                      aguardando_aprovacao_compra: colors.warning,
                      aguardando_comprovante_pagamento: colors.warning,
                      aguardando_verificacao_compras: colors.warning,
                      concluida: colors.success,
                      parcialmente_concluida: colors.primary,
                      rejeitada: colors.error,
                      cancelada: colors.muted,
                    }[req.status as RequestStatus] ?? colors.muted;
                    return (
                      <>
                        <View style={{
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
                          backgroundColor: `${statusColor}20`,
                        }}>
                          <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>
                            {STATUS_LABELS[req.status as RequestStatus] ?? req.status}
                          </Text>
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 14 }}>›</Text>
                      </>
                    );
                  })()}
                </TouchableOpacity>
              ))}
              {allRequests.length > (isDesktop ? 10 : 5) && (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/requests" as any)}
                  style={{ paddingVertical: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                    Ver mais {allRequests.length - (isDesktop ? 10 : 5)} solicitações →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}
// build: 20260722184656
