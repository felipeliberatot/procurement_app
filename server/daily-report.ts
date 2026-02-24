import { getDb } from "./db";
import { purchaseRequests, users, requestItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { sendDailyReportEmail, type DailyReportRequest } from "./email";
import { sendSimpleWhatsApp } from "./whatsapp";

// ─── Daily Report Service ─────────────────────────────────────────────────────
// Runs every day at 07:00 BRT.
// Sends a full report to ALL active users with:
//   1. Open requests (all statuses except concluida/rejeitada/cancelada)
//   2. Requests completed today
//   3. Critical requests (deadline within 24h) — highlighted in both sections

const TERMINAL_STATUSES = ["concluida", "rejeitada", "cancelada"];

function toReportItem(r: {
  requestNumber: string;
  requesterName: string;
  department: string;
  application: string;
  urgencyLevel: string;
  status: string;
  deadlineAt: Date | null;
  totalEstimatedValue: string | null;
  createdAt: Date;
  itemNames?: string;
}): DailyReportRequest {
  return {
    requestNumber: r.requestNumber,
    requesterName: r.requesterName,
    department: r.department,
    application: r.application,
    urgencyLevel: r.urgencyLevel,
    status: r.status,
    deadlineAt: r.deadlineAt,
    totalEstimatedValue: r.totalEstimatedValue,
    createdAt: r.createdAt,
    itemNames: r.itemNames,
  };
}

export async function runDailyReport(): Promise<void> {
  console.log("[DailyReport] Starting daily report generation...");
  const db = await getDb();
  if (!db) {
    console.warn("[DailyReport] No database connection — skipping.");
    return;
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Start and end of today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // ── Fetch all requests ──────────────────────────────────────────────────────
  const allRequests = await db.select().from(purchaseRequests);

  // Fetch all items for these requests and build a map requestId → itemNames
  const allItems = await db.select().from(requestItems);
  const itemsByRequest = new Map<number, string[]>();
  for (const item of allItems) {
    const list = itemsByRequest.get(item.requestId) ?? [];
    list.push(item.description);
    itemsByRequest.set(item.requestId, list);
  }
  const getItemNames = (id: number) => {
    const names = itemsByRequest.get(id);
    if (!names || names.length === 0) return undefined;
    // Show up to 3 items; if more, append count
    const preview = names.slice(0, 3).join(", ");
    return names.length > 3 ? `${preview} (+${names.length - 3})` : preview;
  };

  // Open requests: not in terminal states
  const openRequests: DailyReportRequest[] = allRequests
    .filter(r => !TERMINAL_STATUSES.includes(r.status))
    .map(r => toReportItem({ ...r, itemNames: getItemNames(r.id) }));

  // Completed today: status = concluida AND updatedAt is today
  const completedToday: DailyReportRequest[] = allRequests
    .filter(r => r.status === "concluida" && r.updatedAt >= todayStart && r.updatedAt <= todayEnd)
    .map(r => toReportItem({ ...r, itemNames: getItemNames(r.id) }));

  // Critical: open requests with deadline within 24h
  const criticalRequests: DailyReportRequest[] = openRequests.filter(
    r => r.deadlineAt != null && r.deadlineAt > now && r.deadlineAt <= in24h,
  );

  // ── Fetch all active users ──────────────────────────────────────────────────
  const allUsers = await db.select().from(users);
  const activeUsers = allUsers.filter(u => u.active);

  if (activeUsers.length === 0) {
    console.warn("[DailyReport] No active users found — skipping.");
    return;
  }

  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  console.log(
    `[DailyReport] Sending to ${activeUsers.length} users | Open: ${openRequests.length} | Critical: ${criticalRequests.length} | Completed today: ${completedToday.length}`,
  );

  // ── Build WhatsApp summary message ─────────────────────────────────────────
  const urgencyLabel = (level: string) =>
    level === "emergencial" ? "🔴 Emergencial" : level === "urgente" ? "🟡 Urgente" : "🟢 Normal";

  const statusLabel = (status: string) => {
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
  };

  const formatDeadline = (date: Date | null) => {
    if (!date) return "—";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const criticalSet = new Set(criticalRequests.map(r => r.requestNumber));

  let whatsappMsg = `📊 *Relatório Diário de Compras — ${dateStr}*\n\n`;
  whatsappMsg += `📌 *Resumo:*\n`;
  whatsappMsg += `  • Em Aberto: *${openRequests.length}*\n`;
  whatsappMsg += `  • ⚠️ Prazo Crítico (24h): *${criticalRequests.length}*\n`;
  whatsappMsg += `  • ✅ Concluídas Hoje: *${completedToday.length}*\n\n`;

  if (criticalRequests.length > 0) {
    whatsappMsg += `🚨 *ATENÇÃO — Prazos Críticos:*\n`;
    for (const r of criticalRequests) {
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  ⚠️ *${r.requestNumber}*${items} | ${r.requesterName} | ${urgencyLabel(r.urgencyLevel)} | Prazo: ${formatDeadline(r.deadlineAt)}\n`;
    }
    whatsappMsg += `\n`;
  }

  if (openRequests.length > 0) {
    whatsappMsg += `📋 *Solicitações em Aberto:*\n`;
    for (const r of openRequests) {
      const critical = criticalSet.has(r.requestNumber) ? " ⚠️" : "";
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  • *${r.requestNumber}*${critical}${items} | ${r.requesterName} | ${statusLabel(r.status)}\n`;
    }
    whatsappMsg += `\n`;
  }

  if (completedToday.length > 0) {
    whatsappMsg += `✅ *Concluídas Hoje:*\n`;
    for (const r of completedToday) {
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  • *${r.requestNumber}*${items} | ${r.requesterName}\n`;
    }
  }

  // ── Send to each active user ────────────────────────────────────────────────
  const emailPromises: Promise<boolean>[] = [];
  const whatsappPromises: Promise<boolean>[] = [];

  for (const user of activeUsers) {
    // Send email if user has email
    if (user.email) {
      emailPromises.push(
        sendDailyReportEmail({
          toEmail: user.email,
          toName: user.name ?? "Usuário",
          openRequests,
          completedToday,
          criticalRequests,
          date: dateStr,
        }),
      );
    }

    // Send WhatsApp if user has phone
    if (user.phone) {
      const personalizedMsg = whatsappMsg.replace(
        `📊 *Relatório Diário de Compras — ${dateStr}*`,
        `📊 *Relatório Diário de Compras — ${dateStr}*\nOlá, ${user.name ?? "Usuário"}!`,
      );
      whatsappPromises.push(
        sendSimpleWhatsApp(user.phone, personalizedMsg),
      );
    }
  }

  const emailResults = await Promise.allSettled(emailPromises);
  const emailSent = emailResults.filter(r => r.status === "fulfilled" && r.value).length;
  console.log(`[DailyReport] Emails sent: ${emailSent}/${emailPromises.length}`);

  await Promise.allSettled(whatsappPromises);
  console.log(`[DailyReport] WhatsApp messages sent to ${whatsappPromises.length} users`);

  console.log("[DailyReport] Daily report completed.");
}
