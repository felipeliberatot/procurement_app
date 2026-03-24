/**
 * WhatsApp Webhook Handler — CGS Agrícola
 *
 * Receives incoming WhatsApp messages from providers (Z-API, Twilio, Meta)
 * and processes APROVAR / REJEITAR replies from approvers.
 *
 * Routes registered:
 *   GET  /api/whatsapp/webhook  — verification challenge (Meta)
 *   POST /api/whatsapp/webhook  — incoming message handler
 */

import type { Express, Request, Response } from "express";
import {
  findPendingSessionByPhone,
  normalizePhone,
  notifyApproverActionConfirmation,
  resolveSession,
} from "./whatsapp";
import { approveRequest, rejectRequest, getUserById } from "./db";

// ─── Message parsing ──────────────────────────────────────────────────────────

interface ParsedReply {
  action: "approve" | "reject" | "unknown";
  comment?: string;
}

function parseReply(text: string): ParsedReply {
  const normalized = text.trim().toUpperCase();

  if (normalized === "APROVAR" || normalized === "APPROVE" || normalized === "SIM" || normalized === "OK") {
    return { action: "approve" };
  }

  if (normalized.startsWith("REJEITAR ") || normalized.startsWith("REJECT ") || normalized.startsWith("NÃO ") || normalized.startsWith("NAO ")) {
    const comment = text.trim().replace(/^(REJEITAR|REJECT|NÃO|NAO)\s+/i, "").trim();
    return { action: "reject", comment: comment || "Rejeitado via WhatsApp" };
  }

  if (normalized === "REJEITAR" || normalized === "REJECT" || normalized === "NÃO" || normalized === "NAO") {
    return { action: "reject", comment: "Rejeitado via WhatsApp" };
  }

  return { action: "unknown" };
}

// ─── Extract sender phone from provider payload ───────────────────────────────

