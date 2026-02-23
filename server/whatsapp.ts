/**
 * WhatsApp Notification & Approval Service — CGS Agrícola
 *
 * Supports three providers (configured via env vars):
 *   - Z-API  (recommended for Brazil): WHATSAPP_PROVIDER=zapi
 *   - Twilio:                          WHATSAPP_PROVIDER=twilio
 *   - Meta Business API:               WHATSAPP_PROVIDER=meta
 *
 * Required env vars:
 *   WHATSAPP_PROVIDER   = zapi | twilio | meta
 *   WHATSAPP_API_URL    = provider endpoint
 *   WHATSAPP_API_TOKEN  = Bearer token / API key
 *   WHATSAPP_FROM       = sender number (Twilio/Meta) or instance ID (Z-API)
 *   APP_BASE_URL        = public URL of the app (for deep links)
 *   WEBHOOK_BASE_URL    = public URL of this server (for webhook registration)
 */

import crypto from "crypto";
import { getDb } from "./db";
import { whatsappSessions, type WhatsappSession } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const PROVIDER = (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL ?? "";
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN ?? "";
const WHATSAPP_FROM = process.env.WHATSAPP_FROM ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://compras.cgsagricola.com.br";
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL ?? "";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function generateApprovalToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function createApprovalSession(opts: {
  token: string;
  requestId: number;
  requestNumber: string;
  approverPhone: string;
  approverId: number;
  approverName: string;
  step: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h
  const phone = normalizePhone(opts.approverPhone);
  const db = await getDb();
  if (!db) { console.warn("[WhatsApp] DB not available, cannot create session"); return; }
  await db.insert(whatsappSessions).values({
    token: opts.token,
    requestId: opts.requestId,
    requestNumber: opts.requestNumber,
    approverPhone: phone,
    approverId: opts.approverId,
    approverName: opts.approverName,
    step: opts.step,
    status: "pending",
    expiresAt,
  });
}

export async function findPendingSessionByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const now = new Date();
  const db = await getDb();
  if (!db) return null;
  const sessions = await db
    .select()
    .from(whatsappSessions)
    .where(
      and(
        eq(whatsappSessions.approverPhone, normalized),
        eq(whatsappSessions.status, "pending"),
      ),
    );
  // Return the most recent non-expired session
  return sessions
    .filter((s: WhatsappSession) => s.expiresAt > now)
    .sort((a: WhatsappSession, b: WhatsappSession) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

export async function resolveSession(
  sessionId: number,
  status: "approved" | "rejected",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(whatsappSessions)
    .set({ status, resolvedAt: new Date() })
    .where(eq(whatsappSessions.id, sessionId));
}

export async function expireOldSessions(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const all = await db
    .select()
    .from(whatsappSessions)
    .where(eq(whatsappSessions.status, "pending"));
  for (const s of all) {
    if ((s as WhatsappSession).expiresAt <= now) {
      await db!
        .update(whatsappSessions)
        .set({ status: "expired" })
        .where(eq(whatsappSessions.id, s.id));
    }
  }
}

// ─── Phone normalization ──────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("55") && p.length <= 11) p = "55" + p;
  return "+" + p;
}

// ─── Low-level send ───────────────────────────────────────────────────────────

async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const phone = normalizePhone(to);

  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    console.log(`[WhatsApp] ⚠ Not configured. Would send to ${phone}:\n${message.substring(0, 120)}...`);
    return false;
  }

  try {
    let body: Record<string, unknown>;
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (PROVIDER === "zapi") {
      // Z-API: POST /send-text
      headers["Client-Token"] = WHATSAPP_API_TOKEN;
      body = { phone: phone.replace("+", ""), message };
    } else if (PROVIDER === "twilio") {
      // Twilio: form-encoded
      headers = { "Content-Type": "application/x-www-form-urlencoded" };
      const params = new URLSearchParams({
        From: `whatsapp:${WHATSAPP_FROM}`,
        To: `whatsapp:${phone}`,
        Body: message,
      });
      const resp = await fetch(WHATSAPP_API_URL, {
        method: "POST",
        headers: {
          ...headers,
          Authorization: "Basic " + Buffer.from(WHATSAPP_API_TOKEN).toString("base64"),
        },
        body: params.toString(),
      });
      if (!resp.ok) {
        console.error(`[WhatsApp/Twilio] Error: ${await resp.text()}`);
        return false;
      }
      return true;
    } else {
      // Meta Business API (default)
      headers["Authorization"] = `Bearer ${WHATSAPP_API_TOKEN}`;
      body = {
        messaging_product: "whatsapp",
        to: phone.replace("+", ""),
        type: "text",
        text: { body: message },
      };
    }

    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[WhatsApp/${PROVIDER}] Error sending to ${phone}:`, await response.text());
      return false;
    }

    console.log(`[WhatsApp] ✓ Sent to ${phone}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Network error:`, error);
    return false;
  }
}

// ─── Approval notification (with token for webhook reply) ─────────────────────

export async function notifyApproverWithToken(opts: {
  approverPhone: string;
  approverName: string;
  requestNumber: string;
  requestId: number;
  approverId: number;
  requesterName: string;
  application: string;
  urgencyLevel: string;
  department: string;
  stepLabel: string;
  step: string;
  items?: Array<{ description: string; quantity: string; unit: string }>;
  totalValue?: string;
}): Promise<boolean> {
  const token = generateApprovalToken();

  // Persist session so webhook can match the reply
  await createApprovalSession({
    token,
    requestId: opts.requestId,
    requestNumber: opts.requestNumber,
    approverPhone: opts.approverPhone,
    approverId: opts.approverId,
    approverName: opts.approverName,
    step: opts.step,
  });

  const urgencyEmoji =
    opts.urgencyLevel === "emergencial" ? "🔴" :
    opts.urgencyLevel === "urgente"     ? "🟡" : "🟢";
  const urgencyLabel =
    opts.urgencyLevel === "emergencial" ? "EMERGENCIAL (prazo: 1 dia)" :
    opts.urgencyLevel === "urgente"     ? "URGENTE (prazo: 3 dias)"    : "Normal (prazo: 7 dias)";

  const itemLines = opts.items && opts.items.length > 0
    ? opts.items.slice(0, 5).map((it, i) =>
        `  ${i + 1}. ${it.description} — ${it.quantity} ${it.unit}`
      ).join("\n")
    : "  (sem itens detalhados)";

  const totalLine = opts.totalValue ? `*Valor estimado:* R$ ${opts.totalValue}\n` : "";

  const message = [
    `📋 *Solicitação de Compra — CGS Agrícola*`,
    ``,
    `Olá, *${opts.approverName}*! Você tem uma solicitação aguardando sua aprovação como *${opts.stepLabel}*.`,
    ``,
    `*Nº:* ${opts.requestNumber}`,
    `*Solicitante:* ${opts.requesterName}`,
    `*Departamento:* ${opts.department}`,
    `*Aplicação:* ${opts.application}`,
    `*Urgência:* ${urgencyEmoji} ${urgencyLabel}`,
    totalLine,
    `*Itens solicitados:*`,
    itemLines,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ Para *APROVAR*, responda:`,
    `APROVAR`,
    ``,
    `❌ Para *REJEITAR*, responda:`,
    `REJEITAR <motivo>`,
    ``,
    `Exemplo: REJEITAR Orçamento incompleto`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🔗 Ver detalhes no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
    ``,
    `_Você tem 48h para responder. Após esse prazo a solicitação será cancelada automaticamente._`,
  ].join("\n");

  return sendWhatsAppMessage(opts.approverPhone, message);
}

