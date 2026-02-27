import nodemailer from "nodemailer";

// ─── E-mail Service ───────────────────────────────────────────────────────────
// Uses SMTP credentials from environment variables.
// Supports Gmail (SMTP_HOST=smtp.gmail.com, SMTP_PORT=587) or other providers.

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured — skipping email send.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

const FROM_NAME = process.env.SMTP_FROM_NAME ?? "CGS Agrícola";
const FROM_EMAIL = process.env.SMTP_USER ?? "noreply@cgs.agr.br";

export async function sendWelcomeEmail(params: {
  toEmail: string;
  toName: string;
  jobTitle?: string;
  loginUrl?: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  // Usa APP_URL (configurável via secret) ou EXPO_WEB_PREVIEW_URL como fallback
  const loginUrl = params.loginUrl
    ?? process.env.APP_URL
    ?? process.env.EXPO_WEB_PREVIEW_URL
    ?? "https://procurement.cgs.agr.br";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bem-vindo ao Sistema de Compras</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agrícola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agrícola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Sistema de Gestão de Compras</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#11181C;font-size:18px;">Olá, ${params.toName}! 👋</h2>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Sua conta foi criada no <strong>Sistema de Gestão de Compras da CGS Agrícola</strong>.
                ${params.jobTitle ? `Você foi cadastrado como <strong>${params.jobTitle}</strong>.` : ""}
              </p>
              <p style="margin:0 0 24px;color:#687076;font-size:14px;line-height:1.6;">
                Para acessar o sistema, clique no botão abaixo e faça login com seu e-mail corporativo:
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#0a7ea4;border-radius:8px;padding:14px 28px;text-align:center;">
                    <a href="${loginUrl}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                      Acessar o Sistema →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#687076;font-size:13px;">
                Ou copie e cole este link no seu navegador:
              </p>
              <p style="margin:0 0 24px;color:#0a7ea4;font-size:13px;word-break:break-all;">
                ${loginUrl}
              </p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
              <p style="margin:0;color:#9BA1A6;font-size:12px;text-align:center;">
                Este e-mail foi enviado automaticamente pelo sistema. Não responda a este e-mail.<br/>
                Em caso de dúvidas, entre em contato com o administrador do sistema.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.toEmail,
      subject: "Bem-vindo ao Sistema de Compras — CGS Agrícola",
      html,
      text: `Olá, ${params.toName}!\n\nSua conta foi criada no Sistema de Gestão de Compras da CGS Agrícola.\n\nAcesse: ${loginUrl}\n\nEm caso de dúvidas, entre em contato com o administrador.`,
    });
    console.log(`[Email] Welcome email sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send welcome email:", err);
    return false;
  }
}

// ─── Daily Report Email ───────────────────────────────────────────────────────

export interface DailyReportRequest {
  requestNumber: string;
  requesterName: string;
  department: string;
  application: string;
  urgencyLevel: string;
  status: string;
  deadlineAt: Date | null;
  totalEstimatedValue: string | null;
  createdAt: Date;
  itemNames?: string; // Nomes dos itens separados por vírgula
}

function urgencyLabel(level: string): string {
  if (level === "emergencial") return "🔴 Emergencial";
  if (level === "urgente") return "🟡 Urgente";
  return "🟢 Normal";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aguardando_gerente: "Aguardando Gerente",
    aguardando_orcamento: "Aguardando Orçamento",
    aguardando_controladoria: "Aguardando Controladoria",
    aguardando_diretoria: "Aguardando Diretoria",
    aguardando_ordem_compra: "Aguardando Ordem de Compra",
    aguardando_financeiro: "Aguardando Financeiro",
    concluida: "Concluída",
    rejeitada: "Rejeitada",
    cancelada: "Cancelada",
  };
  return map[status] ?? status;
}

function formatDeadline(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  return isNaN(num) ? "—" : num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildRequestRow(req: DailyReportRequest, highlight: boolean): string {
  const bg = highlight ? "#FEF2F2" : "#ffffff";
  const border = highlight ? "2px solid #EF4444" : "1px solid #E5E7EB";
  const badge = highlight ? `<span style="background:#EF4444;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;">⚠️ PRAZO CRÍTICO</span>` : "";
  return `
  <tr style="background:${bg};border:${border};">
    <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#0a7ea4;">${req.requestNumber}</td>
    <td style="padding:10px 12px;font-size:13px;">${req.requesterName}</td>
    <td style="padding:10px 12px;font-size:13px;">${req.department}</td>
    <td style="padding:10px 12px;font-size:13px;">${req.itemNames ?? req.application}</td>
    <td style="padding:10px 12px;font-size:12px;">${urgencyLabel(req.urgencyLevel)}</td>
    <td style="padding:10px 12px;font-size:12px;">${statusLabel(req.status)}</td>
    <td style="padding:10px 12px;font-size:12px;">${formatDeadline(req.deadlineAt)} ${badge}</td>
    <td style="padding:10px 12px;font-size:13px;text-align:right;">${formatCurrency(req.totalEstimatedValue)}</td>
  </tr>`;
}

function buildTable(requests: DailyReportRequest[], criticalIds: Set<string>): string {
  if (requests.length === 0) return `<p style="color:#687076;font-size:14px;font-style:italic;">Nenhuma solicitação nesta categoria.</p>`;
  const rows = requests.map(r => buildRequestRow(r, criticalIds.has(r.requestNumber))).join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Nº</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Solicitante</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Depto</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Item(ns)</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Urgência</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Status</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Prazo</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Valor Est.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export async function sendDailyReportEmail(params: {
  toEmail: string;
  toName: string;
  openRequests: DailyReportRequest[];
  completedToday: DailyReportRequest[];
  criticalRequests: DailyReportRequest[];
  date: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const criticalIds = new Set(params.criticalRequests.map(r => r.requestNumber));
  const totalOpen = params.openRequests.length;
  const totalCritical = params.criticalRequests.length;
  const totalCompleted = params.completedToday.length;

  const criticalBanner = totalCritical > 0
    ? `<tr><td style="background:#FEF2F2;border:2px solid #EF4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;color:#DC2626;font-size:15px;font-weight:700;">⚠️ ATENÇÃO: ${totalCritical} solicitação(ões) com prazo vencendo nas próximas 24 horas!</p>
        <p style="margin:4px 0 0;color:#DC2626;font-size:13px;">Verifique as linhas destacadas em vermelho nas tabelas abaixo.</p>
       </td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório Diário — ${params.date}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agrícola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agrícola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Relatório Diário de Compras — ${params.date}</p>
            </td>
          </tr>
          <!-- Summary -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 8px;color:#11181C;font-size:16px;font-weight:700;">Olá, ${params.toName}!</p>
              <p style="margin:0 0 20px;color:#687076;font-size:14px;">Aqui está o resumo das solicitações de compra de hoje.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background:#EFF6FF;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#0a7ea4;">${totalOpen}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Em Aberto</p>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="background:#FEF2F2;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#DC2626;">${totalCritical}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Prazo Crítico (24h)</p>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="background:#F0FDF4;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#16A34A;">${totalCompleted}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Concluídas Hoje</p>
                  </td>
                </tr>
              </table>
              ${criticalBanner}
            </td>
          </tr>
          <!-- Open Requests -->
          <tr>
            <td style="padding:24px 32px 0;">
              <h3 style="margin:0 0 12px;color:#11181C;font-size:15px;border-left:4px solid #0a7ea4;padding-left:10px;">
                📋 Solicitações em Aberto (${totalOpen})
              </h3>
              ${buildTable(params.openRequests, criticalIds)}
            </td>
          </tr>
          <!-- Completed Today -->
          <tr>
            <td style="padding:24px 32px;">
              <h3 style="margin:0 0 12px;color:#11181C;font-size:15px;border-left:4px solid #16A34A;padding-left:10px;">
                ✅ Concluídas Hoje (${totalCompleted})
              </h3>
              ${buildTable(params.completedToday, new Set())}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f5f5;padding:16px 32px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;color:#9BA1A6;font-size:12px;">
                Relatório gerado automaticamente em ${params.date} às 07:00 · CGS Agrícola<br/>
                Não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const textLines = [
    `Relatório Diário de Compras — ${params.date}`,
    `Olá, ${params.toName}!`,
    ``,
    `📊 RESUMO:`,
    `  Em Aberto: ${totalOpen}`,
    `  Prazo Crítico (24h): ${totalCritical}`,
    `  Concluídas Hoje: ${totalCompleted}`,
    ``,
    totalCritical > 0 ? `⚠️ ATENÇÃO: ${totalCritical} solicitação(ões) com prazo vencendo nas próximas 24 horas!\n` : "",
    `📋 SOLICITAÇÕES EM ABERTO:`,
    ...params.openRequests.map(r => `  [${criticalIds.has(r.requestNumber) ? "⚠️ CRÍTICO" : "      "}] ${r.requestNumber} | ${r.requesterName} | ${statusLabel(r.status)} | Prazo: ${formatDeadline(r.deadlineAt)}`),
    ``,
    `✅ CONCLUÍDAS HOJE:`,
    ...params.completedToday.map(r => `  ${r.requestNumber} | ${r.requesterName} | ${formatCurrency(r.totalEstimatedValue)}`),
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.toEmail,
      subject: `📊 Relatório Diário de Compras — ${params.date}${totalCritical > 0 ? ` ⚠️ ${totalCritical} prazo(s) crítico(s)` : ""}`,
      html,
      text: textLines,
    });
    console.log(`[Email] Daily report sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send daily report to ${params.toEmail}:`, err);
    return false;
  }
}

