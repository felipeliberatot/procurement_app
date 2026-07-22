/**
 * Rota de impressão: GET /api/print/:id
 * Retorna o HTML completo da solicitação formatado para impressão.
 * Autenticação via cookie de sessão (mesmo mecanismo do tRPC).
 */
import type { Express } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aguardando_gerente: "Aguard. Gerente",
  aguardando_orcamento: "Aguard. Orçamento",
  aguardando_controladoria: "Aguard. Controladoria",
  aguardando_diretoria: "Aguard. Diretoria",
  aguardando_aprovacao_ceo: "Aguard. CEO",
  aguardando_emissao_oc: "Aguard. Emissão OC",
  aguardando_aprovacao_compras: "Aguard. Aprovação Compras",
  aguardando_verificacao_compras: "Aguard. Verificação Compras",
  concluida: "Concluída",
  rejeitada: "Rejeitada",
};

const URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgente: "Urgente",
  emergencial: "Emergencial",
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao_credito: "Cartão de Crédito",
  cartao_parcelado: "Cartão Parcelado",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
};

const STEP_LABELS: Record<string, string> = {
  criacao: "Criação",
  gerente: "Gerente",
  orcamento: "Orçamento",
  controladoria: "Controladoria",
  diretoria: "Diretoria",
  ceo: "CEO",
  emissao_oc: "Emissão de OC",
  aprovacao_compras: "Aprovação Compras",
  verificacao_compras: "Verificação Compras",
  financeiro: "Financeiro",
};

const ACTION_LABELS: Record<string, string> = {
  solicitado: "📝 Solicitado",
  aprovado: "✅ Aprovado",
  rejeitado: "❌ Rejeitado",
  orcamento_enviado: "📄 Orçamento anexado",
  oc_emitida: "🛒 OC emitida",
  compra_aprovada: "✅ Compra aprovada",
  oc_finalizada: "✅ OC finalizada",
  reaberto: "🔄 Reaberto",
  comentario: "💬 Comentário",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/Cuiaba",
  });
}