// ─── Status notifications ─────────────────────────────────────────────────────

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
  return notifyApproverWithToken({
    ...opts,
    approverId: 0,
    step: "gerente",
  });
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
    `❌ *Solicitação Rejeitada — CGS Agrícola*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi rejeitada na etapa de *${opts.stepLabel}*.`,
    ``,
    `*Motivo:* ${opts.comment}`,
    `*Rejeitado por:* ${opts.rejectorName}`,
    ``,
    `⏰ Você tem *48 horas* para corrigir e reenviar. Após esse prazo, a solicitação será cancelada automaticamente.`,
    ``,
    `🔗 Corrigir no app:`,
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
        `✅ *Etapa Aprovada — CGS Agrícola*`,
        ``,
        `Olá, *${opts.requesterName}*!`,
        ``,
        `Sua solicitação *${opts.requestNumber}* foi aprovada na etapa *${opts.stepLabel}*.`,
        ``,
        `*Aprovado por:* ${opts.approverName}`,
        `*Próxima etapa:* ${opts.nextStepLabel}`,
        ``,
        `🔗 Acompanhar no app:`,
        `${APP_BASE_URL}/request/${opts.requestId}`,
      ].join("\n")
    : [
        `🎉 *Solicitação Concluída! — CGS Agrícola*`,
        ``,
        `Olá, *${opts.requesterName}*!`,
        ``,
        `Sua solicitação *${opts.requestNumber}* foi *concluída com sucesso*! O pagamento foi confirmado pelo financeiro.`,
        ``,
        `🔗 Ver detalhes no app:`,
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
    `📎 *Orçamento Necessário — CGS Agrícola*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi aprovada pelo Gerente de Unidade.`,
    ``,
    `Agora você precisa *anexar o PDF do orçamento* para continuar o processo.`,
    ``,
    `🔗 Anexar orçamento no app:`,
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
    `🚫 *Solicitação Cancelada — CGS Agrícola*`,
    ``,
    `Olá, *${opts.requesterName}*!`,
    ``,
    `Sua solicitação *${opts.requestNumber}* foi *cancelada automaticamente*.`,
    ``,
    `*Motivo:* ${opts.reason}`,
    ``,
    `Se necessário, crie uma nova solicitação no app.`,
  ].join("\n");

  return sendWhatsAppMessage(opts.requesterPhone, message);
}