// ─── Password Reset Email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  toName: string;
  tempPassword: string;
}): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) return false;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefinição de Senha</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agrícola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agrícola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Sistema de Gestão de Compras</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#11181C;font-size:18px;">Olá, ${params.toName}! 🔑</h2>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Recebemos uma solicitação de redefinição de senha para sua conta.
                Sua senha temporária é:
              </p>
              <div style="background:#f5f5f5;border-radius:8px;padding:16px 24px;text-align:center;margin:0 0 24px;">
                <span style="font-size:28px;font-weight:700;letter-spacing:4px;color:#0a7ea4;">${params.tempPassword}</span>
              </div>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Acesse o sistema com esta senha temporária e altere-a assim que possível nas configurações do seu perfil.
              </p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
              <p style="margin:0;color:#9BA1A6;font-size:12px;text-align:center;">
                Se você não solicitou a redefinição de senha, entre em contato com o administrador do sistema imediatamente.<br/>
                Este e-mail foi enviado automaticamente. Não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.toEmail,
      subject: "Redefinição de Senha — CGS Agrícola",
      html,
      text: `Olá, ${params.toName}!\n\nSua senha temporária é: ${params.tempPassword}\n\nAcesse o sistema e altere sua senha assim que possível.\n\nEm caso de dúvidas, entre em contato com o administrador.`,
    });
    console.log(`[Email] Password reset email sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send password reset email:", err);
    return false;
  }
}
