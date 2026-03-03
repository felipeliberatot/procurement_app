import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
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
  const [activeTab, setActiveTab] = useState<"resumo" | "departamentos" | "detalhes">("resumo");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, refetch } = trpc.requests.monthlyReport.useQuery(
    { year: selectedYear, month: selectedMonth },
    { placeholderData: (prev: any) => prev }
  );

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Exportar CSV ─────────────────────────────────────────────────────────────
  async function exportCSV() {
    if (!data) return;
    setExporting(true);
    try {
      const header = "Nº Solicitação;Solicitante;Departamento;Aplicação;Status;Urgência;Valor Total;Data Criação;Nº OC;Itens\n";
      const rows = data.requests.map(r =>
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

      const csvContent = header + rows;
      const fileName = `relatorio_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;

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
    if (!data) return;
    setExporting(true);
    try {
      const monthName = MONTHS[selectedMonth - 1];
      const html = generatePDFHtml(data, monthName, selectedYear);

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
        <Text style={styles.headerTitle}>Relatório Mensal</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.primary }]}
            onPress={exportPDF}
            disabled={exporting || isLoading || !data}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportBtnText}>PDF</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.success }]}
            onPress={exportCSV}
            disabled={exporting || isLoading || !data}
          >
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor de Mês/Ano */}
      <View style={styles.selectorRow}>
        {/* Ano */}
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

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["resumo", "departamentos", "detalhes"] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: colors.primary, fontWeight: "700" }]}>
              {tab === "resumo" ? "Resumo" : tab === "departamentos" ? "Departamentos" : "Detalhes"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Conteúdo */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Carregando relatório...</Text>
        </View>
      ) : !data || data.requests.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Nenhuma solicitação em {MONTHS[selectedMonth - 1]} de {selectedYear}.</Text>
        </View>
      ) : activeTab === "resumo" ? (
        <ResumoTab data={data} colors={colors} styles={styles} />
      ) : activeTab === "departamentos" ? (
        <DepartamentosTab data={data} colors={colors} styles={styles} />
      ) : (
        <DetalhesTab data={data} colors={colors} styles={styles} />
      )}
    </ScreenContainer>
  );
}

// ── Aba Resumo ────────────────────────────────────────────────────────────────
function ResumoTab({ data, colors, styles }: any) {
  const s = data.summary;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Cards de resumo */}
      <View style={styles.cardGrid}>
        <SummaryCard label="Total" value={s.total} color={colors.primary} styles={styles} />
        <SummaryCard label="Concluídas" value={s.concluidas} color={colors.success} styles={styles} />
        <SummaryCard label="Pendentes" value={s.pendentes} color={colors.warning} styles={styles} />
        <SummaryCard label="Rejeitadas" value={s.rejeitadas} color={colors.error} styles={styles} />
        <SummaryCard label="Canceladas" value={s.canceladas} color={colors.muted} styles={styles} />
      </View>

      {/* Valor total */}
      <View style={[styles.card, { marginTop: 8 }]}>
        <Text style={styles.cardLabel}>Valor Total do Período</Text>
        <Text style={[styles.cardValue, { color: colors.primary, fontSize: 22 }]}>
          {formatCurrency(s.totalValue)}
        </Text>
      </View>

      {/* Por urgência */}
      {data.byUrgency.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Por Urgência</Text>
          {data.byUrgency.map((u: any) => (
            <View key={u.urgency} style={styles.tableRow}>
              <Text style={styles.tableCell}>{URGENCY_LABELS[u.urgency as keyof typeof URGENCY_LABELS] ?? u.urgency}</Text>
              <Text style={[styles.tableCell, { fontWeight: "700", color: colors.foreground }]}>{u.count}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Por status */}
      {data.byStatus.length > 0 && (
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>Por Status</Text>
          {data.byStatus.map((s: any) => (
            <View key={s.status} style={styles.tableRow}>
              <Text style={styles.tableCell}>{STATUS_LABELS[s.status as keyof typeof STATUS_LABELS] ?? s.status}</Text>
              <Text style={[styles.tableCell, { fontWeight: "700", color: colors.foreground }]}>{s.count}</Text>
            </View>
          ))}
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

// ── Aba Departamentos ─────────────────────────────────────────────────────────
function DepartamentosTab({ data, colors, styles }: any) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {data.byDepartment.map((dept: any) => (
        <View key={dept.department} style={[styles.card, { marginBottom: 8 }]}>
          <Text style={styles.deptName}>{dept.department}</Text>
          <View style={styles.deptRow}>
            <DeptStat label="Total" value={dept.total} color={colors.primary} />
            <DeptStat label="Concluídas" value={dept.concluidas} color={colors.success} />
            <DeptStat label="Pendentes" value={dept.pendentes} color={colors.warning} />
            <DeptStat label="Rejeit./Canc." value={dept.rejeitadas} color={colors.error} />
          </View>
          <Text style={[styles.deptValue, { color: colors.primary }]}>
            {formatCurrency(dept.totalValue)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function DeptStat({ label, value, color }: any) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: "#888", textAlign: "center" }}>{label}</Text>
    </View>
  );
}

// ── Aba Detalhes ──────────────────────────────────────────────────────────────
function DetalhesTab({ data, colors, styles }: any) {
  return (
    <FlatList
      data={data.requests}
      keyExtractor={(item: any) => String(item.id)}
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
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginHorizontal: 0,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
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
      marginBottom: 8,
    },
    tableRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableCell: {
      fontSize: 12,
      color: colors.muted,
    },
    deptName: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
    },
    deptRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    deptValue: {
      fontSize: 13,
      fontWeight: "600",
      textAlign: "right",
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