function extractSenderAndText(
  body: Record<string, unknown>,
  provider: string,
): { phone: string; text: string } | null {
  try {
    if (provider === "zapi") {
      // Z-API payload
      const phone = (body.phone as string) || (body.from as string);
      const text = (body.text as { message?: string })?.message || (body.body as string) || "";
      if (phone && text) return { phone, text };
    } else if (provider === "twilio") {
      // Twilio payload
      const from = (body.From as string) || "";
      const text = (body.Body as string) || "";
      const phone = from.replace("whatsapp:", "");
      if (phone && text) return { phone, text };
    } else {
      // Meta Business API
      const entry = (body.entry as Array<{ changes: Array<{ value: { messages?: Array<{ from: string; text?: { body: string } }> } }> }>)?.[0];
      const change = entry?.changes?.[0];
      const msg = change?.value?.messages?.[0];
      if (msg) {
        return { phone: msg.from, text: msg.text?.body || "" };
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

// ─── Register routes ──────────────────────────────────────────────────────────

export function registerWhatsAppWebhook(app: Express): void {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "cgs-agricola-webhook";
  // Auto-detect provider: se ZAPI_INSTANCE_ID estiver configurado, usar zapi
  const PROVIDER = process.env.ZAPI_INSTANCE_ID
    ? "zapi"
    : (process.env.WHATSAPP_PROVIDER ?? "meta").toLowerCase();

  // Meta webhook verification challenge
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified ✓");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // Incoming message handler
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    // Always respond 200 quickly to prevent provider retries
    res.sendStatus(200);

    try {
      const body = req.body as Record<string, unknown>;
      const extracted = extractSenderAndText(body, PROVIDER);

      if (!extracted) {
        console.log("[WhatsApp] Webhook: could not extract sender/text from payload");
        return;
      }

      const { phone, text } = extracted;
      const normalizedPhone = normalizePhone(phone);

      console.log(`[WhatsApp] Incoming from ${normalizedPhone}: "${text}"`);

      // Find pending approval session for this phone number
      const session = await findPendingSessionByPhone(normalizedPhone);

      if (!session) {
        console.log(`[WhatsApp] No pending session for ${normalizedPhone}`);
        return;
      }

      const reply = parseReply(text);

      if (reply.action === "unknown") {
        console.log(`[WhatsApp] Unknown reply from ${normalizedPhone}: "${text}"`);
        return;
      }

      console.log(`[WhatsApp] Processing ${reply.action} for request #${session.requestNumber} (step: ${session.step})`);

      // Fetch the approver user object required by approveRequest/rejectRequest
      const approverUser = await getUserById(session.approverId);
      if (!approverUser) {
        console.error(`[WhatsApp] Approver user ${session.approverId} not found`);
        return;
      }

      if (reply.action === "approve") {
        await approveRequest(session.requestId, approverUser, { comment: "Aprovado via WhatsApp" });

        await resolveSession(session.id, "approved");

        await notifyApproverActionConfirmation({
          approverPhone: normalizedPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "approved",
        });

        console.log(`[WhatsApp] ✓ Request #${session.requestNumber} approved by ${normalizedPhone}`);
      } else if (reply.action === "reject") {
        await rejectRequest(session.requestId, approverUser, reply.comment || "Rejeitado via WhatsApp");

        await resolveSession(session.id, "rejected");

        await notifyApproverActionConfirmation({
          approverPhone: normalizedPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "rejected",
          comment: reply.comment,
        });

        console.log(`[WhatsApp] ✗ Request #${session.requestNumber} rejected by ${normalizedPhone}: ${reply.comment}`);
      }
    } catch (error) {
      console.error("[WhatsApp] Webhook processing error:", error);
    }
  });

  // ─── Endpoint de aprovação via link (GET /api/approve?token=xxx&action=approve|reject) ───
  app.get("/api/approve", async (req: Request, res: Response) => {
    const { token, action } = req.query as { token?: string; action?: string };

    const htmlPage = (title: string, emoji: string, message: string, color: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — CGS Agrícola</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 16px; padding: 40px 32px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .emoji { font-size: 64px; margin-bottom: 16px; }
    h1 { color: ${color}; font-size: 24px; margin: 0 0 12px; }
    p { color: #555; font-size: 16px; line-height: 1.5; margin: 0; }
    .brand { margin-top: 24px; color: #999; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="brand">📱 CompraFácil — CGS Agrícola</p>
  </div>
</body>
</html>`;

    if (!token || !action) {
      return res.status(400).send(htmlPage("Link inválido", "⚠️", "Este link de aprovação é inválido ou está incompleto.", "#F59E0B"));
    }

    if (action !== "approve" && action !== "reject") {
      return res.status(400).send(htmlPage("Ação inválida", "⚠️", "A ação solicitada não é reconhecida.", "#F59E0B"));
    }

    try {
      // Find session by token
      const { getDb } = await import("./db");
      const { whatsappSessions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.status(500).send(htmlPage("Erro interno", "❌", "Não foi possível conectar ao banco de dados.", "#EF4444"));

      const sessions = await db.select().from(whatsappSessions).where(eq(whatsappSessions.token, token));
      const session = sessions[0];

      if (!session) {
        return res.status(404).send(htmlPage("Link não encontrado", "🔍", "Este link de aprovação não existe ou já foi utilizado.", "#6B7280"));
      }

      if (session.status !== "pending") {
        const statusMsg = session.status === "approved" ? "já foi aprovada" : session.status === "rejected" ? "já foi rejeitada" : "expirou";
        return res.status(410).send(htmlPage("Link expirado", "⏰", `Esta solicitação ${statusMsg}. Não é possível processar novamente.`, "#6B7280"));
      }

      if (session.expiresAt < new Date()) {
        await db.update(whatsappSessions).set({ status: "expired" }).where(eq(whatsappSessions.id, session.id));
        return res.status(410).send(htmlPage("Link expirado", "⏰", "Este link de aprovação expirou (validade de 48h). Solicite uma nova notificação.", "#6B7280"));
      }

      const { approveRequest, rejectRequest, getUserById } = await import("./db");
      const approverUser = await getUserById(session.approverId);
      if (!approverUser) {
        return res.status(404).send(htmlPage("Usuário não encontrado", "❌", "O aprovador associado a este link não foi encontrado no sistema.", "#EF4444"));
      }

      if (action === "approve") {
        await approveRequest(session.requestId, approverUser, { comment: "Aprovado via link WhatsApp" });
        await db.update(whatsappSessions).set({ status: "approved", resolvedAt: new Date() }).where(eq(whatsappSessions.id, session.id));
        await notifyApproverActionConfirmation({
          approverPhone: session.approverPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "approved",
        });
        return res.send(htmlPage("Aprovação registrada!", "✅", `A solicitação <strong>${session.requestNumber}</strong> foi aprovada com sucesso. O solicitante será notificado.`, "#22C55E"));
      } else {
        await rejectRequest(session.requestId, approverUser, "Rejeitado via link WhatsApp");
        await db.update(whatsappSessions).set({ status: "rejected", resolvedAt: new Date() }).where(eq(whatsappSessions.id, session.id));
        await notifyApproverActionConfirmation({
          approverPhone: session.approverPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "rejected",
        });
        return res.send(htmlPage("Rejeição registrada!", "❌", `A solicitação <strong>${session.requestNumber}</strong> foi rejeitada. O solicitante será notificado para realizar correções.`, "#EF4444"));
      }
    } catch (error) {
      console.error("[WhatsApp] Link approval error:", error);
      return res.status(500).send(htmlPage("Erro interno", "❌", "Ocorreu um erro ao processar sua resposta. Tente novamente ou responda APROVAR/REJEITAR pelo WhatsApp.", "#EF4444"));
    }
  });

  console.log("[WhatsApp] Webhook routes registered: GET/POST /api/whatsapp/webhook + GET /api/approve");
}