export async function notifyApproverActionConfirmation(opts: {
  approverPhone: string;
  approverName: string;
  requestNumber: string;
  action: "approved" | "rejected";
  comment?: string;
}) {
  const message = opts.action === "approved"
    ? [
        `✅ *Aprovação registrada!*`,
        ``,
        `Olá, *${opts.approverName}*!`,
        ``,
        `Sua aprovação da solicitação *${opts.requestNumber}* foi registrada com sucesso no sistema CGS Agrícola.`,
      ].join("\n")
    : [
        `❌ *Rejeição registrada!*`,
        ``,
        `Olá, *${opts.approverName}*!`,
        ``,
        `Sua rejeição da solicitação *${opts.requestNumber}* foi registrada.`,
        opts.comment ? `*Motivo informado:* ${opts.comment}` : "",
        ``,
        `O solicitante será notificado para realizar as correções.`,
      ].filter(Boolean).join("\n");

  return sendWhatsAppMessage(opts.approverPhone, message);
}

// ─── Webhook URL helper ───────────────────────────────────────────────────────

export function getWebhookUrl(): string {
  if (WEBHOOK_BASE_URL) return `${WEBHOOK_BASE_URL}/api/whatsapp/webhook`;
  return "(configure WEBHOOK_BASE_URL no servidor para obter a URL)";
}

export function isConfigured(): boolean {
  return !!(WHATSAPP_API_URL && WHATSAPP_API_TOKEN);
}

export function getProviderInfo() {
  return {
    provider: PROVIDER || "não configurado",
    configured: isConfigured(),
    webhookUrl: getWebhookUrl(),
  };
}