function fmt(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  if (isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function registerPrintRoute(app: Express) {
  app.get("/api/print/:id", async (req, res) => {
    // 1. Autenticar
    let user: any = null;
    try {
      user = await sdk.authenticateRequest(req as any);
    } catch {
      return res.status(401).send(`<html><body style="font-family:sans-serif;padding:40px">
        <h2>Sessão expirada</h2><p>Faça login novamente para imprimir.</p>
        <a href="/api/app/login">Fazer login</a></body></html>`);
    }
    if (!user) {
      return res.status(401).send(`<html><body style="font-family:sans-serif;padding:40px">
        <h2>Acesso negado</h2><p>Faça login para imprimir.</p>
        <a href="/api/app/login">Fazer login</a></body></html>`);
    }

    // 2. Buscar dados
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send("ID inválido");

    let req_data: any = null;
    let history: any[] = [];
    let quotationData: any = null;

    try {
      req_data = await db.getPurchaseRequestWithDetails(id);
      history = (await db.getApprovalHistory(id)) ?? [];
      quotationData = await db.getQuotationGroupByRequestId(id);
    } catch (err) {
      console.error("[Print] Erro ao buscar dados:", err);
      return res.status(500).send("Erro ao buscar dados da solicitação.");
    }

    if (!req_data) {
      return res.status(404).send("Solicitação não encontrada.");
    }

    const r = req_data as any;
    const statusLabel = STATUS_LABELS[r.status] ?? r.status ?? "—";
    const urgLabel = URGENCY_LABELS[r.urgencyLevel] ?? r.urgencyLevel ?? "Normal";
    const paymentMethodLabel = PAYMENT_LABELS[r.paymentMethod] ?? r.paymentMethod ?? "—";

    const statusColor = r.status === "concluida" ? "#166534" : r.status === "rejeitada" ? "#dc2626" : "#1d4ed8";
    const statusBg = r.status === "concluida" ? "#dcfce7" : r.status === "rejeitada" ? "#fef2f2" : "#dbeafe";
    const urgColor = r.urgencyLevel === "emergencial" ? "#dc2626" : r.urgencyLevel === "urgente" ? "#d97706" : "#166534";

    // Tipo/classificação
    const fuelTypeLabels: Record<string, string> = {
      diesel_s10: "Diesel S-10", diesel_s500: "Diesel S-500",
      gasolina: "Gasolina", etanol: "Etanol", arla: "ARLA 32",
      oleo_motor: "Óleo de Motor", oleo_hidraulico: "Óleo Hidráulico",
      oleo_cambio: "Óleo de Câmbio", graxas: "Graxas / Lubrificantes",
      outro: "Outro",
    };
    const maintenanceTypeLabels: Record<string, string> = {
      preventiva: "Manutenção Preventiva", corretiva: "Manutenção Corretiva",
    };
    const tipoClassificacao = r.fuelType
      ? (fuelTypeLabels[r.fuelType] ?? r.fuelType)
      : r.maintenanceType
        ? (maintenanceTypeLabels[r.maintenanceType] ?? r.maintenanceType)
        : null;

    // Itens
    const items: any[] = r.items ?? [];
    const itemStatusLabel = (s: string) => {
      const m: Record<string, string> = {
        comprado: "✅ Comprado", autorizado: "✅ Autorizado",
        parcial: "⚠️ Parcial", pendente: "⏳ Pendente",
      };
      return m[s] ?? s ?? "—";
    };
    const itemsRows = items.map((item: any) => {
      const qty = item.quantity != null ? `${Number(item.quantity).toLocaleString("pt-BR")} ${item.unit ?? ""}`.trim() : "—";
      const unitPrice = item.unitPrice != null ? fmt(item.unitPrice) : "—";
      const total = item.totalPrice != null ? fmt(item.totalPrice) : (item.unitPrice != null && item.quantity != null ? fmt(parseFloat(String(item.unitPrice).replace(",", ".")) * parseFloat(String(item.quantity).replace(",", "."))) : "—");
      const sit = itemStatusLabel(item.fulfillmentStatus ?? item.status ?? "pendente");
      return `<tr style="background:#fff">
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px">${escHtml(item.description)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px">${escHtml(qty)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px">${unitPrice}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;font-weight:600">${total}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px;color:#166534">${sit}</td>
      </tr>`;
    }).join("");

    // Cotações
    const suppliers: any[] = quotationData?.suppliers ?? [];
    const selectedSupplierId = quotationData?.selectedSupplierId ?? null;
    const selectedSupplier = suppliers.find((s: any) => s.id === selectedSupplierId) ?? null;

    const suppliersHTML = suppliers.map((s: any, i: number) => {
      const isSelected = s.id === selectedSupplierId;
      let supplierItems: any[] = [];
      try {
        const raw = s.items;
        if (typeof raw === "string" && raw.trim().startsWith("[")) {
          supplierItems = JSON.parse(raw);
        } else if (Array.isArray(raw)) {
          supplierItems = raw;
        }
      } catch { supplierItems = []; }
      const itemTags = supplierItems.map((si: any) => {
        const desc = typeof si === "object" && si !== null ? (si.description ?? "") : "";
        const qty = typeof si === "object" && si !== null ? `${si.quantity ?? ""} ${si.unit ?? ""}`.trim() : "";
        const price = typeof si === "object" && si !== null ? fmt(si.unitPrice) : "";
        if (!desc) return "";
        return `<span style="display:inline-block;background:#f1f5f9;border-radius:4px;padding:2px 7px;margin:2px 2px 0 0;font-size:10px;color:#374151">${escHtml(desc)}${qty ? ` · ${escHtml(qty)}` : ""}${price && price !== "—" ? ` · ${price}` : ""}</span>`;
      }).filter(Boolean).join("");
      return `<div style="border:${isSelected ? "2px solid #16a34a" : "1px solid #e5e7eb"};border-radius:8px;padding:10px 12px;margin-bottom:8px;background:${isSelected ? "#f0fdf4" : "#fff"}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px">
            ${isSelected
              ? `<span style="background:#16a34a;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px">⭐ SELECIONADO</span>`
              : `<span style="background:#f3f4f6;color:#6b7280;font-size:9px;font-weight:600;padding:2px 8px;border-radius:20px">${i + 1}º Fornecedor</span>`}
            <span style="font-size:12px;font-weight:700;color:${isSelected ? "#166534" : "#111827"}">${escHtml(s.supplierName)}</span>
          </div>
          <span style="font-size:14px;font-weight:800;color:${isSelected ? "#166534" : "#374151"}">${fmt(s.totalValue)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 12px;margin-bottom:${itemTags ? "6px" : "0"}">
          ${s.paymentTerms ? `<div><span style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:600">Cond. Pagamento</span><br><span style="font-size:10px;color:#374151;font-weight:600">${escHtml(s.paymentTerms)}</span></div>` : ""}
          ${s.deliveryDays != null ? `<div><span style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:600">Prazo Entrega</span><br><span style="font-size:10px;color:#374151;font-weight:600">${s.deliveryDays} dias</span></div>` : ""}
          ${s.supplierContact ? `<div><span style="font-size:8px;color:#9ca3af;text-transform:uppercase;font-weight:600">Contato</span><br><span style="font-size:10px;color:#374151;font-weight:600">${escHtml(s.supplierContact)}</span></div>` : ""}
        </div>
        ${itemTags ? `<div>${itemTags}</div>` : ""}
        ${s.observations ? `<div style="margin-top:4px;font-size:10px;color:#6b7280;font-style:italic">${escHtml(s.observations)}</div>` : ""}
      </div>`;
    }).join("");

    // Histórico
    const historyRows = history.map((h: any, i: number) => {
      const actionLabel = ACTION_LABELS[h.action] ?? h.action ?? "—";
      const stepLabel = STEP_LABELS[h.step] ?? h.step ?? "—";
      const actionColor = h.action === "aprovado" || h.action === "compra_aprovada" || h.action === "oc_finalizada"
        ? "#166534"
        : h.action === "rejeitado" ? "#dc2626"
        : "#1d4ed8";
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td>${fmtDate(h.createdAt)}</td>
        <td style="font-weight:600">${escHtml(h.userName ?? h.userId ?? "—")}</td>
        <td style="color:#6b7280">${stepLabel}</td>
        <td style="font-weight:700;color:${actionColor}">${actionLabel}</td>
        <td style="font-style:italic;color:#374151">${h.comment ? `"${escHtml(h.comment)}"` : "—"}</td>
      </tr>`;
    }).join("");

    // Valor principal
    const valorPrincipal = r.orderValue ?? r.totalEstimatedValue ?? null;
    const valorLabel = r.orderValue ? "Valor da Ordem de Compra" : "Valor Estimado Total";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(r.requestNumber ?? `#${r.id}`)} — CGS Agrícola</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1a1a1a; background: #fff; padding: 10mm; }
    @page { size: A4; margin: 10mm; }
    @media print {
      body { padding: 0; zoom: 90%; }
      .no-print { display: none !important; }
    }

    .print-btn { position: fixed; top: 16px; right: 16px; background: #166534; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .print-btn:hover { background: #14532d; }

    .header { background: linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%); color: #fff; padding: 12px 16px 10px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header-left .company { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; margin-bottom: 3px; }
    .header-left .req-number { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
    .header-left .req-app { font-size: 11px; opacity: 0.9; margin-top: 3px; font-weight: 500; }
    .header-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; letter-spacing: 0.04em; background: ${statusBg}; color: ${statusColor}; border: 2px solid ${statusColor}44; }
    .urgency-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 9px; font-weight: 700; background: ${r.urgencyLevel === "emergencial" ? "#fef2f2" : r.urgencyLevel === "urgente" ? "#fffbeb" : "#f0fdf4"}; color: ${urgColor}; border: 1.5px solid ${urgColor}44; }
    .date-info { font-size: 8px; opacity: 0.75; }

    .section { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
    .section.no-break { page-break-inside: avoid; }
    .section-header { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 6px 12px; display: flex; align-items: center; gap: 6px; }
    .sec-icon { font-size: 11px; }
    .sec-title { font-size: 9px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.07em; }
    .section-body { padding: 10px 12px; }

    .fields-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 20px; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field.full { grid-column: 1 / -1; }
    .field-label { font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.07em; }
    .field-value { font-size: 11px; font-weight: 600; color: #111827; line-height: 1.3; }

    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead tr { background: #f1f5f9; }
    .items-table th { padding: 6px 10px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; text-align: left; border-bottom: 2px solid #e2e8f0; }
    .items-table th.right { text-align: right; }
    .items-table th.center { text-align: center; }
    .items-table td { vertical-align: middle; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }

    .history-table { width: 100%; border-collapse: collapse; }
    .history-table thead tr { background: #f1f5f9; }
    .history-table th { padding: 4px 6px; font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; text-align: left; border-bottom: 2px solid #e2e8f0; }
    .history-table td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; font-size: 9px; vertical-align: middle; line-height: 1.3; }

    .valor-final-box { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #16a34a; border-radius: 10px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; }
    .vf-label { font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.06em; }
    .vf-sub { font-size: 9px; color: #4ade80; margin-top: 2px; }
    .vf-value { font-size: 26px; font-weight: 900; color: #14532d; letter-spacing: -1px; }

    .footer { margin-top: 12px; padding-top: 8px; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; page-break-inside: avoid; }
    .footer-brand { font-size: 10px; font-weight: 800; color: #166534; }
    .footer-sub { font-size: 8px; color: #9ca3af; margin-top: 1px; }
    .footer-right { font-size: 8px; color: #9ca3af; text-align: right; }
  </style>
</head>
<body>

  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="header-left">
      <div class="company">CGS Agrícola · Sistema de Gestão de Compras</div>
      <div class="req-number">${escHtml(r.requestNumber ?? `#${r.id}`)}</div>
      <div class="req-app">${escHtml(r.application ?? "Solicitação de Compra")}</div>
    </div>
    <div class="header-right">
      <div class="status-badge">${escHtml(statusLabel)}</div>
      <div class="urgency-badge">${escHtml(urgLabel)}</div>
      <div class="date-info">Emitido em ${fmtDate(new Date())}</div>
      ${r.completedAt ? `<div class="date-info">Concluído em ${fmtDate(r.completedAt)}</div>` : ""}
    </div>
  </div>

  <!-- INFORMAÇÕES GERAIS -->
  <div class="section no-break">
    <div class="section-header"><span class="sec-icon">📋</span><span class="sec-title">Informações Gerais</span></div>
    <div class="section-body">
      <div class="fields-grid">
        <div class="field"><span class="field-label">Solicitante</span><span class="field-value">${escHtml(r.requesterName ?? "—")}</span></div>
        <div class="field"><span class="field-label">Departamento</span><span class="field-value">${escHtml(r.department ?? "—")}</span></div>
        <div class="field"><span class="field-label">Centro de Custo</span><span class="field-value">${escHtml(r.costCenterCode ?? "—")}${r.costCenterName ? ` — ${escHtml(r.costCenterName)}` : ""}</span></div>
        <div class="field"><span class="field-label">Data da Solicitação</span><span class="field-value">${fmtDate(r.createdAt)}</span></div>
        ${r.farmName ? `<div class="field"><span class="field-label">Fazenda / Unidade</span><span class="field-value">${escHtml(r.farmName)}</span></div>` : ""}
        ${r.harvestName ? `<div class="field"><span class="field-label">Safra</span><span class="field-value">${escHtml(r.harvestName)}</span></div>` : ""}
        ${tipoClassificacao ? `<div class="field"><span class="field-label">Tipo / Classificação</span><span class="field-value">${escHtml(tipoClassificacao)}</span></div>` : ""}
        ${r.purchaseOrderNumber ? `<div class="field"><span class="field-label">Nº Ordem de Compra</span><span class="field-value">${escHtml(r.purchaseOrderNumber)}</span></div>` : ""}
        ${r.osMyfarm ? `<div class="field"><span class="field-label">OS MyFarm</span><span class="field-value">${escHtml(r.osMyfarm)}</span></div>` : ""}
        ${r.completedAt ? `<div class="field"><span class="field-label">Data de Conclusão</span><span class="field-value">${fmtDate(r.completedAt)}</span></div>` : ""}
        ${r.observations ? `<div class="field full"><span class="field-label">Observações</span><span class="field-value" style="font-weight:400;color:#374151">${escHtml(r.observations)}</span></div>` : ""}
      </div>
    </div>
  </div>

  <!-- ITENS SOLICITADOS -->
  ${items.length > 0 ? `
  <div class="section no-break">
    <div class="section-header"><span class="sec-icon">📦</span><span class="sec-title">Itens Solicitados (${items.length})</span></div>
    <div style="padding:0">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:42%">Descrição</th>
            <th class="center" style="width:13%">Qtd</th>
            <th class="right" style="width:14%">Vl. Unit.</th>
            <th class="right" style="width:14%">Total</th>
            <th class="center" style="width:17%">Situação</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>
  </div>` : ""}

  <!-- COTAÇÕES DE FORNECEDORES -->
  ${suppliersHTML ? `
  <div class="section no-break">
    <div class="section-header"><span class="sec-icon">🏪</span><span class="sec-title">Cotações de Fornecedores (${suppliers.length})</span></div>
    <div class="section-body">${suppliersHTML}</div>
  </div>` : ""}

  <!-- PAGAMENTO -->
  ${r.paymentMethod ? `
  <div class="section no-break">
    <div class="section-header"><span class="sec-icon">💳</span><span class="sec-title">Informações de Pagamento</span></div>
    <div class="section-body">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 20px">
        <div style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Forma de Pagamento</span>
          <span style="font-size:12px;font-weight:800;color:#1e3a8a">${escHtml(paymentMethodLabel)}</span>
        </div>
        ${r.paymentInstallments && r.paymentMethod === "cartao_parcelado" ? `
        <div style="display:flex;flex-direction:column;gap:2px">
          <span style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Parcelas</span>
          <span style="font-size:12px;font-weight:800;color:#1e3a8a">${r.paymentInstallments}x</span>
        </div>` : ""}
        ${r.paymentInfo ? `
        <div style="display:flex;flex-direction:column;gap:2px;grid-column:1/-1">
          <span style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Dados / Chave PIX / Banco</span>
          <span style="font-size:11px;font-weight:600;color:#374151">${escHtml(r.paymentInfo)}</span>
        </div>` : ""}
        ${r.paymentObservations ? `
        <div style="display:flex;flex-direction:column;gap:2px;grid-column:1/-1">
          <span style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.07em">Observações de Pagamento</span>
          <span style="font-size:11px;font-weight:400;color:#374151">${escHtml(r.paymentObservations)}</span>
        </div>` : ""}
      </div>
    </div>
  </div>` : ""}

  <!-- HISTÓRICO DE APROVAÇÕES -->
  ${historyRows ? `
  <div class="section">
    <div class="section-header"><span class="sec-icon">📅</span><span class="sec-title">Histórico de Aprovações</span></div>
    <div style="padding:0">
      <table class="history-table">
        <thead>
          <tr>
            <th style="width:18%">Data / Hora</th>
            <th style="width:22%">Usuário</th>
            <th style="width:18%">Etapa</th>
            <th style="width:18%">Ação</th>
            <th style="width:24%">Comentário</th>
          </tr>
        </thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>
  </div>` : ""}

  <!-- VALOR FINAL EM DESTAQUE -->
  ${valorPrincipal != null ? `
  <div class="valor-final-box">
    <div>
      <div class="vf-label">${escHtml(valorLabel)}</div>
      <div class="vf-sub">${selectedSupplier ? `Fornecedor: ${escHtml(selectedSupplier.supplierName)}` : r.paymentMethod ? `Pagamento: ${escHtml(paymentMethodLabel)}` : "Valor total confirmado"}</div>
    </div>
    <div class="vf-value">${fmt(valorPrincipal)}</div>
  </div>` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <div>
      <div class="footer-brand">CGS Agrícola</div>
      <div class="footer-sub">Sistema de Gestão de Compras · Documento gerado em ${fmtDate(new Date())}</div>
    </div>
    <div class="footer-right">
      <div style="font-weight:700;color:#374151">${escHtml(r.requestNumber ?? `#${r.id}`)}</div>
      <div>${escHtml(statusLabel)}</div>
    </div>
  </div>

</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
  });
}
