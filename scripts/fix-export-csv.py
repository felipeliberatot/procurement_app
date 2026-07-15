#!/usr/bin/env python3
import re

path = "app/(tabs)/report.tsx"
content = open(path, "r", encoding="utf-8").read()

old_func = '''    if (!data) return;
    setExporting(true);
    try {
      const header = "Nº Solicitação;Solicitante;Departamento;Aplicação;Status;Urgência;Valor Total;Data Criação;Nº OC;Itens\\n";
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
      ).join("\\n");

      const csvContent = header + rows;
      const fileName = `relatorio_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob(["\\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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
  }'''

new_func = '''    setExporting(true);
    try {
      let csvContent: string;
      let fileName: string;

      if (activeTab === "porbem" && selectedAsset && assetReport) {
        // CSV da aba Por Bem: solicitações do bem selecionado
        const header = "Nº Solicitação;Solicitante;Departamento;Centro de Custo;Urgência;Valor Total;Data Criação;Data Conclusão\\n";
        const rows = (assetReport.requests ?? []).map((r: any) =>
          [
            r.requestNumber ?? r.id,
            `"${r.requesterName ?? ""}"`,
            `"${r.department ?? ""}"`,
            `"${r.costCenter ?? ""}"`,
            r.urgency === "emergencial" ? "Emergencial" : r.urgency === "urgente" ? "Urgente" : "Normal",
            (r.totalEstimatedValue ?? 0).toFixed(2).replace(".", ","),
            r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
            r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("pt-BR") : "",
          ].join(";")
        ).join("\\n");
        csvContent = header + rows;
        const assetCode = assetReport.asset?.code ?? selectedAsset;
        fileName = `bem_${assetCode.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
      } else {
        // CSV das demais abas: relatório mensal
        if (!data) { setExporting(false); return; }
        const header = "Nº Solicitação;Solicitante;Departamento;Aplicação;Status;Urgência;Valor Total;Data Criação;Nº OC;Itens\\n";
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
        ).join("\\n");
        csvContent = header + rows;
        fileName = `relatorio_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.csv`;
      }

      if (Platform.OS === "web") {
        const blob = new Blob(["\\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
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
  }'''

if old_func in content:
    content = content.replace(old_func, new_func, 1)
    open(path, "w", encoding="utf-8").write(content)
    print("OK: exportCSV substituído")
else:
    print("ERRO: bloco exportCSV não encontrado")
    idx = content.find("async function exportCSV")
    if idx >= 0:
        print(f"Encontrado em {idx}:")
        print(repr(content[idx:idx+300]))
