import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { STATUS_LABELS, URGENCY_LABELS } from "@/shared/types";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

export default function ReportScreen() {
  const colors = useColors();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<"resumo" | "tendencia" | "rankings" | "usuarios" | "detalhes" | "porbem">("resumo");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null); // kept for CSV/PDF compat
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]); // multi-select
  const [assetSearch, setAssetSearch] = useState("");
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { isDesktop } = useBreakpoint();

  const { data, isLoading, isFetching } = trpc.requests.monthlyReport.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const { data: rankingCC, isLoading: loadingCC } = trpc.requests.rankingByCostCenter.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const { data: rankingItem, isLoading: loadingItem } = trpc.requests.rankingByItem.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const { data: rankingUser, isLoading: loadingUser } = trpc.requests.rankingByUser.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const { data: purchaseTrend, isLoading: loadingTrend } = trpc.requests.purchaseTrend.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const { data: partialStats } = trpc.requests.partialFulfillmentStats.useQuery();
  const { data: assetsList } = trpc.assets.list.useQuery();
  const { data: assetReport, isLoading: loadingAssetReport } = trpc.requests.requestsByAsset.useQuery(
    { application: selectedAsset ?? "", year: selectedYear, month: selectedMonth },
    { enabled: !!selectedAsset && selectedAssets.length <= 1, placeholderData: (prev: any) => prev }
  );
  const { data: assetsReports, isLoading: loadingAssetsReports } = trpc.requests.requestsByAssets.useQuery(
    { applications: selectedAssets, year: selectedYear, month: selectedMonth },
    { enabled: selectedAssets.length > 0, placeholderData: (prev: any) => prev }
  );
  const filteredAssets = (assetsList ?? []).filter((a: any) =>
    !assetSearch || a.code.toLowerCase().includes(assetSearch.toLowerCase()) || a.description.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Exportar CSV ─────────────────────────────────────────────────────────────
  async function exportCSV() {
    setExporting(true);
    try {
      let csvContent: string;
      let fileName: string;

      if (activeTab === "porbem" && selectedAsset && assetReport) {
        // CSV da aba Por Bem: solicitações do bem selecionado
        const header = "Nº Solicitação;Solicitante;Departamento;Centro de Custo;Urgência;Valor Total;Data Criação;Data Conclusão\n";
        const rows = (assetReport.requests ?? []).map((r: any) =>
          [
            r.requestNumber ?? r.id,
            `"${r.requesterName ?? ""}"`,
            `"${r.department ?? ""}"`,
            `"${r.costCenterCode ?? ""}"`,
            r.urgencyLevel === "emergencial" ? "Emergencial" : r.urgencyLevel === "urgente" ? "Urgente" : "Normal",
            (r.orderValue || r.totalEstimatedValue) ? parseFloat(r.orderValue ?? r.totalEstimatedValue ?? "0").toFixed(2).replace(".", ",") : "",
            r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
            r.completedAt ? new Date(r.completedAt).toLocaleDateString("pt-BR") : "",
          ].join(";")
        ).join("\n");
        csvContent = header + rows;
        const assetCode = (assetReport as any).asset?.code ?? selectedAsset;
        fileName = `bem_${assetCode.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
      } else {
        // CSV das demais abas: relatório mensal
        if (!data) { setExporting(false); return; }
        const header = "Nº Solicitação;Solicitante;Departamento;Aplicação;Status;Urgência;Valor Total;Data Criação;Nº OC;Itens\n";
        const rows = data.requests.map((r: any) =>
          [
            r.requestNumber ?? r.id,
            `"${r.requesterName ?? ""}"`,
            `"${r.department ?? ""}"`,
            `"${r.application ?? ""}"`,
            STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status,
            URGENCY_LABELS[r.urgencyLevel as keyof typeof URGENCY_LABELS] ?? r.urgencyLevel,
            r.totalValue?.toFixed(2).replace(".", ",") ?? "0,00",
            formatDate(r.createdAt),
            r.purchaseOrderNumber ?? "",
            r.itemCount ?? 0,
          ].join(";")
        ).join("\n");
        csvContent = header + rows;
        fileName = `relatorio_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;
      }

      if (Platform.OS === "web") {
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Exportar CSV" });
        }
      }
    } catch (e) {
      console.error("Erro ao exportar CSV:", e);
    } finally {
      setExporting(false);
    }
  }

  // ── Exportar PDF ─────────────────────────────────────────────────────────────
  async function exportPDF() {
    setExporting(true);
    try {
      let html: string;
      if (activeTab === "porbem" && selectedAsset && assetReport) {
        html = generateAssetPDFHtml(assetReport, selectedAsset);
      } else {
        if (!data) { setExporting(false); return; }
        const monthName = MONTHS[selectedMonth - 1];
        html = generatePDFHtml(data, monthName, selectedYear);
      }
      if (Platform.OS === "web") {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.print();
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Exportar PDF" });
        }
      }
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
    } finally {
      setExporting(false);
    }
  }

  const styles = createStyles(colors);

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.primary }, (exporting || (activeTab !== "porbem" ? (isLoading || isFetching || !data) : (loadingAssetReport || !assetReport))) && { opacity: 0.5 }]}
            onPress={exportPDF}
            disabled={exporting || (activeTab !== "porbem" ? (isLoading || isFetching || !data) : (loadingAssetReport || !assetReport))}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isFetching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportBtnText}>PDF</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.success }, (exporting || (activeTab !== "porbem" ? (isLoading || isFetching || !data) : (loadingAssetReport || !assetReport))) && { opacity: 0.5 }]}
            onPress={exportCSV}
            disabled={exporting || (activeTab !== "porbem" ? (isLoading || isFetching || !data) : (loadingAssetReport || !assetReport))}
          >
            {isFetching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportBtnText}>CSV</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
        {([
          { key: "resumo", label: "Resumo" },
          { key: "tendencia", label: "Tendência" },
          { key: "rankings", label: "Rankings" },
          { key: "usuarios", label: "Usuários" },
          { key: "detalhes", label: "Detalhes" },
          { key: "porbem", label: "Por Bem" },
        ] as const).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && { color: colors.primary, fontWeight: "700" }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Seletor de Mês/Ano */}
      <View style={styles.selectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
          {years.map(y => (
            <Pressable
              key={y}
              style={[styles.chip, selectedYear === y && { backgroundColor: colors.primary }]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.chipText, selectedYear === y && { color: "#fff" }]}>{y}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        {MONTHS.map((m, i) => (
          <Pressable
            key={i}
            style={[styles.chip, selectedMonth === i + 1 && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedMonth(i + 1)}
          >
            <Text style={[styles.chipText, selectedMonth === i + 1 && { color: "#fff" }]}>{m.slice(0, 3)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Conteúdo */}
      {activeTab === "porbem" ? (
        <PorBemTab
          assetsList={assetsList ?? []}
          selectedAsset={selectedAsset}
          setSelectedAsset={setSelectedAsset}
          selectedAssets={selectedAssets}
          setSelectedAssets={setSelectedAssets}
          assetSearch={assetSearch}
          setAssetSearch={setAssetSearch}
          showAssetPicker={showAssetPicker}
          setShowAssetPicker={setShowAssetPicker}
          filteredAssets={filteredAssets}
          assetReport={assetReport}
          assetsReports={assetsReports}
          loading={loadingAssetReport || loadingAssetsReports}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          colors={colors}
          styles={styles}
        />
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Carregando relatório...</Text>
        </View>
      ) : !data || data.requests.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Nenhuma solicitação em {MONTHS[selectedMonth - 1]} de {selectedYear}.</Text>
        </View>
      ) : activeTab === "resumo" ? (
        <ResumoTab data={data} colors={colors} styles={styles} partialStats={partialStats} />
      ) : activeTab === "tendencia" ? (
        <TendenciaTab purchaseTrend={purchaseTrend ?? []} loading={loadingTrend} colors={colors} isDesktop={isDesktop} />
      ) : activeTab === "rankings" ? (
        <RankingsTab
          rankingCC={rankingCC ?? []}
          rankingItem={rankingItem ?? []}
          loadingCC={loadingCC}
          loadingItem={loadingItem}
          colors={colors}
          isDesktop={isDesktop}
        />
      ) : activeTab === "usuarios" ? (
        <UsuariosTab rankingUser={rankingUser ?? []} loading={loadingUser} colors={colors} isDesktop={isDesktop} />
      ) : (
        <DetalhesTab data={data} colors={colors} styles={styles} />
      )}
    </ScreenContainer>
  );
}

// ── Gráfico de Barras Horizontal ──────────────────────────────────────────────
function BarChart({ items, colors: c }: { items: { label: string; value: number; color: string }[]; colors: any }) {
  const [width, setWidth] = useState(0);
  const maxVal = Math.max(...items.map(i => i.value), 1);
  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {items.map((item, idx) => {
        const barW = width > 0 ? Math.max((item.value / maxVal) * (width - 90), item.value > 0 ? 6 : 0) : 0;
        return (
          <View key={idx} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: c.muted, width: 90, flexShrink: 0 }} numberOfLines={2}>{item.label}</Text>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ height: 18, backgroundColor: c.border, borderRadius: 4, flex: 1, overflow: "hidden" }}>
                {barW > 0 && (
                  <View style={{ width: barW, height: "100%", backgroundColor: item.color, borderRadius: 4 }} />
                )}
              </View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: item.color, minWidth: 24, textAlign: "right" }}>{item.value}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Aba Resumo ────────────────────────────────────────────────────────────────
function ResumoTab({ data, colors, styles, partialStats }: any) {
  const s = data.summary;
  const rankingByAsset: { application: string; totalGasto: number; count: number }[] = data.rankingByAsset ?? [];
  const maxAssetVal = Math.max(...rankingByAsset.map((a: any) => a.totalGasto), 1);

  const statusItems = [
    { label: "Concluídas", value: s.concluidas, color: colors.success },
    { label: "Pendentes", value: s.pendentes, color: colors.warning },
    { label: "Rejeitadas", value: s.rejeitadas, color: colors.error },
    { label: "Canceladas", value: s.canceladas, color: colors.muted },
  ].filter(i => i.value > 0);
  const urgencyItems = data.byUrgency.map((u: any) => ({
    label: URGENCY_LABELS[u.urgency as keyof typeof URGENCY_LABELS] ?? u.urgency,
    value: u.count,
    color: u.urgency === "emergencial" ? colors.error : u.urgency === "urgente" ? colors.warning : colors.success,
  }));
  const detailedStatusItems = data.byStatus.map((st: any) => ({
    label: STATUS_LABELS[st.status as keyof typeof STATUS_LABELS] ?? st.status,
    value: st.count,
    color: st.status === "concluida" ? colors.success : st.status === "parcialmente_concluida" ? colors.primary : st.status.startsWith("aguardando") ? colors.warning : colors.error,
  }));
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Cards de contagem */}
      <View style={styles.cardGrid}>
        <SummaryCard label="Total" value={s.total} color={colors.primary} styles={styles} />
        <SummaryCard label="Concluídas" value={s.concluidas} color={colors.success} styles={styles} />
        <SummaryCard label="Pendentes" value={s.pendentes} color={colors.warning} styles={styles} />
        <SummaryCard label="Rejeitadas" value={s.rejeitadas} color={colors.error} styles={styles} />
      </View>

      {/* Métricas financeiras */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <View style={[styles.card, { flex: 1, margin: 0 }]}>
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Valor Gasto (OC)</Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.success }} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(s.totalGastoReal ?? 0)}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>Valor real das OCs concluídas</Text>
        </View>
        <View style={[styles.card, { flex: 1, margin: 0 }]}>
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Ticket Médio</Text>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(s.ticketMedio ?? 0)}
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>Por solicitação concluída</Text>
        </View>
      </View>

      {/* Taxa de conclusão */}
      <View style={[styles.card, { marginTop: 8 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Taxa de Conclusão</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: (s.taxaConclusao ?? 0) >= 70 ? colors.success : (s.taxaConclusao ?? 0) >= 40 ? colors.warning : colors.error }}>
            {s.taxaConclusao ?? 0}%
          </Text>
        </View>
        <View style={{ height: 10, backgroundColor: colors.border, borderRadius: 5, overflow: "hidden" }}>
          <View style={{ width: `${s.taxaConclusao ?? 0}%`, height: "100%", backgroundColor: (s.taxaConclusao ?? 0) >= 70 ? colors.success : (s.taxaConclusao ?? 0) >= 40 ? colors.warning : colors.error, borderRadius: 5 }} />
        </View>
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
          {s.concluidas} de {s.total} solicitações concluídas no período
        </Text>
      </View>

      {/* Cumprimento Parcial */}
      {partialStats && partialStats.parciais > 0 && (
        <View style={[styles.card, { marginTop: 8, borderLeftWidth: 4, borderLeftColor: colors.primary }]}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Cumprimento Parcial</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.primary }}>{partialStats.parciais}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Solicitações</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.warning }}>{partialStats.itensPendentes}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Itens Pendentes</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.success }}>{partialStats.itensComprados}</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Itens Comprados</Text>
            </View>
          </View>
        </View>
      )}

      {/* Ranking de Bens por Valor Gasto */}
      {rankingByAsset.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Ranking de Bens por Gasto</Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Top 10 equipamentos com maior valor de OC no período</Text>
          {rankingByAsset.map((asset: any, idx: number) => {
            const barPct = (asset.totalGasto / maxAssetVal) * 100;
            const parts = asset.application.split(" — ");
            const code = parts[0] ?? asset.application;
            const desc = parts[1] ?? "";
            const RANK_COLORS = [colors.error, colors.warning, colors.primary];
            const barColor = idx < 3 ? RANK_COLORS[idx] : colors.muted;
            return (
              <View key={idx} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: barColor, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>{idx + 1}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, flex: 1 }} numberOfLines={1}>{desc || code}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.muted, marginLeft: 26 }}>{code} · {asset.count} solicitação{asset.count !== 1 ? "ões" : ""}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: barColor }}>{formatCurrency(asset.totalGasto)}</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginLeft: 26 }}>
                  <View style={{ width: `${barPct}%`, height: "100%", backgroundColor: barColor, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Gráfico de Status */}
      {statusItems.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Distribuição por Status</Text>
          <View style={{ marginTop: 12 }}>
            <BarChart items={statusItems} colors={colors} />
          </View>
        </View>
      )}

      {/* Gráfico de Urgência */}
      {urgencyItems.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Por Urgência</Text>
          <View style={{ marginTop: 12 }}>
            <BarChart items={urgencyItems} colors={colors} />
          </View>
        </View>
      )}

      {/* Gráfico de Status Detalhado */}
      {detailedStatusItems.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Por Etapa de Aprovação</Text>
          <View style={{ marginTop: 12 }}>
            <BarChart items={detailedStatusItems} colors={colors} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryCard({ label, value, color, styles }: any) {
  return (
    <View style={[styles.summaryCard, { borderLeftColor: color }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

// ── Aba Tendência ─────────────────────────────────────────────────────────────
function TendenciaTab({ purchaseTrend, loading, colors, isDesktop }: any) {
  const [chartWidth, setChartWidth] = useState(0);
  const maxTotal = Math.max(...(purchaseTrend?.map((m: any) => m.total) ?? [0]), 1);
  const maxCount = Math.max(...(purchaseTrend?.map((m: any) => m.count) ?? [0]), 1);
  const chartHeight = isDesktop ? 200 : 160;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : !purchaseTrend || purchaseTrend.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Sem dados de tendência</Text>
      ) : (
        <>
          {/* Gráfico de Valor Total (últimos 6 meses) */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              Valor Total de Compras (6 meses)
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Evolução do valor total das solicitações</Text>
            <View
              onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
              style={{ height: chartHeight, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 20 }}
            >
              {purchaseTrend.map((m: any, idx: number) => {
                const barH = Math.max((m.total / maxTotal) * (chartHeight - 30), 4);
                const barW = chartWidth > 0 ? Math.min((chartWidth / purchaseTrend.length) - 12, 50) : 30;
                return (
                  <View key={idx} style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 9, color: colors.primary, fontWeight: "700", marginBottom: 4 }}>
                      {formatCurrency(m.total).replace("R$\u00a0", "R$")}
                    </Text>
                    <View style={{ width: barW, height: barH, backgroundColor: colors.primary, borderRadius: 4 }} />
                    <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Gráfico de Quantidade (últimos 6 meses) */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              Quantidade de Solicitações (6 meses)
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Total de solicitações vs concluídas por mês</Text>
            <View style={{ height: chartHeight, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 20 }}>
              {purchaseTrend.map((m: any, idx: number) => {
                const barH = Math.max((m.count / maxCount) * (chartHeight - 30), 4);
                const barHConc = Math.max((m.concluidas / maxCount) * (chartHeight - 30), m.concluidas > 0 ? 4 : 0);
                const barW = chartWidth > 0 ? Math.min((chartWidth / purchaseTrend.length) - 16, 24) : 16;
                return (
                  <View key={idx} style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 10, color: colors.foreground, fontWeight: "600", marginBottom: 4 }}>{m.count}</Text>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                      <View style={{ width: barW, height: barH, backgroundColor: colors.primary, borderRadius: 3 }} />
                      <View style={{ width: barW, height: barHConc, backgroundColor: colors.success, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.primary }} />
                <Text style={{ fontSize: 11, color: colors.muted }}>Total</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: colors.success }} />
                <Text style={{ fontSize: 11, color: colors.muted }}>Concluídas</Text>
              </View>
            </View>
          </View>

          {/* Tabela resumo */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>
              Resumo Mensal
            </Text>
            <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted }}>Mês</Text>
              <Text style={{ width: 60, fontSize: 11, fontWeight: "700", color: colors.muted, textAlign: "center" }}>Qtd</Text>
              <Text style={{ width: 60, fontSize: 11, fontWeight: "700", color: colors.muted, textAlign: "center" }}>Concl.</Text>
              <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted, textAlign: "right" }}>Valor</Text>
            </View>
            {purchaseTrend.map((m: any, idx: number) => (
              <View key={idx} style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: idx < purchaseTrend.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <Text style={{ flex: 1, fontSize: 12, color: colors.foreground }}>{m.month}</Text>
                <Text style={{ width: 60, fontSize: 12, color: colors.foreground, textAlign: "center" }}>{m.count}</Text>
                <Text style={{ width: 60, fontSize: 12, color: colors.success, textAlign: "center", fontWeight: "600" }}>{m.concluidas}</Text>
                <Text style={{ flex: 1, fontSize: 12, color: colors.primary, textAlign: "right", fontWeight: "600" }}>{formatCurrency(m.total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ── Aba Usuários ──────────────────────────────────────────────────────────────
function UsuariosTab({ rankingUser, loading, colors, isDesktop }: any) {
  const maxCount = rankingUser.length > 0 ? rankingUser[0].count : 1;
  const maxTotal = rankingUser.length > 0 ? Math.max(...rankingUser.map((u: any) => u.total)) : 1;

  const BAR_COLORS = [
    "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#8b5cf6",
    "#a78bfa", "#c4b5fd", "#6366f1", "#4f46e5", "#4338ca",
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : rankingUser.length === 0 ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Sem dados para o período</Text>
      ) : (
        <>
          {/* Ranking por quantidade de solicitações */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
            <Text style={{ fontSize: isDesktop ? 15 : 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              Top Solicitantes (por quantidade)
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Usuários que mais criaram solicitações no período</Text>
            {rankingUser.map((user: any, idx: number) => (
              <UserBar
                key={idx}
                rank={idx + 1}
                name={user.name}
                department={user.department}
                value={user.count}
                maxValue={maxCount}
                color={BAR_COLORS[idx % BAR_COLORS.length]}
                suffix={`${user.count} solicitaç${user.count !== 1 ? "ões" : "ão"}`}
                isDesktop={isDesktop}
                colors={colors}
              />
            ))}
          </View>

          {/* Ranking por valor total */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: isDesktop ? 15 : 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
              Top Solicitantes (por valor)
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Usuários com maior valor total solicitado</Text>
            {[...rankingUser].sort((a: any, b: any) => b.total - a.total).map((user: any, idx: number) => (
              <UserBar
                key={idx}
                rank={idx + 1}
                name={user.name}
                department={user.department}
                value={user.total}
                maxValue={maxTotal}
                color={BAR_COLORS[idx % BAR_COLORS.length]}
                suffix={formatCurrency(user.total)}
                isDesktop={isDesktop}
                colors={colors}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function UserBar({ rank, name, department, value, maxValue, color, suffix, isDesktop, colors }: any) {
  const [containerWidth, setContainerWidth] = useState(0);
  const ratio = maxValue > 0 ? Math.max(value / maxValue, 0.02) : 0.02;
  const barWidth = containerWidth > 0 ? containerWidth * ratio : 0;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ fontSize: isDesktop ? 13 : 12, fontWeight: "600", color: colors.foreground, flex: 1, marginRight: 8 }} numberOfLines={1}>
          {rank}. {name}
        </Text>
        <Text style={{ fontSize: isDesktop ? 13 : 12, fontWeight: "700", color }}>{suffix}</Text>
      </View>
      <View
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        style={{ height: isDesktop ? 12 : 10, backgroundColor: colors.border, borderRadius: 6, overflow: "hidden" }}
      >
        {barWidth > 0 && (
          <View style={{ width: barWidth, height: "100%", backgroundColor: color, borderRadius: 6 }} />
        )}
      </View>
      <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{department}</Text>
    </View>
  );
}

// ── Aba Rankings ─────────────────────────────────────────────────────────────
function HorizontalBar({ label, value, maxValue, color, subtitle, isDesktop }: {
  label: string; value: number; maxValue: number; color: string; subtitle: string; isDesktop: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);
  const ratio = maxValue > 0 ? Math.max(value / maxValue, 0.02) : 0.02;
  const barWidth = containerWidth > 0 ? containerWidth * ratio : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: isDesktop ? 13 : 12, fontWeight: "600", color: "#374151", flex: 1, marginRight: 8 }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontSize: isDesktop ? 13 : 12, fontWeight: "700", color }}>
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
        </Text>
      </View>
      <View
        onLayout={onLayout}
        style={{ height: isDesktop ? 14 : 12, backgroundColor: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}
      >
        {barWidth > 0 && (
          <View style={{ width: barWidth, height: "100%", backgroundColor: color, borderRadius: 6 }} />
        )}
      </View>
      <Text style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{subtitle}</Text>
    </View>
  );
}

function RankingsTab({ rankingCC, rankingItem, loadingCC, loadingItem, colors, isDesktop }: any) {
  const maxCC = rankingCC.length > 0 ? rankingCC[0].total : 1;
  const maxItem = rankingItem.length > 0 ? rankingItem[0].total : 1;

  const BAR_COLORS = [
    "#0a7ea4", "#0891b2", "#0e7490", "#155e75", "#164e63",
    "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Ranking por Centro de Custo */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
        <Text style={{ fontSize: isDesktop ? 15 : 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
          Ranking por Centro de Custo
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Top 10 centros de custo por valor total gasto</Text>
        {loadingCC ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : rankingCC.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>Sem dados para o período</Text>
        ) : (
          rankingCC.map((item: any, idx: number) => (
            <HorizontalBar
              key={item.code ?? idx}
              label={`${idx + 1}. ${item.label}`}
              value={item.total}
              maxValue={maxCC}
              color={BAR_COLORS[idx % BAR_COLORS.length]}
              subtitle={`${item.count} solicitaç${item.count !== 1 ? "ões" : "ão"}`}
              isDesktop={isDesktop}
            />
          ))
        )}
      </View>

      {/* Ranking por Bem/Item */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ fontSize: isDesktop ? 15 : 14, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
          Ranking por Bem / Item
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 12 }}>Top 10 itens mais solicitados por valor total</Text>
        {loadingItem ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : rankingItem.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>Sem dados para o período</Text>
        ) : (
          rankingItem.map((item: any, idx: number) => (
            <HorizontalBar
              key={item.label + idx}
              label={`${idx + 1}. ${item.label}`}
              value={item.total}
              maxValue={maxItem}
              color={BAR_COLORS[idx % BAR_COLORS.length]}
              subtitle={`${item.count} ocorrênc${item.count !== 1 ? "ias" : "ia"} · ${item.quantity} unid.`}
              isDesktop={isDesktop}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ── Aba Detalhes ──────────────────────────────────────────────────────────────
function DetalhesTab({ data, colors, styles }: any) {
  return (
    <FlatList
      data={data.requests}
      keyExtractor={(item: any) => String(item.id)}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      renderItem={({ item }: any) => (
        <View style={[styles.card, { marginBottom: 8 }]}>
          <View style={styles.detailHeader}>
            <Text style={[styles.detailNumber, { color: colors.primary }]}>
              #{item.requestNumber ?? item.id}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
              <Text style={styles.statusBadgeText}>
                {STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] ?? item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.detailName}>{item.requesterName}</Text>
          <Text style={styles.detailMeta}>{item.department} · {item.application}</Text>
          <View style={styles.detailFooter}>
            <Text style={styles.detailMeta}>{formatDate(item.createdAt)}</Text>
            <Text style={[styles.detailValue, { color: colors.primary }]}>
              {formatCurrency(item.totalValue)}
            </Text>
          </View>
          {item.purchaseOrderNumber ? (
            <Text style={styles.detailMeta}>OC: {item.purchaseOrderNumber}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

function getStatusBg(status: string): string {
  if (status === "concluida") return "#dcfce7";
  if (status === "parcialmente_concluida") return "#dbeafe";
  if (status === "rejeitada" || status === "cancelada") return "#fee2e2";
  if (status.startsWith("aguardando")) return "#fef3c7";
  return "#f3f4f6";
}

// ── HTML para PDF ─────────────────────────────────────────────────────────────
function generatePDFHtml(data: any, monthName: string, year: number): string {
  const s = data.summary;
  const deptRows = data.byDepartment.map((d: any) =>
    `<tr>
      <td>${d.department}</td>
      <td style="text-align:center">${d.total}</td>
      <td style="text-align:center;color:#16a34a">${d.concluidas}</td>
      <td style="text-align:center;color:#d97706">${d.pendentes}</td>
      <td style="text-align:center;color:#dc2626">${d.rejeitadas}</td>
      <td style="text-align:right">${formatCurrency(d.totalValue)}</td>
    </tr>`
  ).join("");

  const detailRows = data.requests.map((r: any) =>
    `<tr>
      <td>${r.requestNumber ?? r.id}</td>
      <td>${r.requesterName ?? ""}</td>
      <td>${r.department ?? ""}</td>
      <td>${STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}</td>
      <td>${URGENCY_LABELS[r.urgencyLevel as keyof typeof URGENCY_LABELS] ?? r.urgencyLevel}</td>
      <td style="text-align:right">${formatCurrency(r.totalValue)}</td>
      <td>${formatDate(r.createdAt)}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin-top: 20px; margin-bottom: 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .summary { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; min-width: 100px; }
  .card .val { font-size: 22px; font-weight: bold; }
  .card .lbl { font-size: 11px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; font-size: 11px; }
  tr:nth-child(even) td { background: #fafafa; }
  .total-value { font-size: 16px; font-weight: bold; color: #0a7ea4; margin-top: 4px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Relatório de Compras — ${monthName} / ${year}</h1>
<p style="color:#666;font-size:11px">Gerado em ${new Date().toLocaleString("pt-BR")}</p>

<div class="summary">
  <div class="card"><div class="val">${s.total}</div><div class="lbl">Total</div></div>
  <div class="card"><div class="val" style="color:#16a34a">${s.concluidas}</div><div class="lbl">Concluídas</div></div>
  <div class="card"><div class="val" style="color:#d97706">${s.pendentes}</div><div class="lbl">Pendentes</div></div>
  <div class="card"><div class="val" style="color:#dc2626">${s.rejeitadas}</div><div class="lbl">Rejeitadas</div></div>
  <div class="card"><div class="val" style="color:#6b7280">${s.canceladas}</div><div class="lbl">Canceladas</div></div>
</div>
<p class="total-value">Valor Total: ${formatCurrency(s.totalValue)}</p>

<h2>Por Departamento</h2>
<table>
  <thead><tr><th>Departamento</th><th>Total</th><th>Concluídas</th><th>Pendentes</th><th>Rejeit./Canc.</th><th>Valor</th></tr></thead>
  <tbody>${deptRows}</tbody>
</table>

<h2>Detalhamento de Solicitações</h2>
<table>
  <thead><tr><th>Nº</th><th>Solicitante</th><th>Departamento</th><th>Status</th><th>Urgência</th><th>Valor</th><th>Data</th></tr></thead>
  <tbody>${detailRows}</tbody>
</table>
</body>
</html>`;
}

// ── Aba Por Bem ─────────────────────────────────────────────────────────────
function PorBemTab({
  assetsList, selectedAsset, setSelectedAsset,
  selectedAssets, setSelectedAssets,
  assetSearch, setAssetSearch,
  showAssetPicker, setShowAssetPicker,
  filteredAssets, assetReport, assetsReports, loading, colors, styles,
  selectedYear, selectedMonth,
}: any) {
  const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const periodoLabel = selectedYear && selectedMonth ? `${MONTH_NAMES[selectedMonth - 1]} de ${selectedYear}` : "Todo o histórico";
  const fmtCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  function toggleAsset(assetKey: string) {
    setSelectedAssets((prev: string[]) => {
      const next = prev.includes(assetKey) ? prev.filter((k: string) => k !== assetKey) : [...prev, assetKey];
      // keep selectedAsset in sync for CSV/PDF compat
      setSelectedAsset(next.length === 1 ? next[0] : next.length > 1 ? next[0] : null);
      return next;
    });
  }

  function selectAll() {
    const allKeys = (assetsList ?? []).map((a: any) => `${a.code} — ${a.description}`);
    setSelectedAssets(allKeys);
    setSelectedAsset(allKeys.length > 0 ? allKeys[0] : null);
  }

  function clearAll() {
    setSelectedAssets([]);
    setSelectedAsset(null);
  }

  const reportsToShow: any[] = assetsReports ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Cabeçalho do seletor */}
      <View style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Bens / Equipamentos</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {selectedAssets.length > 0 && (
              <TouchableOpacity
                style={{ backgroundColor: colors.error + "22", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                onPress={clearAll}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.error }}>Limpar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ backgroundColor: colors.primary + "22", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
              onPress={selectAll}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Selecionar Todos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botão abrir picker */}
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}
          onPress={() => setShowAssetPicker(true)}
        >
          <Text style={{ fontSize: 22 }}>📦</Text>
          <View style={{ flex: 1 }}>
            {selectedAssets.length === 0 ? (
              <Text style={{ fontSize: 15, color: colors.muted }}>Toque para selecionar bens...</Text>
            ) : selectedAssets.length === 1 ? (
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{selectedAssets[0]}</Text>
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{selectedAssets.length} bens selecionados</Text>
            )}
          </View>
          <Text style={{ fontSize: 18, color: colors.muted }}>›</Text>
        </TouchableOpacity>

        {/* Chips dos bens selecionados */}
        {selectedAssets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", gap: 6, paddingBottom: 4 }}>
              {selectedAssets.map((key: string) => {
                const code = key.split(" — ")[0];
                return (
                  <TouchableOpacity
                    key={key}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.primary + "22", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, gap: 5 }}
                    onPress={() => toggleAsset(key)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{code}</Text>
                    <Text style={{ fontSize: 11, color: colors.primary }}>✕</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Competência ativa */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 14, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>Competência:</Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{periodoLabel}</Text>
        {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />}
      </View>

      {/* Cards por bem */}
      {selectedAssets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
          <Text style={[styles.emptyText, { textAlign: "center" }]}>Selecione um ou mais bens, ou toque em "Selecionar Todos" para ver o histórico de compras.</Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Carregando...</Text>
        </View>
      ) : (
        reportsToShow.map((report: any) => {
          const assetKey = report.application;
          const assetObj = (assetsList ?? []).find((a: any) => `${a.code} — ${a.description}` === assetKey
            || assetKey.startsWith(a.code + " — "));
          return (
            <View key={assetKey} style={{ marginBottom: 20 }}>
              {/* Header do bem */}
              <View style={{ backgroundColor: colors.primary + "18", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.primary + "44", flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>📦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }} numberOfLines={1}>
                    {assetObj?.description ?? assetKey.split(" — ")[1] ?? assetKey}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{assetObj?.code ?? assetKey.split(" — ")[0]}{assetObj?.category ? ` · ${assetObj.category}` : ""}</Text>
                </View>
                {/* Mini resumo */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.success }}>{fmtCurrency(report.summary.totalGasto)}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{report.summary.totalSolicitacoes} sol.</Text>
                </View>
              </View>

              {report.requests.length === 0 ? (
                <View style={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhuma solicitação concluída neste período.</Text>
                </View>
              ) : (
                report.requests.map((item: any) => (
                  <View key={item.id} style={[styles.detailCard, { marginBottom: 8 }]}>
                    <View style={styles.detailHeader}>
                      <Text style={styles.detailNumber}>{item.requestNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: item.status === "concluida" ? colors.success + "22" : colors.warning + "22" }]}>
                        <Text style={[styles.statusBadgeText, { color: item.status === "concluida" ? colors.success : colors.warning }]}>
                          {item.status === "concluida" ? "Concluída" : "Parcial"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailMeta}>{item.requesterName} · {item.department}</Text>
                    {item.costCenterCode && <Text style={styles.detailMeta}>CC: {item.costCenterCode}</Text>}
                    {item.observations && <Text style={[styles.detailMeta, { marginTop: 4 }]} numberOfLines={2}>{item.observations}</Text>}
                    <View style={styles.detailFooter}>
                      {(item.orderValue || item.totalEstimatedValue) ? (
                        <Text style={[styles.detailValue, { color: item.orderValue ? colors.success : colors.warning }]}>
                          {fmtCurrency(parseFloat(item.orderValue ?? item.totalEstimatedValue ?? "0"))}
                        </Text>
                      ) : (
                        <Text style={[styles.detailValue, { color: colors.muted, fontStyle: "italic" }]}>Sem valor</Text>
                      )}
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.detailMeta}>
                          {item.completedAt
                            ? `✅ ${new Date(item.completedAt).toLocaleDateString("pt-BR")}`
                            : `Aberto: ${new Date(item.createdAt).toLocaleDateString("pt-BR")}`}
                        </Text>
                        {item.completedAt && (
                          <Text style={[styles.detailMeta, { fontSize: 10, color: colors.muted }]}>
                            Aberto: {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}

      {/* Modal seletor de bem — agora com checkboxes */}
      <Modal visible={showAssetPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAssetPicker(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>📦 Selecionar Bens</Text>
            <TouchableOpacity onPress={() => { setShowAssetPicker(false); setAssetSearch(""); }}>
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "600" }}>Concluir ({selectedAssets.length})</Text>
            </TouchableOpacity>
          </View>
          {/* Selecionar Todos / Limpar */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}
              onPress={() => { selectAll(); }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>✅ Selecionar Todos ({(assetsList ?? []).length})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
              onPress={clearAll}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.muted }}>Limpar seleção</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 12 }}>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 10, fontSize: 14, color: colors.foreground }}
              placeholder="Buscar bem por código ou descrição..."
              placeholderTextColor={colors.muted}
              value={assetSearch}
              onChangeText={setAssetSearch}
            />
          </View>
          <FlatList
            data={filteredAssets}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={({ item }: any) => {
              const key = `${item.code} — ${item.description}`;
              const isSelected = selectedAssets.includes(key);
              return (
                <TouchableOpacity
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: isSelected ? colors.primary + "0D" : "transparent" }}
                  onPress={() => toggleAsset(key)}
                >
                  {/* Checkbox */}
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {isSelected && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>✓</Text>}
                  </View>
                  <View style={{ backgroundColor: colors.primary + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{item.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{item.description}</Text>
                    {item.category && <Text style={{ fontSize: 12, color: colors.muted }}>{item.category}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: "center" }}>
                <Text style={{ color: colors.muted }}>Nenhum bem encontrado.</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function createStyles(colors: any) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
    },
    exportRow: {
      flexDirection: "row",
      gap: 8,
    },
    exportBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      minWidth: 52,
      alignItems: "center",
    },
    exportBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 13,
    },
    selectorRow: {
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    yearScroll: {
      flexGrow: 0,
    },
    monthScroll: {
      flexGrow: 0,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      marginRight: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "600",
    },
    tabRow: {
      flexGrow: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
      minWidth: 80,
    },
    tabText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "500",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 4,
    },
    summaryCard: {
      flex: 1,
      minWidth: 80,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: "700",
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    cardLabel: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
    },
    cardValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    detailHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    detailNumber: {
      fontSize: 14,
      fontWeight: "700",
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#374151",
    },
    detailName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    detailMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    detailFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: "700",
    },
  });
}

function generateAssetPDFHtml(assetReport: any, assetApplication: string): string {
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
  const fmtDate = (d: string | Date) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";

  const rows = (assetReport.requests ?? []).map((r: any) => `
    <tr>
      <td>${r.requestNumber ?? "-"}</td>
      <td>${r.requesterName ?? "-"}</td>
      <td>${r.department ?? "-"}</td>
      <td>${r.costCenterCode ?? "-"}</td>
      <td>${r.urgencyLevel === "emergencial" ? "Emergencial" : r.urgencyLevel === "urgente" ? "Urgente" : "Normal"}</td>
      <td style="text-align:right">${(r.orderValue || r.totalEstimatedValue) ? fmt(parseFloat(r.orderValue ?? r.totalEstimatedValue ?? "0")) : "—"}</td>
      <td>${fmtDate(r.createdAt)}</td>
      <td>${r.completedAt ? fmtDate(r.completedAt) : "-"}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório por Bem</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 24px; }
  h1 { font-size: 18px; color: #1a5c2a; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 11px; margin-bottom: 16px; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; }
  .card { background: #f5f5f5; border-radius: 8px; padding: 12px 20px; min-width: 140px; }
  .card-value { font-size: 22px; font-weight: 800; color: #1a5c2a; }
  .card-label { font-size: 11px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1a5c2a; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
  tr:nth-child(even) td { background: #f9fafb; }
  .asset-code { display: inline-block; background: #e6f4ea; color: #1a5c2a; border-radius: 4px; padding: 2px 8px; font-weight: 700; font-size: 12px; margin-right: 8px; }
</style>
</head>
<body>
<h1>Relatório por Bem</h1>
<div class="subtitle">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
<div style="margin-bottom:16px">
  <span class="asset-code">${assetReport.asset?.code ?? assetApplication}</span>
  <strong>${assetReport.asset?.description ?? assetApplication}</strong>
  ${assetReport.asset?.category ? `<span style="color:#666; margin-left:8px">${assetReport.asset.category}</span>` : ""}
</div>
<div class="summary">
  <div class="card">
    <div class="card-value">${assetReport.summary?.totalSolicitacoes ?? 0}</div>
    <div class="card-label">Solicitações Concluídas</div>
  </div>
  <div class="card">
    <div class="card-value" style="font-size:16px">${fmt(assetReport.summary?.totalGasto ?? 0)}</div>
    <div class="card-label">Total Gasto</div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>Nº</th>
      <th>Solicitante</th>
      <th>Departamento</th>
      <th>Centro de Custo</th>
      <th>Urgência</th>
      <th style="text-align:right">Valor</th>
      <th>Criado em</th>
      <th>Concluído em</th>
    </tr>
  </thead>
  <tbody>
    ${rows || '<tr><td colspan="8" style="text-align:center;color:#999">Nenhuma solicitação encontrada</td></tr>'}
  </tbody>
</table>
</body>
</html>`;
}
