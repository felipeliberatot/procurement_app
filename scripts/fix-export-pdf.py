#!/usr/bin/env python3
import re

path = "app/(tabs)/report.tsx"
content = open(path, "r", encoding="utf-8").read()

# Localizar o bloco da função exportPDF e substituir
old_pattern = r'  async function exportPDF\(\) \{[^}]*?if \(!data\) return;.*?setExporting\(false\);\s*\}\s*\}'
new_func = '''  async function exportPDF() {
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
  }'''

match = re.search(r'  async function exportPDF\(\) \{.*?setExporting\(false\);\n    \}\n  \}', content, re.DOTALL)
if match:
    content = content[:match.start()] + new_func + content[match.end():]
    open(path, "w", encoding="utf-8").write(content)
    print(f"OK: exportPDF substituído (chars {match.start()}-{match.end()})")
else:
    print("ERRO: bloco exportPDF não encontrado")
    # Mostrar contexto para debug
    idx = content.find("async function exportPDF")
    if idx >= 0:
        print(f"Encontrado em {idx}:")
        print(repr(content[idx:idx+200]))
