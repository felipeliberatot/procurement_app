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
  const PROVIDER = (process.env.WHATSAPP_PROVIDER ?? "meta").toLowerCase();

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

  console.log("[WhatsApp] Webhook routes registered: GET/POST /api/whatsapp/webhook");
}
