/**
 * WhatsApp Notification Service
 *
 * Uses the WhatsApp Business API (Meta) or a third-party gateway (e.g., Twilio, Z-API, WPPConnect).
 * The integration is configured via the WHATSAPP_API_URL and WHATSAPP_API_TOKEN environment variables.
 *
 * Message format: deep link back to the app for the approver to act directly.
 * Fallback: if no API is configured, messages are logged to console only.
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL ?? "";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://comprafacil.app";

export interface WhatsAppMessage {
  to: string; // Phone number with country code, e.g., +5511999999999
  message: string;
}

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    console.log(`[WhatsApp] (not configured) → ${to}: ${message.substring(0, 80)}...`);
    return false;
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "text",
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[WhatsApp] Error sending to ${to}:`, err);
      return false;
    }

    console.log(`[WhatsApp] Message sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Network error:`, error);
    return false;
  }
}

// ─── Notification Templates ───────────────────────────────────────────────────

export async function notifyNewRequest(opts: {
  approverPhone: string;
  approverName: string;
  requestNumber: string;
  requestId: number;
  requesterName: string;
  application: string;
  urgencyLevel: string;
  department: string;
  stepLabel: string;
}) {
  const urgencyEmoji = opts.urgencyLevel === "emergencial" ? "🔴" : opts.urgencyLevel === "urgente" ? "🟡" : "🟢";
  const urgencyLabel = opts.urgencyLevel === "emergencial" ? "EMERGENCIAL (1 dia)" : opts.urgencyLevel === "urgente" ? "URGENTE (3 dias)" : "Normal (7 dias)";

  const message = [
    `📋 *Nova Solicitação de Compra*`,
    ``,
    `Olá, *${opts.approverName}*!`,
    ``,
    `Você tem uma solicitação aguardando sua aprovação como *${opts.stepLabel}*.`,
    ``,
    `*Nº:* ${opts.requestNumber}`,
    `*Solicitante:* ${opts.requesterName}`,
    `*Aplicação:* ${opts.application}`,
    `*Departamento:* ${opts.department}`,
    `*Urgência:* ${urgencyEmoji} ${urgencyLabel}`,
    ``,
    `Para aprovar ou rejeitar, acesse o aplicativo:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
    ``,
    `_Você tem 48h para responder antes do cancelamento automático._`,
  ].join("\n");

  return sendWhatsAppMessage(opts.approverPhone, message);
}

export async function notifyRejection(opts: {
  requesterPhone: string;
  requesterName: string;
  requestNumber: string;
  requestId: number;
  rejectorName: string;
  stepLabel: string;
  comment: string;
}) {
  const message = [
    `❌ *Solicitação Rejeitada*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi rejeitada na etapa de *${opts.stepLabel}*.`,
    ``,
    `*Motivo:* ${opts.comment}`,
    `*Rejeitado por:* ${opts.rejectorName}`,
    ``,
    `Você tem *48 horas* para corrigir e reenviar a solicitação. Após esse prazo, ela será cancelada automaticamente.`,
    ``,
    `Para corrigir, acesse o aplicativo:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
  ].join("\n");

  return sendWhatsAppMessage(opts.requesterPhone, message);
}

export async function notifyApproval(opts: {
  requesterPhone: string;
  requesterName: string;
  requestNumber: string;
  requestId: number;
  approverName: string;
  stepLabel: string;
  nextStepLabel?: string;
}) {
  const message = opts.nextStepLabel
    ? [
        `✅ *Solicitação Aprovada — Próxima Etapa*`,
        ``,
        `Olá, *${opts.requesterName}*!`,
        ``,
        `Sua solicitação *${opts.requestNumber}* foi aprovada na etapa de *${opts.stepLabel}*.`,
        ``,
        `*Aprovado por:* ${opts.approverName}`,
        `*Próxima etapa:* ${opts.nextStepLabel}`,
        ``,
        `Acompanhe o progresso no aplicativo:`,
        `${APP_BASE_URL}/request/${opts.requestId}`,
      ].join("\n")
    : [
        `🎉 *Solicitação Concluída!*`,
        ``,
        `Olá, *${opts.requesterName}*!`,
        ``,
        `Sua solicitação *${opts.requestNumber}* foi *concluída com sucesso*!`,
        ``,
        `O pagamento foi confirmado pelo financeiro.`,
        ``,
        `Acesse o aplicativo para ver os detalhes:`,
        `${APP_BASE_URL}/request/${opts.requestId}`,
      ].join("\n");

  return sendWhatsAppMessage(opts.requesterPhone, message);
}

export async function notifyBudgetRequired(opts: {
  requesterPhone: string;
  requesterName: string;
  requestNumber: string;
  requestId: number;
}) {
  const message = [
    `📎 *Orçamento Necessário*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi aprovada pelo Gerente de Unidade.`,
    ``,
    `Agora você precisa *anexar o PDF do orçamento* para continuar o processo.`,
    ``,
    `Acesse o aplicativo para anexar o orçamento:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
    ``,
    `_Você tem 48h para anexar o orçamento._`,
  ].join("\n");

  return sendWhatsAppMessage(opts.requesterPhone, message);
}

export async function notifyAutoCancellation(opts: {
  requesterPhone: string;
  requesterName: string;
  requestNumber: string;
  reason: string;
}) {
  const message = [
    `🚫 *Solicitação Cancelada Automaticamente*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi *cancelada automaticamente*.`,
    ``,
    `*Motivo:* ${opts.reason}`,
    ``,
    `Se necessário, crie uma nova solicitação no aplicativo.`,
  ].join("\n");

  return sendWhatsAppMessage(opts.requesterPhone, message);
}
