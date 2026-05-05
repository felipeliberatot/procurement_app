var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  apiKeys: () => apiKeys,
  approvalHistory: () => approvalHistory,
  assets: () => assets,
  budgets: () => budgets,
  businessUnits: () => businessUnits,
  costCenters: () => costCenters,
  departments: () => departments,
  harvests: () => harvests,
  maloteItems: () => maloteItems,
  maloteTagLinks: () => maloteTagLinks,
  maloteTags: () => maloteTags,
  malotes: () => malotes,
  purchaseRequests: () => purchaseRequests,
  requestItems: () => requestItems,
  units: () => units,
  users: () => users,
  whatsappSessions: () => whatsappSessions
});
import {
  boolean,
  decimal,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";
var users, costCenters, assets, purchaseRequests, requestItems, approvalHistory, whatsappSessions, malotes, maloteItems, units, businessUnits, departments, maloteTags, maloteTagLinks, harvests, budgets, apiKeys;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      procurementRole: mysqlEnum("procurementRole", [
        "solicitante",
        "gerente",
        "orcamento",
        "controladoria",
        "diretoria",
        "financeiro",
        "admin"
      ]).default("solicitante").notNull(),
      department: varchar("department", { length: 128 }),
      phone: varchar("phone", { length: 32 }),
      // WhatsApp number
      jobTitle: varchar("jobTitle", { length: 128 }),
      // Cargo/título do usuário
      approvalLevel: mysqlEnum("approvalLevel", [
        "nenhum",
        "gerente",
        "controladoria",
        "orcamento",
        "diretoria",
        "financeiro",
        "master"
      ]).default("nenhum").notNull(),
      // Papéis e níveis adicionais (JSON array de strings, ex: '["gerente","orcamento"]')
      extraRoles: text("extraRoles"),
      // JSON array de ProcurementRole extras
      extraApprovalLevels: text("extraApprovalLevels"),
      // JSON array de ApprovalLevel extras
      pinHash: varchar("pinHash", { length: 255 }),
      // Hashed PIN for master quick access
      passwordHash: varchar("passwordHash", { length: 255 }),
      // Hashed password for email+password login
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    costCenters = mysqlTable("costCenters", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 32 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull(),
      responsible: varchar("responsible", { length: 128 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    assets = mysqlTable("assets", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 32 }).notNull().unique(),
      description: varchar("description", { length: 255 }).notNull(),
      category: varchar("category", { length: 64 }),
      location: varchar("location", { length: 128 }),
      value: varchar("value", { length: 32 }),
      // Valor do bem (obrigatório)
      hasChassi: boolean("hasChassi").default(false).notNull(),
      // Possui chassi/placa?
      chassiNumber: varchar("chassiNumber", { length: 64 }),
      // Nº do chassi (opcional)
      licensePlate: varchar("licensePlate", { length: 16 }),
      // Placa (opcional)
      patrimonialCode: varchar("patrimonialCode", { length: 16 }),
      // Código patrimonial sequencial (PAT-00001)
      costCenterId: int("costCenterId"),
      // FK para costCenters (opcional)
      costCenterCode: varchar("costCenterCode", { length: 32 }),
      // Código do centro de custo (desnormalizado)
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    purchaseRequests = mysqlTable("purchaseRequests", {
      id: int("id").autoincrement().primaryKey(),
      requestNumber: varchar("requestNumber", { length: 32 }).notNull().unique(),
      // Requester info
      requesterId: int("requesterId").notNull(),
      requesterName: varchar("requesterName", { length: 128 }).notNull(),
      department: varchar("department", { length: 128 }).notNull(),
      costCenterId: int("costCenterId"),
      costCenterCode: varchar("costCenterCode", { length: 32 }),
      application: varchar("application", { length: 255 }).notNull(),
      // Priority / urgency
      urgencyLevel: mysqlEnum("urgencyLevel", ["normal", "urgente", "emergencial"]).default("normal").notNull(),
      // Content
      observations: text("observations"),
      totalEstimatedValue: decimal("totalEstimatedValue", { precision: 14, scale: 2 }),
      // Workflow status
      status: mysqlEnum("status", [
        "rascunho",
        "aguardando_gerente",
        "aguardando_orcamento",
        "aguardando_controladoria",
        "aguardando_diretoria",
        "aguardando_ordem_compra",
        "aguardando_aprovacao_compra",
        "aguardando_comprovante_pagamento",
        "aguardando_verificacao_compras",
        "concluida",
        "rejeitada",
        "cancelada"
      ]).default("aguardando_gerente").notNull(),
      // Step-specific data
      budgetFileUrl: text("budgetFileUrl"),
      // PDF orçamento
      purchaseOrderNumber: varchar("purchaseOrderNumber", { length: 64 }),
      paymentMethod: mysqlEnum("paymentMethod", ["pix", "boleto", "cartao_avista", "cartao_parcelado"]),
      // Método de pagamento selecionado pelo Compras
      paymentInfo: text("paymentInfo"),
      // Dados de pagamento inseridos pelo Compras
      paymentProofUrl: text("paymentProofUrl"),
      // PDF comprovante de pagamento (Financeiro)
      paymentObservations: text("paymentObservations"),
      // Observações de pagamento (boleto/cartão)
      paymentInstallments: int("paymentInstallments"),
      // Número de parcelas (cartão parcelado)
      invoiceUrl: text("invoiceUrl"),
      // PDF nota fiscal (Compras na verificação final)
      ocSiagriUrl: text("ocSiagriUrl"),
      // PDF OC Siagri (Compras na emissão de OC)
      // Valor da Ordem de Compra (definido na etapa de orçamento)
      orderValue: decimal("orderValue", { precision: 14, scale: 2 }),
      // OS Myfarm
      osMyfarm: varchar("osMyfarm", { length: 64 }),
      // Número da OS Myfarm vinculada
      // Urgente/Emergencial: controle de retorno ao orçamento
      orcamentoFeitoUrgente: boolean("orcamentoFeitoUrgente").default(false).notNull(),
      // true após o orçamento ser feito pela primeira vez em pedidos urgentes/emergenciais
      // Aprovação dupla da Diretoria: JSON com IDs dos diretores que já aprovaram
      // Formato: [{userId: number, userName: string, approvedAt: string}]
      // A etapa só avança quando Rafael (ID 480003) + pelo menos 1 outro diretor aprovarem
      directorApprovals: text("directorApprovals"),
      // Malotes integration
      isEnabledInMalotes: boolean("isEnabledInMalotes").default(false).notNull(),
      // Habilitado nos Malotes após OC finalizada
      // Deadline tracking
      deadlineAt: timestamp("deadlineAt"),
      // Overall deadline based on urgency
      stepDeadlineAt: timestamp("stepDeadlineAt"),
      // 48h deadline for current approver
      cancellationDeadlineAt: timestamp("cancellationDeadlineAt"),
      // 10-day deadline before auto-cancel (set on rejection/expiry)
      cancellationWarningSentAt: timestamp("cancellationWarningSentAt"),
      // When the 1-day warning was sent (prevents duplicates)
      // AI Analysis
      aiAnalysis: text("aiAnalysis"),
      // JSON do parecer de análise de orçamento pela IA
      // Timestamps
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    requestItems = mysqlTable("requestItems", {
      id: int("id").autoincrement().primaryKey(),
      requestId: int("requestId").notNull(),
      description: varchar("description", { length: 255 }).notNull(),
      quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
      unit: varchar("unit", { length: 32 }).default("un").notNull(),
      unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }),
      totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    approvalHistory = mysqlTable("approvalHistory", {
      id: int("id").autoincrement().primaryKey(),
      requestId: int("requestId").notNull(),
      userId: int("userId").notNull(),
      userName: varchar("userName", { length: 128 }),
      step: mysqlEnum("step", [
        "criacao",
        "gerente",
        "orcamento",
        "controladoria",
        "diretoria",
        "ordem_compra",
        "aprovacao_compra",
        "financeiro",
        "verificacao_compras",
        "cancelamento",
        "reabertura",
        "edicao"
      ]).notNull(),
      action: mysqlEnum("action", [
        "criada",
        "aprovada",
        "rejeitada",
        "orcamento_anexado",
        "ordem_emitida",
        "comprovante_anexado",
        "comprovante_aprovado",
        "comprovante_recusado",
        "pagamento_recusado",
        "pagamento_verificado",
        "nota_fiscal_anexada",
        "oc_finalizada",
        "cancelada",
        "reaberta",
        "compra_aprovada",
        "compra_cancelada",
        "editada"
      ]).notNull(),
      comment: text("comment"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    whatsappSessions = mysqlTable("whatsappSessions", {
      id: int("id").autoincrement().primaryKey(),
      token: varchar("token", { length: 64 }).notNull().unique(),
      requestId: int("requestId").notNull(),
      requestNumber: varchar("requestNumber", { length: 32 }).notNull(),
      approverPhone: varchar("approverPhone", { length: 32 }).notNull(),
      approverId: int("approverId").notNull(),
      approverName: varchar("approverName", { length: 128 }),
      step: varchar("step", { length: 64 }).notNull(),
      status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      resolvedAt: timestamp("resolvedAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    malotes = mysqlTable("malotes", {
      id: int("id").autoincrement().primaryKey(),
      maloteCode: varchar("maloteCode", { length: 20 }).notNull().unique(),
      status: mysqlEnum("status", ["aberto", "enviado", "recebido", "devolvido"]).default("aberto").notNull(),
      originUnit: varchar("originUnit", { length: 100 }).notNull(),
      destinationUnit: varchar("destinationUnit", { length: 100 }).notNull(),
      createdById: int("createdById").notNull(),
      createdByName: varchar("createdByName", { length: 255 }).notNull(),
      sentAt: timestamp("sentAt"),
      sentById: int("sentById"),
      sentByName: varchar("sentByName", { length: 255 }),
      receivedAt: timestamp("receivedAt"),
      receivedById: int("receivedById"),
      receivedByName: varchar("receivedByName", { length: 255 }),
      notes: text("notes"),
      receiptNotes: text("receiptNotes"),
      signatureData: longtext("signatureData"),
      returnReason: text("returnReason"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    maloteItems = mysqlTable("maloteItems", {
      id: int("id").autoincrement().primaryKey(),
      maloteId: int("maloteId").notNull(),
      requestId: int("requestId").notNull(),
      requestCode: varchar("requestCode", { length: 20 }).notNull(),
      requesterName: varchar("requesterName", { length: 255 }).notNull(),
      application: varchar("application", { length: 255 }).notNull(),
      addedById: int("addedById").notNull(),
      addedByName: varchar("addedByName", { length: 255 }).notNull(),
      receiptStatus: mysqlEnum("receiptStatus", ["pendente", "recebido", "devolvido"]).default("pendente").notNull(),
      receiptNotes: text("receiptNotes"),
      addedAt: timestamp("addedAt").defaultNow().notNull()
    });
    units = mysqlTable("units", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 150 }).notNull(),
      code: varchar("code", { length: 30 }).notNull().unique(),
      address: varchar("address", { length: 255 }),
      city: varchar("city", { length: 100 }),
      state: varchar("state", { length: 50 }),
      responsibleName: varchar("responsibleName", { length: 150 }),
      responsiblePhone: varchar("responsiblePhone", { length: 32 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    businessUnits = mysqlTable("businessUnits", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 150 }).notNull(),
      code: varchar("code", { length: 30 }).notNull().unique(),
      type: mysqlEnum("type", ["escritorio", "filial", "deposito", "outro"]).default("escritorio").notNull(),
      address: varchar("address", { length: 255 }),
      city: varchar("city", { length: 100 }),
      state: varchar("state", { length: 50 }),
      responsibleName: varchar("responsibleName", { length: 150 }),
      responsiblePhone: varchar("responsiblePhone", { length: 32 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    departments = mysqlTable("departments", {
      id: int("id").autoincrement().primaryKey(),
      code: varchar("code", { length: 32 }).notNull().unique(),
      name: varchar("name", { length: 128 }).notNull(),
      responsible: varchar("responsible", { length: 128 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    maloteTags = mysqlTable("maloteTags", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 64 }).notNull(),
      color: varchar("color", { length: 16 }).notNull().default("#6B7280"),
      icon: varchar("icon", { length: 8 }).notNull().default("\u{1F3F7}\uFE0F"),
      category: mysqlEnum("category", ["prioridade", "tipo", "custom"]).notNull().default("custom"),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    maloteTagLinks = mysqlTable("maloteTagLinks", {
      id: int("id").autoincrement().primaryKey(),
      maloteId: int("maloteId").notNull(),
      tagId: int("tagId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    harvests = mysqlTable("harvests", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 128 }).notNull(),
      year: varchar("year", { length: 9 }).notNull(),
      // ex: "2024/2025"
      startDate: varchar("startDate", { length: 10 }),
      // ISO date string
      endDate: varchar("endDate", { length: 10 }),
      // ISO date string
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    budgets = mysqlTable("budgets", {
      id: int("id").autoincrement().primaryKey(),
      harvestId: int("harvestId").notNull(),
      // FK para harvests
      costCenterId: int("costCenterId"),
      // FK para costCenters (opcional)
      costCenterCode: varchar("costCenterCode", { length: 32 }),
      costCenterName: varchar("costCenterName", { length: 128 }),
      category: varchar("category", { length: 64 }),
      // categoria do orçamento (opcional)
      totalValue: decimal("totalValue", { precision: 15, scale: 2 }).notNull().default("0.00"),
      usedValue: decimal("usedValue", { precision: 15, scale: 2 }).notNull().default("0.00"),
      notes: text("notes"),
      createdBy: varchar("createdBy", { length: 128 }),
      // nome do usuário que criou
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    apiKeys = mysqlTable("apiKeys", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 128 }).notNull(),
      // Nome descritivo (ex: "CGS Manutenções")
      keyHash: varchar("keyHash", { length: 255 }).notNull(),
      // Hash SHA-256 da chave (nunca armazenar em texto puro)
      keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(),
      // Prefixo visível para identificação (ex: "cgsk_abc123")
      createdById: int("createdById").notNull(),
      // FK para users (quem criou)
      createdByName: varchar("createdByName", { length: 128 }),
      // Nome de quem criou
      lastUsedAt: timestamp("lastUsedAt"),
      // Última vez que a chave foi usada
      expiresAt: timestamp("expiresAt"),
      // Data de expiração (null = sem expiração)
      active: boolean("active").default(true).notNull(),
      permissions: text("permissions"),
      // JSON array de permissões (ex: ["create_request","read_requests"])
      description: text("description"),
      // Descrição do uso da chave
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      serperApiKey: process.env.SERPER_API_KEY ?? "",
      cgsMaintainApiKey: process.env.CGS_MAINTENANCE_API_KEY ?? ""
    };
  }
});

// server/whatsapp.ts
var whatsapp_exports = {};
__export(whatsapp_exports, {
  createApprovalSession: () => createApprovalSession,
  expireOldSessions: () => expireOldSessions,
  findPendingSessionByPhone: () => findPendingSessionByPhone,
  generateApprovalToken: () => generateApprovalToken,
  getProviderInfo: () => getProviderInfo,
  getWebhookUrl: () => getWebhookUrl,
  isConfigured: () => isConfigured,
  normalizePhone: () => normalizePhone,
  notifyApproval: () => notifyApproval,
  notifyApproverActionConfirmation: () => notifyApproverActionConfirmation,
  notifyApproverWithToken: () => notifyApproverWithToken,
  notifyAutoCancellation: () => notifyAutoCancellation,
  notifyBudgetRequired: () => notifyBudgetRequired,
  notifyNewRequest: () => notifyNewRequest,
  notifyNewUserRegistration: () => notifyNewUserRegistration,
  notifyRejection: () => notifyRejection,
  resolveSession: () => resolveSession,
  sendDailyDeadlineReport: () => sendDailyDeadlineReport,
  sendSimpleWhatsApp: () => sendSimpleWhatsApp,
  sendWhatsAppTestMessage: () => sendWhatsAppTestMessage
});
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
function resolveServerBaseUrl() {
  if (process.env.WEBHOOK_BASE_URL) return process.env.WEBHOOK_BASE_URL.replace(/\/$/, "");
  const expoUrl = process.env.EXPO_PACKAGER_PROXY_URL ?? "";
  if (expoUrl) {
    const serverUrl = expoUrl.replace(/8081-/, "3000-").replace(/\/+$/, "");
    if (serverUrl !== expoUrl) return serverUrl;
  }
  return APP_BASE_URL;
}
function generateApprovalToken() {
  return crypto.randomBytes(24).toString("hex");
}
async function createApprovalSession(opts) {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1e3);
  const phone = normalizePhone(opts.approverPhone);
  const db = await getDb();
  if (!db) {
    console.warn("[WhatsApp] DB not available, cannot create session");
    return;
  }
  try {
    await db.update(whatsappSessions).set({ status: "expired" }).where(
      and(
        eq(whatsappSessions.requestId, opts.requestId),
        eq(whatsappSessions.approverId, opts.approverId),
        eq(whatsappSessions.status, "pending")
      )
    );
  } catch (e) {
    console.warn("[WhatsApp] Could not expire old sessions:", e);
  }
  await db.insert(whatsappSessions).values({
    token: opts.token,
    requestId: opts.requestId,
    requestNumber: opts.requestNumber,
    approverPhone: phone,
    approverId: opts.approverId,
    approverName: opts.approverName,
    step: opts.step,
    status: "pending",
    expiresAt
  });
}
async function findPendingSessionByPhone(phone) {
  const normalized = normalizePhone(phone);
  const now = /* @__PURE__ */ new Date();
  const db = await getDb();
  if (!db) return null;
  const sessions = await db.select().from(whatsappSessions).where(
    and(
      eq(whatsappSessions.approverPhone, normalized),
      eq(whatsappSessions.status, "pending")
    )
  );
  return sessions.filter((s) => s.expiresAt > now).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}
async function resolveSession(sessionId, status) {
  const db = await getDb();
  if (!db) return;
  await db.update(whatsappSessions).set({ status, resolvedAt: /* @__PURE__ */ new Date() }).where(eq(whatsappSessions.id, sessionId));
}
async function expireOldSessions() {
  const db = await getDb();
  if (!db) return;
  const now = /* @__PURE__ */ new Date();
  const all = await db.select().from(whatsappSessions).where(eq(whatsappSessions.status, "pending"));
  for (const s of all) {
    if (s.expiresAt <= now) {
      await db.update(whatsappSessions).set({ status: "expired" }).where(eq(whatsappSessions.id, s.id));
    }
  }
}
function normalizePhone(phone) {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("55") && p.length <= 11) p = "55" + p;
  return "+" + p;
}
async function sendWhatsAppMessage(to, message) {
  const phone = normalizePhone(to);
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    console.log(`[WhatsApp] \u26A0 Not configured. Would send to ${phone}:
${message.substring(0, 120)}...`);
    return false;
  }
  try {
    let body;
    let headers = {
      "Content-Type": "application/json"
    };
    if (PROVIDER === "zapi") {
      headers["Client-Token"] = WHATSAPP_API_TOKEN;
      body = { phone: phone.replace("+", ""), message };
    } else if (PROVIDER === "twilio") {
      headers = { "Content-Type": "application/x-www-form-urlencoded" };
      const params = new URLSearchParams({
        From: `whatsapp:${WHATSAPP_FROM}`,
        To: `whatsapp:${phone}`,
        Body: message
      });
      const resp = await fetch(WHATSAPP_API_URL, {
        method: "POST",
        headers: {
          ...headers,
          Authorization: "Basic " + Buffer.from(WHATSAPP_API_TOKEN).toString("base64")
        },
        body: params.toString()
      });
      if (!resp.ok) {
        console.error(`[WhatsApp/Twilio] Error: ${await resp.text()}`);
        return false;
      }
      return true;
    } else {
      headers["Authorization"] = `Bearer ${WHATSAPP_API_TOKEN}`;
      body = {
        messaging_product: "whatsapp",
        to: phone.replace("+", ""),
        type: "text",
        text: { body: message }
      };
    }
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error(`[WhatsApp/${PROVIDER}] Error sending to ${phone}:`, await response.text());
      return false;
    }
    console.log(`[WhatsApp] \u2713 Sent to ${phone}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp] Network error:`, error);
    return false;
  }
}
async function sendSimpleWhatsApp(phone, message) {
  return sendWhatsAppMessage(phone, message);
}
async function notifyApproverWithToken(opts) {
  const token = generateApprovalToken();
  await createApprovalSession({
    token,
    requestId: opts.requestId,
    requestNumber: opts.requestNumber,
    approverPhone: opts.approverPhone,
    approverId: opts.approverId,
    approverName: opts.approverName,
    step: opts.step
  });
  const urgencyEmoji = opts.urgencyLevel === "emergencial" ? "\u{1F534}" : opts.urgencyLevel === "urgente" ? "\u{1F7E1}" : "\u{1F7E2}";
  const urgencyLabel2 = opts.urgencyLevel === "emergencial" ? "EMERGENCIAL (prazo: 1 dia)" : opts.urgencyLevel === "urgente" ? "URGENTE (prazo: 3 dias)" : "Normal (prazo: 7 dias)";
  const itemLines = opts.items && opts.items.length > 0 ? opts.items.slice(0, 5).map(
    (it, i) => `  ${i + 1}. ${it.description} \u2014 ${it.quantity} ${it.unit}`
  ).join("\n") : "  (sem itens detalhados)";
  const totalLine = opts.totalValue ? `*Valor estimado:* R$ ${opts.totalValue}
` : "";
  const serverBase = resolveServerBaseUrl();
  const approveLink = `${serverBase}/api/approve?token=${token}&action=approve`;
  const rejectLink = `${serverBase}/api/approve?token=${token}&action=reject`;
  const message = [
    `\u{1F4CB} *Solicita\xE7\xE3o de Compra \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.approverName}*! Voc\xEA tem uma solicita\xE7\xE3o aguardando sua aprova\xE7\xE3o como *${opts.stepLabel}*.`,
    ``,
    `*N\xBA:* ${opts.requestNumber}`,
    `*Solicitante:* ${opts.requesterName}`,
    `*Departamento:* ${opts.department}`,
    `*Aplica\xE7\xE3o:* ${opts.application}`,
    `*Urg\xEAncia:* ${urgencyEmoji} ${urgencyLabel2}`,
    totalLine,
    `*Itens solicitados:*`,
    itemLines,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `\u2705 *APROVAR* (clique no link):`,
    approveLink,
    ``,
    `\u274C *REJEITAR* (clique no link):`,
    rejectLink,
    ``,
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
    `_Ou responda: APROVAR ou REJEITAR <motivo>_`,
    ``,
    `\u{1F517} Ver detalhes no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
    ``,
    `_Voc\xEA tem 48h para responder. Ap\xF3s esse prazo a solicita\xE7\xE3o ser\xE1 cancelada automaticamente._`
  ].join("\n");
  return sendWhatsAppMessage(opts.approverPhone, message);
}
async function notifyNewRequest(opts) {
  return notifyApproverWithToken({
    ...opts,
    approverId: 0,
    step: "gerente"
  });
}
async function notifyRejection(opts) {
  const message = [
    `\u274C *Solicita\xE7\xE3o Rejeitada \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.requesterName}*!`,
    ``,
    `Sua solicita\xE7\xE3o *${opts.requestNumber}* foi rejeitada na etapa de *${opts.stepLabel}*.`,
    ``,
    `*Motivo:* ${opts.comment}`,
    `*Rejeitado por:* ${opts.rejectorName}`,
    ``,
    `\u23F0 Voc\xEA tem *48 horas* para corrigir e reenviar. Ap\xF3s esse prazo, a solicita\xE7\xE3o ser\xE1 cancelada automaticamente.`,
    ``,
    `\u{1F517} Corrigir no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`
  ].join("\n");
  return sendWhatsAppMessage(opts.requesterPhone, message);
}
async function notifyApproval(opts) {
  const message = opts.nextStepLabel ? [
    `\u2705 *Etapa Aprovada \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.requesterName}*!`,
    ``,
    `Sua solicita\xE7\xE3o *${opts.requestNumber}* foi aprovada na etapa *${opts.stepLabel}*.`,
    ``,
    `*Aprovado por:* ${opts.approverName}`,
    `*Pr\xF3xima etapa:* ${opts.nextStepLabel}`,
    ``,
    `\u{1F517} Acompanhar no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`
  ].join("\n") : [
    `\u{1F389} *Solicita\xE7\xE3o Conclu\xEDda! \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.requesterName}*!`,
    ``,
    `Sua solicita\xE7\xE3o *${opts.requestNumber}* foi *conclu\xEDda com sucesso*! O pagamento foi confirmado pelo financeiro.`,
    ``,
    `\u{1F517} Ver detalhes no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`
  ].join("\n");
  return sendWhatsAppMessage(opts.requesterPhone, message);
}
async function notifyBudgetRequired(opts) {
  const urgencyLabel2 = opts.urgencyLevel === "urgente" ? "\u{1F7E1} Urgente" : opts.urgencyLevel === "emergencial" ? "\u{1F534} Emergencial" : "\u{1F7E2} Normal";
  const lines = [
    `\u{1F4CE} *Or\xE7amento Necess\xE1rio \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.requesterName}*!`,
    ``,
    `Sua solicita\xE7\xE3o *${opts.requestNumber}* precisa de or\xE7amento.`
  ];
  if (opts.application) lines.push(`\u{1F4CB} Finalidade: ${opts.application}`);
  if (opts.urgencyLevel) lines.push(`\u26A1 Prioridade: ${urgencyLabel2}`);
  if (opts.department) lines.push(`\u{1F3E2} Departamento: ${opts.department}`);
  if (opts.items && opts.items.length > 0) {
    lines.push(``, `*Itens:*`);
    opts.items.forEach((it, i) => lines.push(`  ${i + 1}. ${it.description} (${it.quantity} ${it.unit})`));
  }
  if (opts.totalValue) lines.push(``, `\u{1F4B0} Valor estimado: R$ ${opts.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  lines.push(
    ``,
    `Agora voc\xEA precisa *anexar o PDF do or\xE7amento* para continuar o processo.`,
    ``,
    `\u{1F517} Anexar or\xE7amento no app:`,
    `${APP_BASE_URL}/request/${opts.requestId}`,
    ``,
    `_Voc\xEA tem 48h para anexar o or\xE7amento._`
  );
  return sendWhatsAppMessage(opts.requesterPhone, lines.join("\n"));
}
async function notifyAutoCancellation(opts) {
  const message = [
    `\u{1F6AB} *Solicita\xE7\xE3o Cancelada \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.requesterName}*!`,
    ``,
    `Sua solicita\xE7\xE3o *${opts.requestNumber}* foi *cancelada automaticamente*.`,
    ``,
    `*Motivo:* ${opts.reason}`,
    ``,
    `Se necess\xE1rio, crie uma nova solicita\xE7\xE3o no app.`,
    opts.requestId ? `` : null,
    opts.requestId ? `\u{1F517} Ver detalhes no app:` : null,
    opts.requestId ? `${APP_BASE_URL}/request/${opts.requestId}` : null
  ].filter(Boolean).join("\n");
  return sendWhatsAppMessage(opts.requesterPhone, message);
}
async function notifyApproverActionConfirmation(opts) {
  const link = opts.requestId ? [``, `\u{1F517} Ver solicita\xE7\xE3o no app:`, `${APP_BASE_URL}/request/${opts.requestId}`] : [];
  const message = opts.action === "approved" ? [
    `\u2705 *Aprova\xE7\xE3o registrada!*`,
    ``,
    `Ol\xE1, *${opts.approverName}*!`,
    ``,
    `Sua aprova\xE7\xE3o da solicita\xE7\xE3o *${opts.requestNumber}* foi registrada com sucesso no sistema CGS Agr\xEDcola.`,
    ...link
  ].join("\n") : [
    `\u274C *Rejei\xE7\xE3o registrada!*`,
    ``,
    `Ol\xE1, *${opts.approverName}*!`,
    ``,
    `Sua rejei\xE7\xE3o da solicita\xE7\xE3o *${opts.requestNumber}* foi registrada.`,
    opts.comment ? `*Motivo informado:* ${opts.comment}` : "",
    ``,
    `O solicitante ser\xE1 notificado para realizar as corre\xE7\xF5es.`,
    ...link
  ].filter(Boolean).join("\n");
  return sendWhatsAppMessage(opts.approverPhone, message);
}
async function notifyNewUserRegistration(opts) {
  const message = [
    `\u{1F44B} *Bem-vindo ao CompraF\xE1cil \u2014 CGS Agr\xEDcola!*`,
    ``,
    `Ol\xE1, *${opts.userName}*!`,
    ``,
    `Sua conta foi criada no sistema de gest\xE3o de compras da CGS Agr\xEDcola.`,
    ``,
    opts.jobTitle ? `*Cargo:* ${opts.jobTitle}` : null,
    opts.userEmail ? `*E-mail:* ${opts.userEmail}` : null,
    `*Cadastrado por:* ${opts.registeredByName}`,
    ``,
    `Acesse o app para configurar sua conta e come\xE7ar a usar o sistema.`,
    ``,
    `\u{1F4F1} *CompraF\xE1cil \u2014 CGS Agr\xEDcola*`
  ].filter(Boolean).join("\n");
  return sendWhatsAppMessage(opts.userPhone, message);
}
async function sendDailyDeadlineReport(opts) {
  const URGENCY_EMOJI = {
    emergencial: "\u{1F534}",
    urgente: "\u{1F7E1}",
    normal: "\u{1F7E2}"
  };
  const STATUS_LABELS = {
    aguardando_gerente: "Aguard. Gerente",
    aguardando_orcamento: "Aguard. Or\xE7amento",
    aguardando_controladoria: "Aguard. Controladoria",
    aguardando_diretoria: "Aguard. Diretoria",
    aguardando_ordem_compra: "Aguard. Ordem de Compra",
    aguardando_financeiro: "Aguard. Financeiro"
  };
  const formatItem = (r) => {
    const emoji = URGENCY_EMOJI[r.urgencyLevel] ?? "\u26AA";
    const deadline = r.deadlineAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const step = STATUS_LABELS[r.status] ?? r.status;
    return `${emoji} *${r.requestNumber}* \u2014 ${r.application.substring(0, 30)}
   Solicitante: ${r.requesterName} | Etapa: ${step}
   \u23F1 Prazo: ${deadline}`;
  };
  const lines = [
    `\u{1F4CA} *Relat\xF3rio Di\xE1rio de Compras \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.masterName}*! Aqui est\xE1 o resumo de hoje:`,
    ``
  ];
  if (opts.alreadyExpired.length > 0) {
    lines.push(`\u{1F6A8} *PRAZOS VENCIDOS (${opts.alreadyExpired.length})*`);
    opts.alreadyExpired.slice(0, 5).forEach((r) => lines.push(formatItem(r)));
    if (opts.alreadyExpired.length > 5) lines.push(`   ... e mais ${opts.alreadyExpired.length - 5} solicita\xE7\xE3o(\xF5es)`);
    lines.push(``);
  }
  if (opts.expiringSoon.length > 0) {
    lines.push(`\u23F0 *VENCEM NAS PR\xD3XIMAS 24H (${opts.expiringSoon.length})*`);
    opts.expiringSoon.slice(0, 5).forEach((r) => lines.push(formatItem(r)));
    if (opts.expiringSoon.length > 5) lines.push(`   ... e mais ${opts.expiringSoon.length - 5} solicita\xE7\xE3o(\xF5es)`);
    lines.push(``);
  }
  if (opts.expiringSoon.length === 0 && opts.alreadyExpired.length === 0) {
    lines.push(`\u2705 *Nenhuma solicita\xE7\xE3o com prazo cr\xEDtico hoje!*`);
    lines.push(`Todas as solicita\xE7\xF5es est\xE3o dentro do prazo.`);
    lines.push(``);
  }
  lines.push(`\u{1F4F1} *CompraF\xE1cil \u2014 CGS Agr\xEDcola*`);
  return sendWhatsAppMessage(opts.masterPhone, lines.join("\n"));
}
async function sendWhatsAppTestMessage(opts) {
  const now = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const message = [
    `\u2705 *Teste de Notifica\xE7\xE3o WhatsApp \u2014 CGS Agr\xEDcola*`,
    ``,
    `Ol\xE1, *${opts.userName}*!`,
    ``,
    `Esta \xE9 uma mensagem de teste enviada pelo sistema de compras da CGS Agr\xEDcola.`,
    ``,
    `*Enviado por:* ${opts.senderName}`,
    `*Hor\xE1rio:* ${now}`,
    ``,
    `Se voc\xEA recebeu esta mensagem, seu n\xFAmero est\xE1 corretamente configurado para receber notifica\xE7\xF5es de aprova\xE7\xE3o.`,
    ``,
    `\u{1F4F1} *CompraF\xE1cil \u2014 CGS Agr\xEDcola*`
  ].join("\n");
  return sendWhatsAppMessage(opts.phone, message);
}
function getWebhookUrl() {
  const base = resolveServerBaseUrl();
  if (base && base !== APP_BASE_URL) return `${base}/api/whatsapp/webhook`;
  if (WEBHOOK_BASE_URL) return `${WEBHOOK_BASE_URL}/api/whatsapp/webhook`;
  return "(configure WEBHOOK_BASE_URL no servidor para obter a URL)";
}
function isConfigured() {
  return !!(ZAPI_INSTANCE_ID && ZAPI_TOKEN) || !!(WHATSAPP_API_URL && WHATSAPP_API_TOKEN);
}
function getProviderInfo() {
  return {
    provider: PROVIDER || "n\xE3o configurado",
    configured: isConfigured(),
    webhookUrl: getWebhookUrl()
  };
}
var ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN, PROVIDER, WHATSAPP_API_URL, WHATSAPP_API_TOKEN, WHATSAPP_FROM, APP_BASE_URL, WEBHOOK_BASE_URL;
var init_whatsapp = __esm({
  "server/whatsapp.ts"() {
    "use strict";
    init_db();
    init_schema();
    ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID ?? "";
    ZAPI_TOKEN = process.env.ZAPI_TOKEN ?? "";
    ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN ?? "";
    PROVIDER = ZAPI_INSTANCE_ID ? "zapi" : (process.env.WHATSAPP_PROVIDER ?? "").toLowerCase();
    WHATSAPP_API_URL = ZAPI_INSTANCE_ID ? `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text` : process.env.WHATSAPP_API_URL ?? "";
    WHATSAPP_API_TOKEN = ZAPI_CLIENT_TOKEN || (process.env.WHATSAPP_API_TOKEN ?? "");
    WHATSAPP_FROM = process.env.WHATSAPP_FROM ?? "";
    APP_BASE_URL = process.env.APP_BASE_URL ?? "https://compras.cgsagricola.com.br";
    WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL ?? "";
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  addRequestToMalote: () => addRequestToMalote,
  approveRequest: () => approveRequest,
  attachBudget: () => attachBudget,
  attachInvoice: () => attachInvoice,
  attachOCSiagri: () => attachOCSiagri,
  attachPaymentProof: () => attachPaymentProof,
  cancelRequest: () => cancelRequest,
  createApiKey: () => createApiKey,
  createAsset: () => createAsset,
  createBudget: () => createBudget,
  createBusinessUnit: () => createBusinessUnit,
  createCostCenter: () => createCostCenter,
  createDepartment: () => createDepartment,
  createHarvest: () => createHarvest,
  createMalote: () => createMalote,
  createMaloteTag: () => createMaloteTag,
  createPurchaseRequest: () => createPurchaseRequest,
  createUnit: () => createUnit,
  deductFromBudget: () => deductFromBudget,
  deleteApiKey: () => deleteApiKey,
  deleteAsset: () => deleteAsset,
  deleteBudget: () => deleteBudget,
  deleteBusinessUnit: () => deleteBusinessUnit,
  deleteCostCenter: () => deleteCostCenter,
  deleteDepartment: () => deleteDepartment,
  deleteHarvest: () => deleteHarvest,
  deletePurchaseRequest: () => deletePurchaseRequest,
  deleteUnit: () => deleteUnit,
  deleteUser: () => deleteUser,
  finalizeOC: () => finalizeOC,
  getAllRequests: () => getAllRequests,
  getApprovalHistory: () => getApprovalHistory,
  getApprovalTimingStats: () => getApprovalTimingStats,
  getBudgetAnalysis: () => getBudgetAnalysis,
  getBudgetSummary: () => getBudgetSummary,
  getCompletedRequestsWithItems: () => getCompletedRequestsWithItems,
  getDashboardStats: () => getDashboardStats,
  getDb: () => getDb,
  getMaloteStats: () => getMaloteStats,
  getMaloteTagsForMalote: () => getMaloteTagsForMalote,
  getMaloteWithItems: () => getMaloteWithItems,
  getMonthlyReport: () => getMonthlyReport,
  getNextDepartmentCode: () => getNextDepartmentCode,
  getPendingRequestsForUser: () => getPendingRequestsForUser,
  getPurchaseRequestWithDetails: () => getPurchaseRequestWithDetails,
  getRankingByCostCenter: () => getRankingByCostCenter,
  getRankingByItem: () => getRankingByItem,
  getRequestsByRequester: () => getRequestsByRequester,
  getRequestsReadyForMalote: () => getRequestsReadyForMalote,
  getUserByEmail: () => getUserByEmail,
  getUserByEmailForLogin: () => getUserByEmailForLogin,
  getUserById: () => getUserById,
  getUserByOpenId: () => getUserByOpenId,
  importAssetsBatch: () => importAssetsBatch,
  importBusinessUnitsBatch: () => importBusinessUnitsBatch,
  importCostCentersBatch: () => importCostCentersBatch,
  importDepartmentsBatch: () => importDepartmentsBatch,
  importUnitsBatch: () => importUnitsBatch,
  importUsersBatch: () => importUsersBatch,
  linkUserByEmail: () => linkUserByEmail,
  listAllCostCenters: () => listAllCostCenters,
  listApiKeys: () => listApiKeys,
  listAssets: () => listAssets,
  listBudgets: () => listBudgets,
  listBusinessUnits: () => listBusinessUnits,
  listCostCenters: () => listCostCenters,
  listDepartments: () => listDepartments,
  listHarvests: () => listHarvests,
  listMaloteTags: () => listMaloteTags,
  listMalotes: () => listMalotes,
  listUnits: () => listUnits,
  listUsers: () => listUsers,
  receiveMalote: () => receiveMalote,
  rejectRequest: () => rejectRequest,
  removeRequestFromMalote: () => removeRequestFromMalote,
  reopenRequest: () => reopenRequest,
  revokeApiKey: () => revokeApiKey,
  saveBudgetAnalysis: () => saveBudgetAnalysis,
  sendMalote: () => sendMalote,
  setMaloteTags: () => setMaloteTags,
  submitBudget: () => submitBudget,
  toggleCostCenterActive: () => toggleCostCenterActive,
  toggleUserActive: () => toggleUserActive,
  updateAsset: () => updateAsset,
  updateBudget: () => updateBudget,
  updateBusinessUnit: () => updateBusinessUnit,
  updateByControladoria: () => updateByControladoria,
  updateCostCenter: () => updateCostCenter,
  updateDepartment: () => updateDepartment,
  updateHarvest: () => updateHarvest,
  updateMaloteTag: () => updateMaloteTag,
  updateMasterPin: () => updateMasterPin,
  updatePurchaseRequest: () => updatePurchaseRequest,
  updateUnit: () => updateUnit,
  updateUserPassword: () => updateUserPassword,
  updateUserProfile: () => updateUserProfile,
  upsertUser: () => upsertUser,
  upsertUserByAdmin: () => upsertUserByAdmin,
  validateApiKey: () => validateApiKey,
  verifyMasterPin: () => verifyMasterPin
});
import {
  and as and2,
  desc,
  eq as eq2,
  gte,
  inArray,
  lte,
  or,
  sql
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool as createPromisePool } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = createPromisePool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 1e4
      });
      _db = drizzle(pool);
      console.log("[Database] Connection pool created successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  textFields.forEach((field) => {
    const value = user[field];
    if (value === void 0) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq2(users.openId, openId)).limit(1);
  return result[0];
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq2(users.email, email)).limit(1);
  return result[0];
}
async function linkUserByEmail(oauthOpenId, email) {
  const db = await getDb();
  if (!db || !email) return false;
  const existing = await getUserByEmail(email);
  if (!existing || existing.openId === oauthOpenId) return false;
  console.log(`[Auth] Linking pre-registered user '${existing.name}' (${email}) to OAuth openId: ${oauthOpenId}`);
  await db.update(users).set({ openId: oauthOpenId, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, existing.id));
  return true;
}
async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq2(users.id, id)).limit(1);
  return result[0] ?? null;
}
async function updateUserProfile(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update = {};
  if (data.procurementRole) update.procurementRole = data.procurementRole;
  if (data.department !== void 0) update.department = data.department;
  if (data.phone !== void 0) update.phone = data.phone;
  if (data.jobTitle !== void 0) update.jobTitle = data.jobTitle;
  if (data.approvalLevel !== void 0) update.approvalLevel = data.approvalLevel;
  await db.update(users).set(update).where(eq2(users.id, userId));
}
async function getUserByEmailForLogin(email) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq2(users.email, email));
  if (result.length === 0) return null;
  const withPassword = result.find((u) => u.passwordHash);
  return withPassword ?? result[0];
}
async function updateUserPassword(userId, passwordHash) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq2(users.id, userId));
}
async function upsertUserByAdmin(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let finalPasswordHash = data.passwordHash;
  if (data.password) {
    const bcrypt3 = await import("bcryptjs");
    finalPasswordHash = await bcrypt3.hash(data.password, 10);
  }
  if (data.email && data.email.trim() !== "") {
    const emailConflict = await db.select({ id: users.id }).from(users).where(eq2(users.email, data.email.trim())).limit(1);
    if (emailConflict.length > 0 && emailConflict[0].id !== data.id) {
      throw new Error("Este e-mail j\xE1 est\xE1 sendo usado por outro cadastro.");
    }
  }
  const extraRolesJson = data.extraRoles && data.extraRoles.length > 0 ? JSON.stringify([...new Set(data.extraRoles.filter((r) => r !== data.procurementRole))]) : null;
  const extraApprovalLevelsJson = data.extraApprovalLevels && data.extraApprovalLevels.length > 0 ? JSON.stringify([...new Set(data.extraApprovalLevels.filter((l) => l !== (data.approvalLevel ?? "nenhum")))]) : null;
  if (data.id) {
    await db.update(users).set({
      name: data.name,
      email: data.email ?? null,
      procurementRole: data.procurementRole,
      extraRoles: extraRolesJson,
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: data.approvalLevel ?? "nenhum",
      extraApprovalLevels: extraApprovalLevelsJson,
      active: data.active ?? true,
      ...finalPasswordHash !== void 0 ? { passwordHash: finalPasswordHash } : {}
    }).where(eq2(users.id, data.id));
    return { id: data.id };
  } else {
    const openId = `admin_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const result = await db.insert(users).values({
      openId,
      name: data.name,
      email: data.email || null,
      procurementRole: data.procurementRole,
      extraRoles: extraRolesJson,
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: data.approvalLevel ?? "nenhum",
      extraApprovalLevels: extraApprovalLevelsJson,
      active: data.active ?? true,
      lastSignedIn: /* @__PURE__ */ new Date(),
      ...finalPasswordHash !== void 0 ? { passwordHash: finalPasswordHash } : {}
    });
    const insertId = result[0]?.insertId ?? 0;
    return { id: insertId };
  }
}
async function importUsersBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  let errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (row.email) {
        const existing = await db.select({ id: users.id }).from(users).where(eq2(users.email, row.email)).limit(1);
        if (existing.length > 0) {
          await db.update(users).set({
            name: row.name,
            phone: row.phone ?? null,
            department: row.department ?? null,
            procurementRole: row.procurementRole
          }).where(eq2(users.email, row.email));
        } else {
          await db.insert(users).values({
            openId: `import_${Date.now()}_${i}`,
            name: row.name,
            email: row.email,
            phone: row.phone ?? null,
            department: row.department ?? null,
            procurementRole: row.procurementRole,
            active: true,
            lastSignedIn: /* @__PURE__ */ new Date()
          });
        }
      } else {
        await db.insert(users).values({
          openId: `import_${Date.now()}_${i}`,
          name: row.name,
          phone: row.phone ?? null,
          department: row.department ?? null,
          procurementRole: row.procurementRole,
          active: true,
          lastSignedIn: /* @__PURE__ */ new Date()
        });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function toggleUserActive(id, active) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ active }).where(eq2(users.id, id));
}
async function deleteUser(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ active: false }).where(eq2(users.id, id));
}
async function listCostCenters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(costCenters).where(eq2(costCenters.active, true)).orderBy(costCenters.code);
}
async function listAllCostCenters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(costCenters).orderBy(costCenters.code);
}
async function toggleCostCenterActive(id, active) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set({ active }).where(eq2(costCenters.id, id));
}
async function createCostCenter(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(costCenters).values({
    code: data.code,
    name: data.name,
    responsible: data.responsible ?? null
  });
  return result[0].insertId;
}
async function updateCostCenter(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set(data).where(eq2(costCenters.id, id));
}
async function deleteCostCenter(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set({ active: false }).where(eq2(costCenters.id, id));
}
async function importCostCentersBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: costCenters.id }).from(costCenters).where(eq2(costCenters.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(costCenters).set({ name: row.name, responsible: row.responsible ?? null }).where(eq2(costCenters.code, row.code));
      } else {
        await db.insert(costCenters).values({ code: row.code, name: row.name, responsible: row.responsible ?? null });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function listAssets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(eq2(assets.active, true)).orderBy(assets.code);
}
async function generatePatrimonialCode(db) {
  const [row] = await db.execute(
    "SELECT patrimonialCode FROM assets WHERE patrimonialCode LIKE 'PAT-%' ORDER BY patrimonialCode DESC LIMIT 1"
  );
  const last = row?.[0]?.patrimonialCode;
  const lastNum = last ? parseInt(last.replace("PAT-", ""), 10) : 0;
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return "PAT-" + String(next).padStart(5, "0");
}
async function createAsset(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patrimonialCode = await generatePatrimonialCode(db);
  const result = await db.insert(assets).values({
    code: data.code,
    description: data.description,
    category: data.category ?? null,
    location: data.location ?? null,
    value: data.value ?? null,
    hasChassi: data.hasChassi ?? false,
    chassiNumber: data.chassiNumber ?? null,
    licensePlate: data.licensePlate ?? null,
    patrimonialCode
  });
  return result[0].insertId;
}
async function updateAsset(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets).set(data).where(eq2(assets.id, id));
}
async function deleteAsset(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets).set({ active: false }).where(eq2(assets.id, id));
}
async function importAssetsBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: assets.id }).from(assets).where(eq2(assets.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(assets).set({ description: row.description, category: row.category ?? null, location: row.location ?? null, value: row.value ?? null, hasChassi: row.hasChassi ?? false, chassiNumber: row.chassiNumber ?? null, licensePlate: row.licensePlate ?? null }).where(eq2(assets.code, row.code));
      } else {
        await db.insert(assets).values({ code: row.code, description: row.description, category: row.category ?? null, location: row.location ?? null, value: row.value ?? null, hasChassi: row.hasChassi ?? false, chassiNumber: row.chassiNumber ?? null, licensePlate: row.licensePlate ?? null });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function generateRequestNumber(db) {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const prefix = `SOL-${year}-`;
  const [row] = await db.select({ maxNum: sql`MAX(CAST(SUBSTRING(${purchaseRequests.requestNumber}, ${prefix.length + 1}) AS UNSIGNED))` }).from(purchaseRequests).where(sql`${purchaseRequests.requestNumber} LIKE ${prefix + "%"}`);
  const lastSeq = row?.maxNum ? Number(row.maxNum) : 0;
  const seq = String(lastSeq + 1).padStart(4, "0");
  return `SOL-${year}-${seq}`;
}
function getDeadlineDate(urgencyLevel) {
  const days = urgencyLevel === "emergencial" ? 1 : urgencyLevel === "urgente" ? 3 : 7;
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() + days);
  return date;
}
function getStepDeadline() {
  const date = /* @__PURE__ */ new Date();
  date.setHours(date.getHours() + 48);
  return date;
}
async function createPurchaseRequest(user, input) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const requestNumber = await generateRequestNumber(db);
  const deadlineAt = getDeadlineDate(input.urgencyLevel);
  const stepDeadlineAt = getStepDeadline();
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }
  const result = await db.insert(purchaseRequests).values({
    requestNumber,
    requesterId: user.id,
    requesterName: user.name ?? "Usu\xE1rio",
    department: input.department,
    costCenterId: input.costCenterId ?? null,
    costCenterCode: input.costCenterCode ?? null,
    application: input.application,
    urgencyLevel: input.urgencyLevel,
    observations: input.observations ?? null,
    osMyfarm: input.osMyfarm ?? null,
    totalEstimatedValue: total > 0 ? String(total) : null,
    // Todos os pedidos começam pelo Gerente (urgentes/emergenciais vão para Diretoria após o Gerente)
    status: "aguardando_gerente",
    deadlineAt,
    stepDeadlineAt
  });
  const insertId = result[0].insertId;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId: insertId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null
    });
  }
  await db.insert(approvalHistory).values({
    requestId: insertId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: "criacao",
    action: "criada",
    comment: `Solicita\xE7\xE3o criada. Prazo: ${deadlineAt.toLocaleDateString("pt-BR")}`
  });
  try {
    const approverRole = "gerente";
    const stepLabel = "Gerente de Unidade";
    const approvers = await db.select().from(users).where(and2(
      eq2(users.active, true),
      or(
        eq2(users.procurementRole, approverRole),
        eq2(users.approvalLevel, approverRole)
      )
    ));
    const uniqueApprovers = [...new Map(approvers.map((a) => [a.id, a])).values()];
    console.log(`[WhatsApp] Nova solicita\xE7\xE3o: notificando aprovadores "${approverRole}": ${uniqueApprovers.length} encontrado(s)`);
    for (const approver of uniqueApprovers) {
      const phoneRaw = approver.phone;
      console.log(`[WhatsApp] Aprovador: ${approver.name} | phone raw: ${phoneRaw}`);
      if (phoneRaw) {
        await notifyNewRequest({
          approverPhone: phoneRaw,
          approverName: approver.name ?? "Aprovador",
          requestNumber,
          requestId: insertId,
          requesterName: user.name ?? "Usu\xE1rio",
          application: input.application,
          urgencyLevel: input.urgencyLevel,
          department: input.department,
          stepLabel
        });
      } else {
        console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) n\xE3o tem telefone cadastrado.`);
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to notify approvers:", e);
  }
  return insertId;
}
async function getPurchaseRequestWithDetails(id) {
  const db = await getDb();
  if (!db) return null;
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, id)).limit(1);
  if (!request) return null;
  const items = await db.select().from(requestItems).where(eq2(requestItems.requestId, id));
  const history = await db.select().from(approvalHistory).where(eq2(approvalHistory.requestId, id)).orderBy(approvalHistory.createdAt);
  return { ...request, items, history };
}
async function getRequestsByRequester(requesterId) {
  const db = await getDb();
  if (!db) return [];
  const reqs = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.requesterId, requesterId)).orderBy(desc(purchaseRequests.createdAt));
  if (reqs.length === 0) return [];
  const ids = reqs.map((r) => r.id);
  const allItems = await db.select().from(requestItems).where(inArray(requestItems.requestId, ids));
  return reqs.map((r) => ({ ...r, items: allItems.filter((i) => i.requestId === r.id) }));
}
async function getPendingRequestsForUser(role, extraRoles) {
  const db = await getDb();
  if (!db) return [];
  const allRoles = [role, ...extraRoles ?? []].filter(Boolean);
  const pendingStatuses = /* @__PURE__ */ new Set();
  const dbConn = db;
  async function fetchWithItems(statuses) {
    const reqs = await dbConn.select().from(purchaseRequests).where(inArray(purchaseRequests.status, statuses)).orderBy(purchaseRequests.urgencyLevel, purchaseRequests.deadlineAt);
    if (reqs.length === 0) return [];
    const ids = reqs.map((r) => r.id);
    const allItems = await dbConn.select().from(requestItems).where(inArray(requestItems.requestId, ids));
    return reqs.map((r) => ({ ...r, items: allItems.filter((i) => i.requestId === r.id) }));
  }
  if (allRoles.includes("master")) {
    const allPendingStatuses = [
      "aguardando_gerente",
      "aguardando_orcamento",
      "aguardando_controladoria",
      "aguardando_diretoria",
      "aguardando_ordem_compra",
      "aguardando_aprovacao_compra",
      "aguardando_comprovante_pagamento",
      "aguardando_verificacao_compras"
    ];
    return fetchWithItems(allPendingStatuses);
  }
  for (const r of allRoles) {
    if (r === "orcamento") {
      pendingStatuses.add("aguardando_orcamento");
      pendingStatuses.add("aguardando_ordem_compra");
      pendingStatuses.add("aguardando_verificacao_compras");
    } else {
      if (r === "financeiro") {
        pendingStatuses.add("aguardando_aprovacao_compra");
        pendingStatuses.add("aguardando_comprovante_pagamento");
      } else {
        const singleStatusMap = {
          gerente: "aguardando_gerente",
          controladoria: "aguardando_controladoria",
          diretoria: "aguardando_diretoria"
        };
        const s = singleStatusMap[r];
        if (s) pendingStatuses.add(s);
      }
    }
  }
  if (pendingStatuses.size === 0) return [];
  return fetchWithItems([...pendingStatuses]);
}
async function getAllRequests(departmentFilter) {
  const db = await getDb();
  if (!db) return [];
  const reqs = departmentFilter ? await db.select().from(purchaseRequests).where(eq2(purchaseRequests.department, departmentFilter)).orderBy(desc(purchaseRequests.createdAt)) : await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
  if (reqs.length === 0) return [];
  const ids = reqs.map((r) => r.id);
  const allItems = await db.select().from(requestItems).where(inArray(requestItems.requestId, ids));
  return reqs.map((r) => ({ ...r, items: allItems.filter((i) => i.requestId === r.id) }));
}
async function getDashboardStats(userId, role) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0, emergency: 0 };
  const all = await db.select().from(purchaseRequests);
  const pending = all.filter((r) => r.status.startsWith("aguardando")).length;
  const approved = all.filter((r) => r.status === "concluida").length;
  const rejected = all.filter((r) => r.status === "rejeitada").length;
  const cancelled = all.filter((r) => r.status === "cancelada").length;
  const urgent = all.filter((r) => r.urgencyLevel === "urgente" && r.status.startsWith("aguardando")).length;
  const emergency = all.filter((r) => r.urgencyLevel === "emergencial" && r.status.startsWith("aguardando")).length;
  const now = /* @__PURE__ */ new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1e3);
  const expiringSoon = all.filter(
    (r) => r.status.startsWith("aguardando") && r.deadlineAt != null && r.deadlineAt > now && r.deadlineAt <= in24h
  ).length;
  return { total: all.length, pending, approved, rejected, cancelled, urgent, emergency, expiringSoon };
}
async function getMonthlyReport(year, month) {
  const db = await getDb();
  if (!db) return { requests: [], summary: { total: 0, concluidas: 0, pendentes: 0, rejeitadas: 0, canceladas: 0, totalValue: 0 }, byDepartment: [], byStatus: [], byUrgency: [] };
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const all = await db.select().from(purchaseRequests).where(and2(
    gte(purchaseRequests.createdAt, startDate),
    lte(purchaseRequests.createdAt, endDate)
  )).orderBy(purchaseRequests.createdAt);
  const allIds = all.map((r) => r.id);
  const items = allIds.length > 0 ? await db.select().from(requestItems).where(inArray(requestItems.requestId, allIds)) : [];
  const totalValue = items.reduce((sum, item) => sum + parseFloat(item.totalPrice ?? "0"), 0);
  const summary = {
    total: all.length,
    concluidas: all.filter((r) => r.status === "concluida").length,
    pendentes: all.filter((r) => r.status.startsWith("aguardando")).length,
    rejeitadas: all.filter((r) => r.status === "rejeitada").length,
    canceladas: all.filter((r) => r.status === "cancelada").length,
    totalValue
  };
  const deptMap = /* @__PURE__ */ new Map();
  for (const r of all) {
    const dept = r.department || "N\xE3o informado";
    if (!deptMap.has(dept)) deptMap.set(dept, { department: dept, total: 0, concluidas: 0, pendentes: 0, rejeitadas: 0, totalValue: 0 });
    const entry = deptMap.get(dept);
    entry.total++;
    if (r.status === "concluida") entry.concluidas++;
    else if (r.status.startsWith("aguardando")) entry.pendentes++;
    else if (r.status === "rejeitada" || r.status === "cancelada") entry.rejeitadas++;
    const reqItems = items.filter((i) => i.requestId === r.id);
    entry.totalValue += reqItems.reduce((sum, i) => sum + parseFloat(i.totalPrice ?? "0"), 0);
  }
  const byDepartment = Array.from(deptMap.values()).sort((a, b) => b.total - a.total);
  const statusMap = /* @__PURE__ */ new Map();
  for (const r of all) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  }
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  const urgencyMap = /* @__PURE__ */ new Map();
  for (const r of all) {
    urgencyMap.set(r.urgencyLevel, (urgencyMap.get(r.urgencyLevel) ?? 0) + 1);
  }
  const byUrgency = Array.from(urgencyMap.entries()).map(([urgency, count]) => ({ urgency, count }));
  const requests = all.map((r) => ({
    id: r.id,
    requestNumber: r.requestNumber,
    requesterName: r.requesterName,
    department: r.department,
    application: r.application,
    status: r.status,
    urgencyLevel: r.urgencyLevel,
    totalEstimatedValue: r.totalEstimatedValue,
    createdAt: r.createdAt,
    paymentMethod: r.paymentMethod,
    purchaseOrderNumber: r.purchaseOrderNumber,
    itemCount: items.filter((i) => i.requestId === r.id).length,
    totalValue: items.filter((i) => i.requestId === r.id).reduce((sum, i) => sum + parseFloat(i.totalPrice ?? "0"), 0)
  }));
  return { requests, summary, byDepartment, byStatus, byUrgency };
}
async function getApprovalHistory(requestId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(approvalHistory).where(eq2(approvalHistory.requestId, requestId)).orderBy(approvalHistory.createdAt);
}
async function getApprovalTimingStats() {
  const db = await getDb();
  if (!db) return [];
  const history = await db.select().from(approvalHistory).where(inArray(approvalHistory.action, ["aprovada", "rejeitada", "compra_aprovada", "compra_cancelada", "oc_finalizada", "pagamento_verificado"])).orderBy(approvalHistory.requestId, approvalHistory.createdAt);
  const allHistory = await db.select().from(approvalHistory).orderBy(approvalHistory.requestId, approvalHistory.createdAt);
  const byRequest = /* @__PURE__ */ new Map();
  for (const h of allHistory) {
    if (!byRequest.has(h.requestId)) byRequest.set(h.requestId, []);
    byRequest.get(h.requestId).push(h);
  }
  const STEP_LABELS = {
    gerente: "Gerente",
    orcamento: "Or\xE7amento",
    controladoria: "Controladoria",
    diretoria: "Diretoria",
    ordem_compra: "Emiss\xE3o de OC",
    aprovacao_compra: "Financeiro",
    financeiro: "Comprovante",
    verificacao_compras: "Verifica\xE7\xE3o Final"
  };
  const stepTimes = /* @__PURE__ */ new Map();
  for (const decision of history) {
    const reqHistory = byRequest.get(decision.requestId) ?? [];
    const idx = reqHistory.findIndex((h) => h.id === decision.id);
    if (idx <= 0) continue;
    const prev = reqHistory[idx - 1];
    const diffMs = new Date(decision.createdAt).getTime() - new Date(prev.createdAt).getTime();
    const diffHours = diffMs / (1e3 * 60 * 60);
    if (diffHours <= 0 || diffHours > 720) continue;
    const step = decision.step;
    if (!STEP_LABELS[step]) continue;
    if (!stepTimes.has(step)) stepTimes.set(step, { totalHours: 0, count: 0 });
    const entry = stepTimes.get(step);
    entry.totalHours += diffHours;
    entry.count++;
  }
  const result = Array.from(stepTimes.entries()).map(([step, { totalHours, count }]) => ({
    step,
    label: STEP_LABELS[step] ?? step,
    avgHours: Math.round(totalHours / count * 10) / 10,
    count
  })).sort((a, b) => b.avgHours - a.avgHours);
  return result;
}
async function attachBudget(requestId, userId, userName, fileUrl, fileName) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select({ budgetFileUrl: purchaseRequests.budgetFileUrl, status: purchaseRequests.status }).from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!existing) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  const ALLOWED_BUDGET_STATUSES = ["aguardando_orcamento", "aguardando_controladoria"];
  if (!ALLOWED_BUDGET_STATUSES.includes(existing.status)) {
    throw new Error(`N\xE3o \xE9 poss\xEDvel anexar or\xE7amento nesta etapa. A solicita\xE7\xE3o est\xE1 em "${existing.status}" e o or\xE7amento s\xF3 pode ser enviado ou substitu\xEDdo quando aguardando or\xE7amento ou controladoria.`);
  }
  const isSubstitution = !!existing?.budgetFileUrl;
  const fileLabel = fileName ? `"${fileName}"` : "PDF";
  const now = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  await db.update(purchaseRequests).set({
    budgetFileUrl: fileUrl
  }).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId,
    userName,
    step: "orcamento",
    action: "orcamento_anexado",
    comment: isSubstitution ? `Or\xE7amento substitu\xEDdo por ${userName} em ${now} \u2014 Arquivo: ${fileLabel}` : `Or\xE7amento em PDF anexado \u2014 aguardando envio`
  });
}
function getStepFlow(urgencyLevel) {
  return urgencyLevel === "urgente" || urgencyLevel === "emergencial" ? STEP_FLOW_URGENT : STEP_FLOW_NORMAL;
}
function getRejectFlow(urgencyLevel) {
  return urgencyLevel === "urgente" || urgencyLevel === "emergencial" ? REJECT_FLOW_URGENT : REJECT_FLOW_NORMAL;
}
async function submitBudget(requestId, user, estimatedValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  if (request.status !== "aguardando_orcamento") throw new Error("Esta solicita\xE7\xE3o n\xE3o est\xE1 aguardando or\xE7amento.");
  if (!request.budgetFileUrl) throw new Error("Anexe o PDF do or\xE7amento antes de enviar.");
  const isUrgent = request.urgencyLevel === "urgente" || request.urgencyLevel === "emergencial";
  let nextStatus;
  if (isUrgent && request.orcamentoFeitoUrgente) {
    nextStatus = "aguardando_controladoria";
  } else {
    const stepFlow = getStepFlow(request.urgencyLevel);
    const flow = stepFlow["aguardando_orcamento"];
    if (!flow) throw new Error("Fluxo de or\xE7amento n\xE3o configurado");
    nextStatus = flow.nextStatus;
  }
  await db.update(purchaseRequests).set({
    status: nextStatus,
    stepDeadlineAt: getStepDeadline(),
    // Salvar o valor estimado da OC definido pelo Orçamento
    ...estimatedValue != null ? { totalEstimatedValue: String(estimatedValue) } : {},
    // Marcar que o orçamento já foi feito ao menos uma vez (para fluxo urgente/emergencial)
    ...isUrgent ? { orcamentoFeitoUrgente: true } : {}
  }).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: "orcamento",
    action: "aprovada",
    comment: "Or\xE7amento enviado"
  });
  try {
    const WA = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    const nextRoleMap = {
      aguardando_controladoria: "controladoria",
      aguardando_diretoria: "diretoria"
    };
    const nextRole = nextRoleMap[nextStatus];
    if (nextRole) {
      const { users: usersTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { or: or2, eq: eqDrizzle, and: and3 } = await import("drizzle-orm");
      const nextApproversRaw = await db.select().from(usersTable).where(and3(
        eqDrizzle(usersTable.active, true),
        or2(
          eqDrizzle(usersTable.procurementRole, nextRole),
          eqDrizzle(usersTable.approvalLevel, nextRole)
        )
      ));
      const nextApprovers = [...new Map(nextApproversRaw.map((a) => [a.id, a])).values()];
      const [req] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
      const items = await db.select().from(requestItems).where(eq2(requestItems.requestId, requestId));
      const itemsForMsg = items.map((it) => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
      const STEP_LABELS = {
        aguardando_controladoria: "Aprova\xE7\xE3o Controladoria",
        aguardando_diretoria: "Aprova\xE7\xE3o Diretoria"
      };
      for (const approver of nextApprovers) {
        if (approver.phone) {
          await WA.notifyApproverWithToken({
            approverPhone: approver.phone,
            approverName: approver.name ?? "Aprovador",
            approverId: approver.id,
            requestNumber: req.requestNumber,
            requestId,
            requesterName: req.requesterName,
            application: req.application,
            urgencyLevel: req.urgencyLevel,
            department: req.department,
            stepLabel: STEP_LABELS[nextStatus] ?? nextStatus,
            step: nextRole,
            items: itemsForMsg,
            totalValue: req.totalEstimatedValue ?? void 0
          });
        } else {
          console.warn(`[submitBudget] Aprovador ${approver.name} (id=${approver.id}) n\xE3o tem telefone cadastrado.`);
        }
      }
      console.log(`[submitBudget] Notificados ${nextApprovers.length} aprovador(es) para etapa "${nextRole}"`);
    }
  } catch (notifyErr) {
    console.warn("[submitBudget] Falha ao notificar aprovadores:", notifyErr);
  }
  return { success: true, nextStatus };
}
async function approveRequest(requestId, user, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  const STEP_ROLE_MAP = {
    aguardando_gerente: ["gerente", "master"],
    aguardando_orcamento: ["orcamento", "master"],
    aguardando_controladoria: ["controladoria", "master"],
    aguardando_diretoria: ["diretoria", "master"],
    aguardando_ordem_compra: ["orcamento", "master"],
    aguardando_aprovacao_compra: ["financeiro", "master"],
    aguardando_comprovante_pagamento: ["financeiro", "master"],
    aguardando_verificacao_compras: ["orcamento", "master"],
    rejeitada: ["master"]
  };
  const allowedRoles = STEP_ROLE_MAP[request.status];
  if (allowedRoles) {
    const userProcurementRole = user.procurementRole ?? "";
    const userApprovalLevel = user.approvalLevel ?? "nenhum";
    const userExtraRoles = (() => {
      try {
        return JSON.parse(user.extraRoles ?? "[]");
      } catch {
        return [];
      }
    })();
    const userExtraApprovalLevels = (() => {
      try {
        return JSON.parse(user.extraApprovalLevels ?? "[]");
      } catch {
        return [];
      }
    })();
    const isMaster = userApprovalLevel === "master";
    const hasPermission = isMaster || allowedRoles.includes(userProcurementRole) || allowedRoles.includes(userApprovalLevel) || userExtraRoles.some((r) => allowedRoles.includes(r)) || userExtraApprovalLevels.some((l) => allowedRoles.includes(l));
    if (!hasPermission) {
      const stepLabel = {
        aguardando_gerente: "Gerente",
        aguardando_orcamento: "Or\xE7amento",
        aguardando_controladoria: "Controladoria",
        aguardando_diretoria: "Diretoria",
        aguardando_ordem_compra: "Compras",
        aguardando_aprovacao_compra: "Financeiro",
        aguardando_comprovante_pagamento: "Financeiro",
        aguardando_verificacao_compras: "Compras"
      }[request.status] ?? request.status;
      throw new Error(`Voc\xEA n\xE3o tem permiss\xE3o para aprovar a etapa "${stepLabel}". Apenas usu\xE1rios com o papel correto podem executar esta a\xE7\xE3o.`);
    }
  }
  const stepFlow = getStepFlow(request.urgencyLevel);
  const flow = stepFlow[request.status];
  if (!flow) throw new Error("A\xE7\xE3o n\xE3o permitida neste status");
  ;
  if (request.status === "aguardando_orcamento" && !request.budgetFileUrl) {
    throw new Error('\xC9 obrigat\xF3rio anexar o PDF do or\xE7amento antes de aprovar esta etapa. Clique em "Anexar Or\xE7amento" e envie o arquivo para continuar.');
  }
  if (request.status === "aguardando_diretoria" && !request.budgetFileUrl) {
    throw new Error("N\xE3o \xE9 poss\xEDvel aprovar a etapa da Diretoria sem or\xE7amento anexado. O respons\xE1vel pelo or\xE7amento deve enviar o PDF antes desta aprova\xE7\xE3o.");
  }
  if (request.status === "aguardando_diretoria") {
    await db.update(purchaseRequests).set({
      directorApprovals: null
    }).where(eq2(purchaseRequests.id, requestId));
  }
  const effectiveNextStatus = flow.nextStatus;
  const updateData = {
    status: effectiveNextStatus,
    stepDeadlineAt: getStepDeadline()
  };
  if (data.purchaseOrderNumber) updateData.purchaseOrderNumber = data.purchaseOrderNumber;
  if (data.orderValue != null) updateData.orderValue = String(data.orderValue);
  if (data.paymentInfo) updateData.paymentInfo = data.paymentInfo;
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
  if (data.paymentObservations) updateData.paymentObservations = data.paymentObservations;
  if (data.paymentInstallments) updateData.paymentInstallments = data.paymentInstallments;
  await db.update(purchaseRequests).set(updateData).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: flow.step,
    action: flow.action,
    comment: data.comment ?? null
  });
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
    const [requester] = req ? await db.select().from(users).where(eq2(users.id, req.requesterId)).limit(1) : [];
    const items = await db.select().from(requestItems).where(eq2(requestItems.requestId, requestId));
    const itemsForMsg = items.map((it) => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
    const nextRoleMap = {
      aguardando_gerente: "gerente",
      // aguardando_orcamento: removido intencionalmente para evitar looping
      aguardando_controladoria: "controladoria",
      aguardando_diretoria: "diretoria",
      aguardando_ordem_compra: "orcamento",
      // Fluxo 06: OC → Orçamento
      aguardando_aprovacao_compra: "financeiro",
      // Fluxo 06b: Aprovação de Compra → Financeiro
      aguardando_comprovante_pagamento: "financeiro",
      // Fluxo 07: Comprovante → Financeiro
      aguardando_verificacao_compras: "orcamento"
      // Fluxo 08: Verificação Final → Orçamento
    };
    const isUrgentOrEmergency = request.urgencyLevel === "urgente" || request.urgencyLevel === "emergencial";
    if (effectiveNextStatus === "aguardando_orcamento") {
      if (requester?.phone) {
        await notifyBudgetRequired({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId
        });
      }
    } else if (effectiveNextStatus === "concluida") {
      if (requester?.phone) {
        await notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Aprovador",
          stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status
        });
      }
    } else {
      if (requester?.phone) {
        await notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Aprovador",
          stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
          nextStepLabel: STEP_LABELS_SERVER[flow.nextStatus]
        });
      }
    }
    const nextRole = nextRoleMap[flow.nextStatus];
    if (nextRole && req) {
      const nextApproversRaw = await db.select().from(users).where(and2(
        eq2(users.active, true),
        or(
          eq2(users.procurementRole, nextRole),
          eq2(users.approvalLevel, nextRole)
        )
      ));
      const nextApprovers = [...new Map(nextApproversRaw.map((a) => [a.id, a])).values()];
      console.log(`[WhatsApp] Notificando aprovadores para etapa "${nextRole}": ${nextApprovers.length} encontrado(s)`);
      for (const approver of nextApprovers) {
        const phoneRaw = approver.phone;
        console.log(`[WhatsApp] Aprovador: ${approver.name} | phone raw: ${phoneRaw}`);
        if (phoneRaw) {
          await notifyApproverWithToken({
            approverPhone: phoneRaw,
            // normalizePhone é chamado dentro de sendWhatsAppMessage
            approverName: approver.name ?? "Aprovador",
            approverId: approver.id,
            requestNumber: req.requestNumber,
            requestId,
            requesterName: req.requesterName,
            application: req.application,
            urgencyLevel: req.urgencyLevel,
            department: req.department,
            stepLabel: STEP_LABELS_SERVER[flow.nextStatus] ?? flow.nextStatus,
            step: nextRole,
            items: itemsForMsg,
            totalValue: req.totalEstimatedValue ?? void 0
          });
        } else {
          console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) n\xE3o tem telefone cadastrado.`);
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send notifications:", e);
  }
}
async function rejectRequest(requestId, user, comment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  const stepFlow = getStepFlow(request.urgencyLevel);
  const rejectFlow = getRejectFlow(request.urgencyLevel);
  const flow = stepFlow[request.status];
  const prevStatus = rejectFlow[request.status] ?? "aguardando_gerente";
  await db.update(purchaseRequests).set({
    status: prevStatus,
    stepDeadlineAt: getStepDeadline()
  }).where(eq2(purchaseRequests.id, requestId));
  const rejectActionMap = {
    aguardando_comprovante_pagamento: "comprovante_recusado"
  };
  const rejectAction = rejectActionMap[request.status] ?? "rejeitada";
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: flow?.step ?? "gerente",
    action: rejectAction,
    comment
  });
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq2(users.id, req.requesterId)).limit(1);
      const items = await db.select().from(requestItems).where(eq2(requestItems.requestId, requestId));
      const itemsForMsg = items.map((it) => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
      if (request.status === "aguardando_comprovante_pagamento") {
        if (requester?.phone) {
          await notifyRejection({
            requesterPhone: requester.phone,
            requesterName: requester.name ?? "Solicitante",
            requestNumber: req.requestNumber,
            requestId,
            rejectorName: user.name ?? "Financeiro",
            stepLabel: "Comprovante de Pagamento",
            comment
          });
        }
      } else {
        if (requester?.phone) {
          await notifyRejection({
            requesterPhone: requester.phone,
            requesterName: requester.name ?? "Solicitante",
            requestNumber: req.requestNumber,
            requestId,
            rejectorName: user.name ?? "Aprovador",
            stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
            comment
          });
        }
        const prevRoleMap = {
          // aguardando_orcamento: removido intencionalmente para evitar looping
          aguardando_controladoria: "controladoria",
          aguardando_diretoria: "diretoria"
        };
        const prevRole = prevRoleMap[prevStatus];
        if (prevRole && req) {
          const prevApproversRaw = await db.select().from(users).where(and2(
            eq2(users.active, true),
            or(
              eq2(users.procurementRole, prevRole),
              eq2(users.approvalLevel, prevRole)
            )
          ));
          const prevApprovers = [...new Map(prevApproversRaw.map((a) => [a.id, a])).values()];
          console.log(`[WhatsApp] Notificando aprovadores (rejei\xE7\xE3o) para etapa "${prevRole}": ${prevApprovers.length} encontrado(s)`);
          for (const approver of prevApprovers) {
            const phoneRaw = approver.phone;
            console.log(`[WhatsApp] Aprovador (rejei\xE7\xE3o): ${approver.name} | phone raw: ${phoneRaw}`);
            if (phoneRaw) {
              await notifyApproverWithToken({
                approverPhone: phoneRaw,
                approverName: approver.name ?? "Aprovador",
                approverId: approver.id,
                requestNumber: req.requestNumber,
                requestId,
                requesterName: req.requesterName,
                application: req.application,
                urgencyLevel: req.urgencyLevel,
                department: req.department,
                stepLabel: STEP_LABELS_SERVER[prevStatus] ?? prevStatus,
                step: prevRole,
                items: itemsForMsg,
                totalValue: req.totalEstimatedValue ?? void 0
              });
            } else {
              console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) n\xE3o tem telefone cadastrado.`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send rejection notification:", e);
  }
}
async function attachPaymentProof(requestId, fileUrl) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ paymentProofUrl: fileUrl }).where(eq2(purchaseRequests.id, requestId));
}
async function attachInvoice(requestId, fileUrl) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ invoiceUrl: fileUrl }).where(eq2(purchaseRequests.id, requestId));
}
async function attachOCSiagri(requestId, fileUrl) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ ocSiagriUrl: fileUrl }).where(eq2(purchaseRequests.id, requestId));
}
async function finalizeOC(requestId, user, orderValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  if (request.status !== "aguardando_verificacao_compras") throw new Error("Status inv\xE1lido para finalizar OC");
  await db.update(purchaseRequests).set({
    status: "concluida",
    isEnabledInMalotes: true,
    stepDeadlineAt: null,
    ...orderValue != null ? { orderValue: String(orderValue) } : {}
  }).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: "verificacao_compras",
    action: "oc_finalizada",
    comment: "Ordem de Compra finalizada. Nota fiscal verificada."
  });
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq2(users.id, req.requesterId)).limit(1);
      if (requester?.phone) {
        await notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Compras",
          stepLabel: "Verifica\xE7\xE3o Final"
        });
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send finalization notification:", e);
  }
}
async function cancelRequest(requestId, user, reason) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!reason || reason.trim().length === 0) {
    throw new Error("O motivo do cancelamento \xE9 obrigat\xF3rio.");
  }
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
  const isMaster = user.approvalLevel === "master";
  const isOwner = request.requesterId === user.id;
  if (!isMaster && !isOwner) {
    throw new Error("Apenas o solicitante ou um usu\xE1rio master pode cancelar esta solicita\xE7\xE3o.");
  }
  if (request.status === "cancelada") {
    throw new Error("Esta solicita\xE7\xE3o j\xE1 foi cancelada.");
  }
  if (request.status === "concluida") {
    throw new Error("Solicita\xE7\xF5es conclu\xEDdas n\xE3o podem ser canceladas.");
  }
  await db.update(purchaseRequests).set({
    status: "cancelada",
    stepDeadlineAt: null
  }).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usu\xE1rio",
    step: "cancelamento",
    action: "cancelada",
    comment: reason ?? "Solicita\xE7\xE3o cancelada pelo solicitante."
  });
  if (isMaster && !isOwner) {
    try {
      const [requester] = await db.select().from(users).where(eq2(users.id, request.requesterId)).limit(1);
      if (requester?.phone) {
        await notifyRejection({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: request.requestNumber,
          requestId,
          rejectorName: user.name ?? "Master",
          stepLabel: "Cancelamento",
          comment: reason ?? "Solicita\xE7\xE3o cancelada pelo administrador."
        });
      }
    } catch (e) {
      console.warn("[WhatsApp] Failed to send cancellation notification:", e);
    }
  }
}
async function reopenRequest(requestId, masterId, masterName) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!existing) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada.");
  if (existing.status !== "cancelada") throw new Error("Apenas solicita\xE7\xF5es canceladas podem ser reabertas.");
  await db.update(purchaseRequests).set({ status: "aguardando_gerente", updatedAt: /* @__PURE__ */ new Date() }).where(eq2(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: masterId,
    userName: masterName,
    step: "criacao",
    action: "reaberta",
    comment: `Solicita\xE7\xE3o reaberta pelo master ${masterName}. Retornada ao in\xEDcio do fluxo.`
  });
}
async function verifyMasterPin(userId, pin) {
  const db = await getDb();
  if (!db) return false;
  const [user] = await db.select({ pinHash: users.pinHash }).from(users).where(eq2(users.id, userId)).limit(1);
  if (!user?.pinHash) return false;
  return bcrypt.compare(pin, user.pinHash);
}
async function updateMasterPin(userId, newPin) {
  const db = await getDb();
  if (!db) return;
  const hash = await bcrypt.hash(newPin, 12);
  await db.update(users).set({ pinHash: hash }).where(eq2(users.id, userId));
}
async function generateMaloteCode() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const prefix = `MAL-${year}-`;
  const [row] = await db.select({ maloteCode: malotes.maloteCode }).from(malotes).where(sql`maloteCode LIKE ${prefix + "%"}`).orderBy(desc(malotes.id)).limit(1);
  let next = 1;
  if (row) {
    const parts = row.maloteCode.split("-");
    next = parseInt(parts[parts.length - 1] ?? "0", 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}
async function createMalote(opts) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const maloteCode = await generateMaloteCode();
  const result = await db.insert(malotes).values({
    maloteCode,
    status: "aberto",
    originUnit: opts.originUnit,
    destinationUnit: opts.destinationUnit,
    createdById: opts.createdById,
    createdByName: opts.createdByName,
    notes: opts.notes ?? null
  });
  const insertId = result[0]?.insertId ?? result.insertId;
  const [malote] = await db.select().from(malotes).where(eq2(malotes.id, insertId)).limit(1);
  return malote;
}
async function listMalotes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(malotes).orderBy(desc(malotes.createdAt));
}
async function getMaloteWithItems(maloteId) {
  const db = await getDb();
  if (!db) return null;
  const [malote] = await db.select().from(malotes).where(eq2(malotes.id, maloteId)).limit(1);
  if (!malote) return null;
  const items = await db.select().from(maloteItems).where(eq2(maloteItems.maloteId, maloteId));
  const itemsWithOC = await Promise.all(
    items.map(async (item) => {
      const ocItems = item.requestId ? await db.select().from(requestItems).where(eq2(requestItems.requestId, item.requestId)) : [];
      return { ...item, ocItems };
    })
  );
  return { malote, items: itemsWithOC };
}
async function addRequestToMalote(opts) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(maloteItems).where(eq2(maloteItems.requestId, opts.requestId)).limit(1);
  if (existing.length > 0) throw new Error("Solicita\xE7\xE3o j\xE1 est\xE1 em um malote.");
  await db.insert(maloteItems).values({
    maloteId: opts.maloteId,
    requestId: opts.requestId,
    requestCode: opts.requestCode,
    requesterName: opts.requesterName,
    application: opts.application,
    addedById: opts.addedById,
    addedByName: opts.addedByName,
    receiptStatus: "pendente"
  });
}
async function removeRequestFromMalote(maloteItemId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(maloteItems).where(eq2(maloteItems.id, maloteItemId));
}
async function sendMalote(opts) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [malote] = await db.select().from(malotes).where(eq2(malotes.id, opts.maloteId)).limit(1);
  await db.update(malotes).set({
    status: "enviado",
    sentAt: /* @__PURE__ */ new Date(),
    sentById: opts.sentById,
    sentByName: opts.sentByName
  }).where(eq2(malotes.id, opts.maloteId));
  if (malote) {
    try {
      const [destUnit] = await db.select().from(units).where(eq2(units.name, malote.destinationUnit)).limit(1);
      if (destUnit?.responsiblePhone) {
        const msg = `\u{1F4E6} *Malote ${malote.maloteCode} enviado!*

Origem: ${malote.originUnit}
Destino: ${malote.destinationUnit}
Enviado por: ${opts.sentByName}

O malote est\xE1 a caminho. Confirme o recebimento no app CGS quando chegar.`;
        await sendSimpleWhatsApp(destUnit.responsiblePhone, msg);
      }
    } catch (_) {
    }
  }
}
async function receiveMalote(opts) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const item of opts.itemReceipts) {
    await db.update(maloteItems).set({
      receiptStatus: item.receiptStatus,
      receiptNotes: item.receiptNotes ?? null
    }).where(eq2(maloteItems.id, item.itemId));
    if (item.receiptStatus === "devolvido") {
      const [mi] = await db.select().from(maloteItems).where(eq2(maloteItems.id, item.itemId)).limit(1);
      if (mi) {
        await db.update(purchaseRequests).set({
          status: "aguardando_gerente",
          stepDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1e3)
        }).where(eq2(purchaseRequests.id, mi.requestId));
        await db.insert(approvalHistory).values({
          requestId: mi.requestId,
          userId: opts.receivedById,
          userName: opts.receivedByName,
          step: "gerente",
          action: "reaberta",
          comment: `Item devolvido no malote. Motivo: ${item.receiptNotes ?? "n\xE3o informado"}`
        });
      }
    }
  }
  const hasReturn = opts.itemReceipts.some((i) => i.receiptStatus === "devolvido");
  const finalStatus = hasReturn ? "devolvido" : "recebido";
  const [maloteForNotif] = await db.select().from(malotes).where(eq2(malotes.id, opts.maloteId)).limit(1);
  await db.update(malotes).set({
    status: finalStatus,
    receivedAt: /* @__PURE__ */ new Date(),
    receivedById: opts.receivedById,
    receivedByName: opts.receivedByName,
    receiptNotes: opts.receiptNotes,
    signatureData: opts.signatureData ?? null
  }).where(eq2(malotes.id, opts.maloteId));
  if (maloteForNotif) {
    try {
      const [originUnit] = await db.select().from(units).where(eq2(units.name, maloteForNotif.originUnit)).limit(1);
      if (originUnit?.responsiblePhone) {
        const devolvidos = opts.itemReceipts.filter((i) => i.receiptStatus === "devolvido").length;
        const recebidos = opts.itemReceipts.filter((i) => i.receiptStatus === "recebido").length;
        const statusEmoji = hasReturn ? "\u26A0\uFE0F" : "\u2705";
        let msg = `${statusEmoji} *Malote ${maloteForNotif.maloteCode} ${hasReturn ? "recebido com devolu\xE7\xF5es" : "recebido com sucesso"}!*

Origem: ${maloteForNotif.originUnit}
Destino: ${maloteForNotif.destinationUnit}
Recebido por: ${opts.receivedByName}

\u2705 Recebidos: ${recebidos}${hasReturn ? `
\u{1F504} Devolvidos: ${devolvidos}

As solicita\xE7\xF5es devolvidas foram reabertas para novo atendimento.` : ""}`;
        if (opts.receiptNotes) msg += `

Observa\xE7\xE3o: ${opts.receiptNotes}`;
        await sendSimpleWhatsApp(originUnit.responsiblePhone, msg);
      }
    } catch (_) {
    }
  }
}
async function getMaloteStats() {
  const db = await getDb();
  if (!db) return { abertos: 0, enviados: 0, recebidos: 0 };
  const all = await db.select({ status: malotes.status }).from(malotes);
  return {
    abertos: all.filter((m) => m.status === "aberto").length,
    enviados: all.filter((m) => m.status === "enviado").length,
    recebidos: all.filter((m) => m.status === "recebido").length
  };
}
async function getRequestsReadyForMalote() {
  const db = await getDb();
  if (!db) return [];
  const inMalote = await db.select({ requestId: maloteItems.requestId }).from(maloteItems);
  const inMaloteIds = new Set(inMalote.map((i) => i.requestId));
  const concluded = await db.select({
    id: purchaseRequests.id,
    requestNumber: purchaseRequests.requestNumber,
    requesterName: purchaseRequests.requesterName,
    application: purchaseRequests.application,
    department: purchaseRequests.department
  }).from(purchaseRequests).where(eq2(purchaseRequests.status, "concluida"));
  return concluded.filter((r) => !inMaloteIds.has(r.id));
}
async function listUnits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(units).where(eq2(units.active, true)).orderBy(units.name);
}
async function createUnit(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(units).values({
    name: data.name,
    code: data.code.toUpperCase(),
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    responsibleName: data.responsibleName ?? null,
    responsiblePhone: data.responsiblePhone ?? null
  });
  const insertId = result[0]?.insertId ?? result.insertId;
  return { id: insertId };
}
async function updateUnit(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set(data).where(eq2(units.id, id));
}
async function deleteUnit(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set({ active: false }).where(eq2(units.id, id));
}
async function importUnitsBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: units.id }).from(units).where(eq2(units.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(units).set({ name: row.name, address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null }).where(eq2(units.code, row.code));
      } else {
        await db.insert(units).values({ code: row.code.toUpperCase(), name: row.name, address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function listBusinessUnits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(businessUnits).where(eq2(businessUnits.active, true)).orderBy(businessUnits.name);
}
async function createBusinessUnit(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(businessUnits).values({
    name: data.name,
    code: data.code.toUpperCase(),
    type: data.type ?? "escritorio",
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    responsibleName: data.responsibleName ?? null,
    responsiblePhone: data.responsiblePhone ?? null
  });
  const insertId = result[0]?.insertId ?? result.insertId;
  return { id: insertId };
}
async function updateBusinessUnit(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(businessUnits).set(data).where(eq2(businessUnits.id, id));
}
async function deleteBusinessUnit(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(businessUnits).set({ active: false }).where(eq2(businessUnits.id, id));
}
async function importBusinessUnitsBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: businessUnits.id }).from(businessUnits).where(eq2(businessUnits.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(businessUnits).set({ name: row.name, type: row.type ?? "escritorio", address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null }).where(eq2(businessUnits.code, row.code));
      } else {
        await db.insert(businessUnits).values({ code: row.code.toUpperCase(), name: row.name, type: row.type ?? "escritorio", address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function listMaloteTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maloteTags).where(eq2(maloteTags.active, true)).orderBy(maloteTags.category, maloteTags.name);
}
async function createMaloteTag(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(maloteTags).values({
    name: data.name,
    color: data.color,
    icon: data.icon,
    category: data.category
  });
  const insertId = result[0]?.insertId ?? result.insertId;
  return { id: insertId };
}
async function updateMaloteTag(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(maloteTags).set(data).where(eq2(maloteTags.id, id));
}
async function getMaloteTagsForMalote(maloteId) {
  const db = await getDb();
  if (!db) return [];
  const links = await db.select({ tag: maloteTags }).from(maloteTagLinks).innerJoin(maloteTags, eq2(maloteTagLinks.tagId, maloteTags.id)).where(eq2(maloteTagLinks.maloteId, maloteId));
  return links.map((l) => l.tag);
}
async function setMaloteTags(maloteId, tagIds) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(maloteTagLinks).where(eq2(maloteTagLinks.maloteId, maloteId));
  if (tagIds.length > 0) {
    await db.insert(maloteTagLinks).values(
      tagIds.map((tagId) => ({ maloteId, tagId }))
    );
  }
}
async function listDepartments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).where(eq2(departments.active, true)).orderBy(departments.name);
}
async function createDepartment(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(departments).values({
    code: data.code.toUpperCase(),
    name: data.name,
    responsible: data.responsible ?? null
  });
  const insertId = result[0]?.insertId ?? result.insertId;
  return { id: insertId };
}
async function updateDepartment(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departments).set(data).where(eq2(departments.id, id));
}
async function deleteDepartment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departments).set({ active: false }).where(eq2(departments.id, id));
}
async function importDepartmentsBatch(rows) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: departments.id }).from(departments).where(eq2(departments.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(departments).set({ name: row.name, responsible: row.responsible ?? null }).where(eq2(departments.code, row.code));
      } else {
        await db.insert(departments).values({ code: row.code.toUpperCase(), name: row.name, responsible: row.responsible ?? null });
      }
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}
async function getNextDepartmentCode() {
  const db = await getDb();
  if (!db) return "DEP-001";
  const all = await db.select({ code: departments.code }).from(departments);
  const nums = all.map((r) => r.code).filter((c) => /^DEP-\d+$/.test(c)).map((c) => parseInt(c.split("-")[1] ?? "0", 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `DEP-${String(next).padStart(3, "0")}`;
}
async function getRankingByCostCenter(year, month) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const requests = await db.select({
    costCenterCode: purchaseRequests.costCenterCode,
    costCenterId: purchaseRequests.costCenterId,
    department: purchaseRequests.department,
    totalEstimatedValue: purchaseRequests.totalEstimatedValue,
    status: purchaseRequests.status
  }).from(purchaseRequests).where(
    and2(
      gte(purchaseRequests.createdAt, startDate),
      lte(purchaseRequests.createdAt, endDate),
      sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
    )
  );
  const ccList = await db.select().from(costCenters);
  const ccMap = new Map(ccList.map((cc) => [cc.code, cc.name]));
  const grouped = /* @__PURE__ */ new Map();
  for (const req of requests) {
    const key = req.costCenterCode ?? req.department ?? "Sem Centro de Custo";
    const label = req.costCenterCode ? ccMap.get(req.costCenterCode) ?? req.costCenterCode : req.department ?? "Sem Centro de Custo";
    if (!grouped.has(key)) grouped.set(key, { label, total: 0, count: 0 });
    const entry = grouped.get(key);
    entry.total += parseFloat(req.totalEstimatedValue ?? "0");
    entry.count++;
  }
  const months3 = [-2, -1, 0].map((offset) => {
    let m = month + offset;
    let y = year;
    if (m <= 0) {
      m += 12;
      y--;
    }
    return { y, m };
  });
  const [totalsM2, totalsM1] = await Promise.all([
    getCCTotalsForMonth(db, months3[0].y, months3[0].m),
    getCCTotalsForMonth(db, months3[1].y, months3[1].m)
  ]);
  return Array.from(grouped.entries()).map(([code, { label, total, count }]) => ({
    code,
    label,
    total: Math.round(total * 100) / 100,
    count,
    trend: [
      Math.round((totalsM2.get(code) ?? 0) * 100) / 100,
      Math.round((totalsM1.get(code) ?? 0) * 100) / 100,
      Math.round(total * 100) / 100
    ]
  })).sort((a, b) => b.total - a.total).slice(0, 10);
}
async function getCCTotalsForMonth(db, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const rows = await db.select({
    costCenterCode: purchaseRequests.costCenterCode,
    department: purchaseRequests.department,
    totalEstimatedValue: purchaseRequests.totalEstimatedValue
  }).from(purchaseRequests).where(
    and2(
      gte(purchaseRequests.createdAt, startDate),
      lte(purchaseRequests.createdAt, endDate),
      sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
    )
  );
  const map = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const key = r.costCenterCode ?? r.department ?? "Sem Centro de Custo";
    map.set(key, (map.get(key) ?? 0) + parseFloat(r.totalEstimatedValue ?? "0"));
  }
  return map;
}
async function getItemTotalsForMonth(db, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const requests = await db.select({ id: purchaseRequests.id }).from(purchaseRequests).where(
    and2(
      gte(purchaseRequests.createdAt, startDate),
      lte(purchaseRequests.createdAt, endDate),
      sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
    )
  );
  if (requests.length === 0) return /* @__PURE__ */ new Map();
  const items = await db.select().from(requestItems).where(inArray(requestItems.requestId, requests.map((r) => r.id)));
  const map = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = item.description.toLowerCase().trim();
    map.set(key, (map.get(key) ?? 0) + parseFloat(item.totalPrice ?? item.unitPrice ?? "0"));
  }
  return map;
}
async function getRankingByItem(year, month) {
  const db = await getDb();
  if (!db) return [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const requests = await db.select({ id: purchaseRequests.id }).from(purchaseRequests).where(
    and2(
      gte(purchaseRequests.createdAt, startDate),
      lte(purchaseRequests.createdAt, endDate),
      sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
    )
  );
  if (requests.length === 0) return [];
  const requestIds = requests.map((r) => r.id);
  const items = await db.select().from(requestItems).where(inArray(requestItems.requestId, requestIds));
  const grouped = /* @__PURE__ */ new Map();
  for (const item of items) {
    const key = item.description.toLowerCase().trim();
    if (!grouped.has(key)) grouped.set(key, { label: item.description, total: 0, quantity: 0, count: 0 });
    const entry = grouped.get(key);
    entry.total += parseFloat(item.totalPrice ?? item.unitPrice ?? "0");
    entry.quantity += parseFloat(item.quantity ?? "1");
    entry.count++;
  }
  const months3 = [-2, -1, 0].map((offset) => {
    let m = month + offset;
    let y = year;
    if (m <= 0) {
      m += 12;
      y--;
    }
    return { y, m };
  });
  const [itemsM2, itemsM1] = await Promise.all([
    getItemTotalsForMonth(db, months3[0].y, months3[0].m),
    getItemTotalsForMonth(db, months3[1].y, months3[1].m)
  ]);
  return Array.from(grouped.entries()).map(([key, { label, total, quantity, count }]) => ({
    label,
    total: Math.round(total * 100) / 100,
    quantity: Math.round(quantity * 100) / 100,
    count,
    trend: [
      Math.round((itemsM2.get(key) ?? 0) * 100) / 100,
      Math.round((itemsM1.get(key) ?? 0) * 100) / 100,
      Math.round(total * 100) / 100
    ]
  })).sort((a, b) => b.total - a.total).slice(0, 10);
}
async function deletePurchaseRequest(id, requesterId, isAdmin) {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indispon\xEDvel" };
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, id)).limit(1);
  if (!request) return { success: false, error: "Solicita\xE7\xE3o n\xE3o encontrada" };
  if (request.status !== "cancelada") {
    return { success: false, error: "Apenas solicita\xE7\xF5es canceladas podem ser exclu\xEDdas" };
  }
  if (!isAdmin && request.requesterId !== requesterId) {
    return { success: false, error: "Sem permiss\xE3o para excluir esta solicita\xE7\xE3o" };
  }
  await db.delete(requestItems).where(eq2(requestItems.requestId, id));
  await db.delete(approvalHistory).where(eq2(approvalHistory.requestId, id));
  await db.delete(purchaseRequests).where(eq2(purchaseRequests.id, id));
  return { success: true };
}
async function saveBudgetAnalysis(requestId, analysisJson) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  await db.update(purchaseRequests).set({ aiAnalysis: analysisJson, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(purchaseRequests.id, requestId));
}
async function getBudgetAnalysis(requestId) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select({ aiAnalysis: purchaseRequests.aiAnalysis }).from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  return row?.aiAnalysis ?? null;
}
async function getCompletedRequestsWithItems() {
  const db = await getDb();
  if (!db) return [];
  const reqs = await db.select({
    id: purchaseRequests.id,
    application: purchaseRequests.application,
    totalValue: purchaseRequests.totalEstimatedValue
  }).from(purchaseRequests).where(inArray(purchaseRequests.status, [
    "aguardando_aprovacao_compra",
    "aguardando_comprovante_pagamento",
    "aguardando_verificacao_compras",
    "concluida"
  ])).orderBy(desc(purchaseRequests.createdAt)).limit(200);
  if (reqs.length === 0) return [];
  const reqIds = reqs.map((r) => r.id);
  const items = await db.select({
    requestId: requestItems.requestId,
    description: requestItems.description,
    quantity: requestItems.quantity,
    unitPrice: requestItems.unitPrice,
    totalPrice: requestItems.totalPrice
  }).from(requestItems).where(inArray(requestItems.requestId, reqIds));
  const itemsByRequest = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!itemsByRequest.has(item.requestId)) itemsByRequest.set(item.requestId, []);
    itemsByRequest.get(item.requestId).push(item);
  }
  return reqs.map((r) => ({
    ...r,
    items: itemsByRequest.get(r.id) ?? []
  }));
}
async function updatePurchaseRequest(requestId, editorId, editorName, input) {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indispon\xEDvel" };
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) return { success: false, error: "Solicita\xE7\xE3o n\xE3o encontrada" };
  if (!EDITABLE_STATUSES.includes(request.status)) {
    return { success: false, error: `Solicita\xE7\xF5es com status "${request.status}" n\xE3o podem ser editadas. Apenas solicita\xE7\xF5es aguardando gerente, aguardando or\xE7amento ou rejeitadas podem ser editadas.` };
  }
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }
  const deadlineAt = getDeadlineDate(input.urgencyLevel);
  const stepDeadlineAt = getStepDeadline();
  await db.update(purchaseRequests).set({
    department: input.department,
    costCenterId: input.costCenterId ?? null,
    costCenterCode: input.costCenterCode ?? null,
    application: input.application,
    urgencyLevel: input.urgencyLevel,
    observations: input.observations ?? null,
    osMyfarm: input.osMyfarm ?? null,
    totalEstimatedValue: total > 0 ? String(total) : null,
    status: "aguardando_gerente",
    deadlineAt,
    stepDeadlineAt,
    // Limpar campos de etapas anteriores
    budgetFileUrl: null,
    purchaseOrderNumber: null,
    aiAnalysis: null,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(purchaseRequests.id, requestId));
  await db.delete(requestItems).where(eq2(requestItems.requestId, requestId));
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null
    });
  }
  await db.insert(approvalHistory).values({
    requestId,
    userId: editorId,
    userName: editorName,
    step: "edicao",
    action: "editada",
    comment: `Solicita\xE7\xE3o editada por ${editorName}. Processo de aprova\xE7\xE3o reiniciado. Novo prazo: ${deadlineAt.toLocaleDateString("pt-BR")}`
  });
  try {
    const approverRole = "gerente";
    const stepLabel = "Gerente de Unidade";
    const approvers = await db.select().from(users).where(and2(
      eq2(users.active, true),
      or(
        eq2(users.procurementRole, approverRole),
        eq2(users.approvalLevel, approverRole)
      )
    ));
    const uniqueApprovers = [...new Map(approvers.map((a) => [a.id, a])).values()];
    for (const approver of uniqueApprovers) {
      if (approver.phone) {
        await notifyNewRequest({
          approverPhone: approver.phone,
          approverName: approver.name ?? "Aprovador",
          requestNumber: request.requestNumber,
          requestId,
          requesterName: request.requesterName,
          application: input.application,
          urgencyLevel: input.urgencyLevel,
          department: input.department,
          stepLabel
        });
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to notify approvers after edit:", e);
  }
  return { success: true };
}
async function updateByControladoria(requestId, editorId, editorName, input) {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indispon\xEDvel" };
  const [request] = await db.select().from(purchaseRequests).where(eq2(purchaseRequests.id, requestId)).limit(1);
  if (!request) return { success: false, error: "Solicita\xE7\xE3o n\xE3o encontrada" };
  if (request.status !== "aguardando_controladoria") {
    return {
      success: false,
      error: `Esta edi\xE7\xE3o s\xF3 pode ser feita quando a solicita\xE7\xE3o est\xE1 na etapa da Controladoria. Status atual: "${request.status}"`
    };
  }
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }
  await db.update(purchaseRequests).set({
    department: input.department,
    costCenterId: input.costCenterId ?? null,
    costCenterCode: input.costCenterCode ?? null,
    application: input.application,
    urgencyLevel: input.urgencyLevel,
    observations: input.observations ?? null,
    osMyfarm: input.osMyfarm ?? null,
    totalEstimatedValue: total > 0 ? String(total) : null,
    // status NÃO é alterado — permanece "aguardando_controladoria"
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq2(purchaseRequests.id, requestId));
  await db.delete(requestItems).where(eq2(requestItems.requestId, requestId));
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null
    });
  }
  await db.insert(approvalHistory).values({
    requestId,
    userId: editorId,
    userName: editorName,
    step: "edicao",
    action: "editada",
    comment: `Dados editados pela Controladoria (${editorName}). O fluxo de aprova\xE7\xE3o n\xE3o foi reiniciado.`
  });
  return { success: true };
}
async function listHarvests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(harvests).orderBy(desc(harvests.createdAt));
}
async function createHarvest(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(harvests).values({
    name: data.name,
    year: data.year,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    active: true
  });
  return { id: result.insertId };
}
async function updateHarvest(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(harvests).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(harvests.id, id));
  return { success: true };
}
async function deleteHarvest(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(harvests).where(eq2(harvests.id, id));
  return { success: true };
}
async function listBudgets(harvestId) {
  const db = await getDb();
  if (!db) return [];
  if (harvestId) {
    return db.select().from(budgets).where(eq2(budgets.harvestId, harvestId)).orderBy(budgets.costCenterCode);
  }
  return db.select().from(budgets).orderBy(desc(budgets.createdAt));
}
async function createBudget(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(budgets).values({
    harvestId: data.harvestId,
    costCenterId: data.costCenterId ?? null,
    costCenterCode: data.costCenterCode ?? null,
    costCenterName: data.costCenterName ?? null,
    category: data.category ?? null,
    totalValue: data.totalValue,
    usedValue: "0.00",
    notes: data.notes ?? null,
    createdBy: data.createdBy ?? null
  });
  return { id: result.insertId };
}
async function updateBudget(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(budgets).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(budgets.id, id));
  return { success: true };
}
async function deleteBudget(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(budgets).where(eq2(budgets.id, id));
  return { success: true };
}
async function deductFromBudget(params) {
  const db = await getDb();
  if (!db) return { success: true, deducted: false };
  const amount = parseFloat(params.amount) || 0;
  if (amount <= 0) return { success: true, deducted: false };
  let rows = [];
  if (params.costCenterId) {
    rows = await db.select().from(budgets).where(eq2(budgets.costCenterId, params.costCenterId)).orderBy(desc(budgets.createdAt)).limit(1);
  } else if (params.costCenterCode) {
    rows = await db.select().from(budgets).where(eq2(budgets.costCenterCode, params.costCenterCode)).orderBy(desc(budgets.createdAt)).limit(1);
  }
  if (!rows || rows.length === 0) return { success: true, deducted: false };
  const budget = rows[0];
  const currentUsed = parseFloat(budget.usedValue) || 0;
  const newUsed = (currentUsed + amount).toFixed(2);
  await db.update(budgets).set({ usedValue: newUsed, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(budgets.id, budget.id));
  return { success: true, deducted: true, budgetId: budget.id };
}
async function getBudgetSummary() {
  const db = await getDb();
  if (!db) return { budgets: [], harvests: [] };
  const allBudgets = await db.select().from(budgets).orderBy(desc(budgets.createdAt));
  const allHarvests = await db.select().from(harvests).where(eq2(harvests.active, true)).orderBy(desc(harvests.createdAt));
  return { budgets: allBudgets, harvests: allHarvests };
}
function generateApiKey() {
  const raw = "cgsk_" + randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.substring(0, 12);
  return { raw, hash, prefix };
}
async function listApiKeys() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  return rows.map(({ keyHash: _kh, ...rest }) => rest);
}
async function createApiKey(params) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { raw, hash, prefix } = generateApiKey();
  const result = await db.insert(apiKeys).values({
    name: params.name,
    keyHash: hash,
    keyPrefix: prefix,
    createdById: params.createdById,
    createdByName: params.createdByName,
    description: params.description ?? null,
    permissions: params.permissions ? JSON.stringify(params.permissions) : JSON.stringify(["create_request"]),
    expiresAt: params.expiresAt ?? null,
    active: true
  });
  const insertId = result[0]?.insertId ?? 0;
  console.log(`[ApiKey] Nova chave criada: ${prefix}... por ${params.createdByName}`);
  return { id: insertId, key: raw, prefix, name: params.name };
}
async function revokeApiKey(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(apiKeys).set({ active: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(apiKeys.id, id));
  return { success: true };
}
async function deleteApiKey(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(apiKeys).where(eq2(apiKeys.id, id));
  return { success: true };
}
async function validateApiKey(rawKey) {
  const db = await getDb();
  if (!db) return null;
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const rows = await db.select().from(apiKeys).where(
    and2(eq2(apiKeys.keyHash, hash), eq2(apiKeys.active, true))
  ).limit(1);
  if (!rows || rows.length === 0) return null;
  const key = rows[0];
  if (key.expiresAt && /* @__PURE__ */ new Date() > new Date(key.expiresAt)) {
    console.log(`[ApiKey] Chave expirada: ${key.keyPrefix}...`);
    return null;
  }
  await db.update(apiKeys).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq2(apiKeys.id, key.id));
  const { keyHash: _kh, ...rest } = key;
  return rest;
}
var STEP_LABELS_SERVER, _db, STEP_FLOW_NORMAL, STEP_FLOW_URGENT, REJECT_FLOW_NORMAL, REJECT_FLOW_URGENT, EDITABLE_STATUSES;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    init_whatsapp();
    STEP_LABELS_SERVER = {
      aguardando_gerente: "Aprova\xE7\xE3o do Gerente",
      aguardando_orcamento: "Or\xE7amento",
      aguardando_controladoria: "Aprova\xE7\xE3o Controladoria",
      aguardando_diretoria: "Aprova\xE7\xE3o Diretoria",
      aguardando_ordem_compra: "Emiss\xE3o de OC (Compras)",
      aguardando_aprovacao_compra: "Aprova\xE7\xE3o Financeiro",
      aguardando_comprovante_pagamento: "Comprovante de Pagamento",
      aguardando_verificacao_compras: "Verifica\xE7\xE3o Final (Compras)",
      concluida: "Conclu\xEDda"
    };
    _db = null;
    STEP_FLOW_NORMAL = {
      aguardando_gerente: { step: "gerente", nextStatus: "aguardando_orcamento", action: "aprovada" },
      aguardando_orcamento: { step: "orcamento", nextStatus: "aguardando_controladoria", action: "aprovada" },
      aguardando_controladoria: { step: "controladoria", nextStatus: "aguardando_diretoria", action: "aprovada" },
      aguardando_diretoria: { step: "diretoria", nextStatus: "aguardando_ordem_compra", action: "aprovada" },
      aguardando_ordem_compra: { step: "ordem_compra", nextStatus: "aguardando_aprovacao_compra", action: "ordem_emitida" },
      aguardando_aprovacao_compra: { step: "aprovacao_compra", nextStatus: "aguardando_comprovante_pagamento", action: "compra_aprovada" },
      aguardando_comprovante_pagamento: { step: "financeiro", nextStatus: "aguardando_verificacao_compras", action: "comprovante_aprovado" },
      rejeitada: { step: "gerente", nextStatus: "aguardando_gerente", action: "reaberta" }
    };
    STEP_FLOW_URGENT = {
      aguardando_gerente: { step: "gerente", nextStatus: "aguardando_orcamento", action: "aprovada" },
      aguardando_orcamento: { step: "orcamento", nextStatus: "aguardando_diretoria", action: "aprovada" },
      aguardando_diretoria: { step: "diretoria", nextStatus: "aguardando_controladoria", action: "aprovada" },
      aguardando_controladoria: { step: "controladoria", nextStatus: "aguardando_ordem_compra", action: "aprovada" },
      aguardando_ordem_compra: { step: "ordem_compra", nextStatus: "aguardando_aprovacao_compra", action: "ordem_emitida" },
      aguardando_aprovacao_compra: { step: "aprovacao_compra", nextStatus: "aguardando_comprovante_pagamento", action: "compra_aprovada" },
      aguardando_comprovante_pagamento: { step: "financeiro", nextStatus: "aguardando_verificacao_compras", action: "comprovante_aprovado" },
      rejeitada: { step: "gerente", nextStatus: "aguardando_gerente", action: "reaberta" }
    };
    REJECT_FLOW_NORMAL = {
      aguardando_gerente: "aguardando_gerente",
      aguardando_orcamento: "aguardando_orcamento",
      aguardando_controladoria: "aguardando_orcamento",
      aguardando_diretoria: "aguardando_controladoria",
      aguardando_ordem_compra: "aguardando_diretoria",
      aguardando_aprovacao_compra: "aguardando_ordem_compra",
      aguardando_comprovante_pagamento: "rejeitada"
    };
    REJECT_FLOW_URGENT = {
      aguardando_gerente: "aguardando_gerente",
      aguardando_orcamento: "aguardando_orcamento",
      aguardando_diretoria: "aguardando_orcamento",
      aguardando_controladoria: "aguardando_diretoria",
      aguardando_ordem_compra: "aguardando_controladoria",
      aguardando_aprovacao_compra: "aguardando_ordem_compra",
      aguardando_comprovante_pagamento: "rejeitada"
    };
    EDITABLE_STATUSES = [
      "aguardando_gerente",
      "aguardando_orcamento",
      "rejeitada"
    ];
  }
});

// server/email.ts
var email_exports = {};
__export(email_exports, {
  sendDailyReportEmail: () => sendDailyReportEmail,
  sendPasswordResetEmail: () => sendPasswordResetEmail,
  sendWelcomeEmail: () => sendWelcomeEmail
});
import nodemailer from "nodemailer";
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured \u2014 skipping email send.");
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}
async function sendWelcomeEmail(params) {
  const transporter = getTransporter();
  if (!transporter) return false;
  const loginUrl = params.loginUrl ?? process.env.APP_URL ?? process.env.EXPO_WEB_PREVIEW_URL ?? "https://procurement.cgs.agr.br";
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
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agr\xEDcola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agr\xEDcola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Sistema de Gest\xE3o de Compras</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#11181C;font-size:18px;">Ol\xE1, ${params.toName}! \u{1F44B}</h2>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Sua conta foi criada no <strong>Sistema de Gest\xE3o de Compras da CGS Agr\xEDcola</strong>.
                ${params.jobTitle ? `Voc\xEA foi cadastrado como <strong>${params.jobTitle}</strong>.` : ""}
              </p>
              <p style="margin:0 0 24px;color:#687076;font-size:14px;line-height:1.6;">
                Para acessar o sistema, clique no bot\xE3o abaixo e fa\xE7a login com seu e-mail corporativo:
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#0a7ea4;border-radius:8px;padding:14px 28px;text-align:center;">
                    <a href="${loginUrl}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
                      Acessar o Sistema \u2192
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
                Este e-mail foi enviado automaticamente pelo sistema. N\xE3o responda a este e-mail.<br/>
                Em caso de d\xFAvidas, entre em contato com o administrador do sistema.
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
      subject: "Bem-vindo ao Sistema de Compras \u2014 CGS Agr\xEDcola",
      html,
      text: `Ol\xE1, ${params.toName}!

Sua conta foi criada no Sistema de Gest\xE3o de Compras da CGS Agr\xEDcola.

Acesse: ${loginUrl}

Em caso de d\xFAvidas, entre em contato com o administrador.`
    });
    console.log(`[Email] Welcome email sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send welcome email:", err);
    return false;
  }
}
function urgencyLabel(level) {
  if (level === "emergencial") return "\u{1F534} Emergencial";
  if (level === "urgente") return "\u{1F7E1} Urgente";
  return "\u{1F7E2} Normal";
}
function statusLabel(status) {
  const map = {
    aguardando_gerente: "Aguardando Gerente",
    aguardando_orcamento: "Aguardando Or\xE7amento",
    aguardando_controladoria: "Aguardando Controladoria",
    aguardando_diretoria: "Aguardando Diretoria",
    aguardando_ordem_compra: "Aguardando Ordem de Compra",
    aguardando_financeiro: "Aguardando Financeiro",
    concluida: "Conclu\xEDda",
    rejeitada: "Rejeitada",
    cancelada: "Cancelada"
  };
  return map[status] ?? status;
}
function formatDeadline(date) {
  if (!date) return "\u2014";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatCurrency(value) {
  if (!value) return "\u2014";
  const num = parseFloat(value);
  return isNaN(num) ? "\u2014" : num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function buildRequestRow(req, highlight) {
  const bg = highlight ? "#FEF2F2" : "#ffffff";
  const border = highlight ? "2px solid #EF4444" : "1px solid #E5E7EB";
  const badge = highlight ? `<span style="background:#EF4444;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700;">\u26A0\uFE0F PRAZO CR\xCDTICO</span>` : "";
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
function buildTable(requests, criticalIds) {
  if (requests.length === 0) return `<p style="color:#687076;font-size:14px;font-style:italic;">Nenhuma solicita\xE7\xE3o nesta categoria.</p>`;
  const rows = requests.map((r) => buildRequestRow(r, criticalIds.has(r.requestNumber))).join("");
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">N\xBA</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Solicitante</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Depto</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Item(ns)</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Urg\xEAncia</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Status</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Prazo</th>
        <th style="padding:8px 12px;text-align:right;font-size:12px;color:#687076;border-bottom:2px solid #E5E7EB;">Valor Est.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}
async function sendDailyReportEmail(params) {
  const transporter = getTransporter();
  if (!transporter) return false;
  const criticalIds = new Set(params.criticalRequests.map((r) => r.requestNumber));
  const totalOpen = params.openRequests.length;
  const totalCritical = params.criticalRequests.length;
  const totalCompleted = params.completedToday.length;
  const criticalBanner = totalCritical > 0 ? `<tr><td style="background:#FEF2F2;border:2px solid #EF4444;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;color:#DC2626;font-size:15px;font-weight:700;">\u26A0\uFE0F ATEN\xC7\xC3O: ${totalCritical} solicita\xE7\xE3o(\xF5es) com prazo vencendo nas pr\xF3ximas 24 horas!</p>
        <p style="margin:4px 0 0;color:#DC2626;font-size:13px;">Verifique as linhas destacadas em vermelho nas tabelas abaixo.</p>
       </td></tr>` : "";
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relat\xF3rio Di\xE1rio \u2014 ${params.date}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agr\xEDcola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agr\xEDcola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Relat\xF3rio Di\xE1rio de Compras \u2014 ${params.date}</p>
            </td>
          </tr>
          <!-- Summary -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 8px;color:#11181C;font-size:16px;font-weight:700;">Ol\xE1, ${params.toName}!</p>
              <p style="margin:0 0 20px;color:#687076;font-size:14px;">Aqui est\xE1 o resumo das solicita\xE7\xF5es de compra de hoje.</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="background:#EFF6FF;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#0a7ea4;">${totalOpen}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Em Aberto</p>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="background:#FEF2F2;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#DC2626;">${totalCritical}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Prazo Cr\xEDtico (24h)</p>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="background:#F0FDF4;border-radius:8px;padding:16px;width:33%;">
                    <p style="margin:0;font-size:28px;font-weight:700;color:#16A34A;">${totalCompleted}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#687076;">Conclu\xEDdas Hoje</p>
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
                \u{1F4CB} Solicita\xE7\xF5es em Aberto (${totalOpen})
              </h3>
              ${buildTable(params.openRequests, criticalIds)}
            </td>
          </tr>
          <!-- Completed Today -->
          <tr>
            <td style="padding:24px 32px;">
              <h3 style="margin:0 0 12px;color:#11181C;font-size:15px;border-left:4px solid #16A34A;padding-left:10px;">
                \u2705 Conclu\xEDdas Hoje (${totalCompleted})
              </h3>
              ${buildTable(params.completedToday, /* @__PURE__ */ new Set())}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f5f5f5;padding:16px 32px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0;color:#9BA1A6;font-size:12px;">
                Relat\xF3rio gerado automaticamente em ${params.date} \xE0s 07:00 \xB7 CGS Agr\xEDcola<br/>
                N\xE3o responda a este e-mail.
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
    `Relat\xF3rio Di\xE1rio de Compras \u2014 ${params.date}`,
    `Ol\xE1, ${params.toName}!`,
    ``,
    `\u{1F4CA} RESUMO:`,
    `  Em Aberto: ${totalOpen}`,
    `  Prazo Cr\xEDtico (24h): ${totalCritical}`,
    `  Conclu\xEDdas Hoje: ${totalCompleted}`,
    ``,
    totalCritical > 0 ? `\u26A0\uFE0F ATEN\xC7\xC3O: ${totalCritical} solicita\xE7\xE3o(\xF5es) com prazo vencendo nas pr\xF3ximas 24 horas!
` : "",
    `\u{1F4CB} SOLICITA\xC7\xD5ES EM ABERTO:`,
    ...params.openRequests.map((r) => `  [${criticalIds.has(r.requestNumber) ? "\u26A0\uFE0F CR\xCDTICO" : "      "}] ${r.requestNumber} | ${r.requesterName} | ${statusLabel(r.status)} | Prazo: ${formatDeadline(r.deadlineAt)}`),
    ``,
    `\u2705 CONCLU\xCDDAS HOJE:`,
    ...params.completedToday.map((r) => `  ${r.requestNumber} | ${r.requesterName} | ${formatCurrency(r.totalEstimatedValue)}`)
  ].join("\n");
  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: params.toEmail,
      subject: `\u{1F4CA} Relat\xF3rio Di\xE1rio de Compras \u2014 ${params.date}${totalCritical > 0 ? ` \u26A0\uFE0F ${totalCritical} prazo(s) cr\xEDtico(s)` : ""}`,
      html,
      text: textLines
    });
    console.log(`[Email] Daily report sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send daily report to ${params.toEmail}:`, err);
    return false;
  }
}
async function sendPasswordResetEmail(params) {
  const transporter = getTransporter();
  if (!transporter) return false;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Redefini\xE7\xE3o de Senha</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0a7ea4;padding:28px 32px;text-align:center;">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663032360281/ptXJWPoflNdSNrge.png" alt="CGS Agr\xEDcola" width="56" height="56" style="display:block;margin:0 auto 12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">CGS Agr\xEDcola</h1>
              <p style="margin:6px 0 0;color:#e0f4fb;font-size:14px;">Sistema de Gest\xE3o de Compras</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#11181C;font-size:18px;">Ol\xE1, ${params.toName}! \u{1F511}</h2>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Recebemos uma solicita\xE7\xE3o de redefini\xE7\xE3o de senha para sua conta.
                Sua senha tempor\xE1ria \xE9:
              </p>
              <div style="background:#f5f5f5;border-radius:8px;padding:16px 24px;text-align:center;margin:0 0 24px;">
                <span style="font-size:28px;font-weight:700;letter-spacing:4px;color:#0a7ea4;">${params.tempPassword}</span>
              </div>
              <p style="margin:0 0 16px;color:#687076;font-size:14px;line-height:1.6;">
                Acesse o sistema com esta senha tempor\xE1ria e altere-a assim que poss\xEDvel nas configura\xE7\xF5es do seu perfil.
              </p>
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
              <p style="margin:0;color:#9BA1A6;font-size:12px;text-align:center;">
                Se voc\xEA n\xE3o solicitou a redefini\xE7\xE3o de senha, entre em contato com o administrador do sistema imediatamente.<br/>
                Este e-mail foi enviado automaticamente. N\xE3o responda a este e-mail.
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
      subject: "Redefini\xE7\xE3o de Senha \u2014 CGS Agr\xEDcola",
      html,
      text: `Ol\xE1, ${params.toName}!

Sua senha tempor\xE1ria \xE9: ${params.tempPassword}

Acesse o sistema e altere sua senha assim que poss\xEDvel.

Em caso de d\xFAvidas, entre em contato com o administrador.`
    });
    console.log(`[Email] Password reset email sent to ${params.toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send password reset email:", err);
    return false;
  }
}
var FROM_NAME, FROM_EMAIL;
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
    FROM_NAME = process.env.SMTP_FROM_NAME ?? "CGS Agr\xEDcola";
    FROM_EMAIL = process.env.SMTP_USER ?? "noreply@cgs.agr.br";
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  storageGet: () => storageGet,
  storagePut: () => storagePut
});
function getStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
async function buildDownloadUrl(baseUrl, relKey, apiKey) {
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });
  return (await response.json()).url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}
async function storageGet(relKey) {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey)
  };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/_core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createProxyMiddleware } from "http-proxy-middleware";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();
import bcrypt2 from "bcryptjs";

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getParentDomain(hostname) {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return void 0;
  }
  const parts = hostname.split(".");
  if (parts.length < 3) {
    return void 0;
  }
  return "." + parts.slice(-2).join(".");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(GET_USER_INFO_PATH, {
      accessToken: token.accessToken
    });
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(platforms.filter((p) => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        if (userInfo.email) {
          const linked = await linkUserByEmail(userInfo.openId, userInfo.email);
          if (linked) {
            console.log(`[Auth] Email-linked user found for ${userInfo.email}, fetching by new openId`);
            user = await getUserByOpenId(userInfo.openId);
          }
        }
        if (!user) {
          await upsertUser({
            openId: userInfo.openId,
            name: userInfo.name || null,
            email: userInfo.email ?? null,
            loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
            lastSignedIn: signedInAt
          });
          user = await getUserByOpenId(userInfo.openId);
        }
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    if (user.id) {
      await upsertUser({
        openId: user.openId,
        lastSignedIn: signedInAt
      });
    }
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function syncUser(userInfo) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }
  const lastSignedIn = /* @__PURE__ */ new Date();
  if (userInfo.email) {
    const linked = await linkUserByEmail(userInfo.openId, userInfo.email);
    if (linked) {
      console.log(`[Auth] Pre-registered user linked by email: ${userInfo.email}`);
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        lastSignedIn
      });
      const linked_user = await getUserByOpenId(userInfo.openId);
      if (linked_user) return linked_user;
    }
  }
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return saved ?? {
    openId: userInfo.openId,
    name: userInfo.name,
    email: userInfo.email,
    loginMethod: userInfo.loginMethod ?? null,
    lastSignedIn
  };
}
function buildUserResponse(user) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? /* @__PURE__ */ new Date()).toISOString(),
    procurementRole: user?.procurementRole ?? null,
    approvalLevel: user?.approvalLevel ?? null,
    extraRoles: user?.extraRoles ?? null,
    extraApprovalLevels: user?.extraApprovalLevels ?? null,
    phone: user?.phone ?? null,
    active: user?.active ?? true
  };
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const frontendUrl = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "http://localhost:8081";
      res.redirect(302, frontendUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app.get("/api/oauth/mobile", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user)
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios" });
        return;
      }
      const user = await getUserByEmailForLogin(email.toLowerCase().trim());
      if (!user || !user.active) {
        res.status(401).json({ error: "E-mail ou senha incorretos" });
        return;
      }
      if (!user.passwordHash) {
        res.status(401).json({ error: "Usu\xE1rio sem senha definida. Solicite ao administrador." });
        return;
      }
      const valid = await bcrypt2.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "E-mail ou senha incorretos" });
        return;
      }
      const token = await sdk.createSessionToken(user.openId, {
        expiresInMs: ONE_YEAR_MS,
        name: user.name ?? ""
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          openId: user.openId,
          name: user.name,
          email: user.email,
          loginMethod: "password",
          lastSignedIn: (/* @__PURE__ */ new Date()).toISOString(),
          procurementRole: user.procurementRole,
          approvalLevel: user.approvalLevel,
          phone: user.phone,
          active: user.active
        }
      });
    } catch (error) {
      console.error("[Auth] /api/auth/login failed:", error);
      res.status(500).json({ error: "Erro interno ao fazer login" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "E-mail \xE9 obrigat\xF3rio." });
        return;
      }
      const user = await getUserByEmailForLogin(email.toLowerCase().trim());
      if (!user || !user.active) {
        res.json({ success: true, message: "Se o e-mail estiver cadastrado, voc\xEA receber\xE1 a nova senha." });
        return;
      }
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let tempPassword = "";
      for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
      const passwordHash = await bcrypt2.hash(tempPassword, 10);
      const { updateUserPassword: updateUserPassword2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      await updateUserPassword2(user.id, passwordHash);
      let emailSent = false;
      try {
        const { sendPasswordResetEmail: sendPasswordResetEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
        emailSent = await sendPasswordResetEmail2({
          toEmail: user.email ?? email,
          toName: user.name ?? "Usu\xE1rio",
          tempPassword
        });
      } catch (e) {
        console.warn("[Auth] Failed to send password reset email:", e);
      }
      if (!emailSent) {
        res.json({ success: true, tempPassword, message: "Senha tempor\xE1ria gerada. Configure o SMTP para envio por e-mail." });
        return;
      }
      res.json({ success: true, message: "Se o e-mail estiver cadastrado, voc\xEA receber\xE1 a nova senha." });
    } catch (error) {
      console.error("[Auth] /api/auth/forgot-password failed:", error);
      res.status(500).json({ error: "Erro interno ao processar solicita\xE7\xE3o." });
    }
  });
  app.post("/api/auth/session", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    budget_tokens: 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`);
  }
  return await response.json();
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_env();
init_db();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ─── User Management ───────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(() => listUsers()),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(({ input }) => getUserById(input.id)),
    updateProfile: protectedProcedure.input(z2.object({
      procurementRole: z2.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"]).optional(),
      department: z2.string().optional(),
      phone: z2.string().optional(),
      jobTitle: z2.string().optional(),
      approvalLevel: z2.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional()
    })).mutation(({ ctx, input }) => updateUserProfile(ctx.user.id, input)),
    upsertByAdmin: protectedProcedure.input(z2.object({
      id: z2.number().optional(),
      name: z2.string().min(1),
      email: z2.string().email().optional().or(z2.literal("")),
      procurementRole: z2.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"]),
      extraRoles: z2.array(z2.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"])).optional(),
      department: z2.string().optional(),
      phone: z2.string().optional(),
      jobTitle: z2.string().optional(),
      approvalLevel: z2.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
      extraApprovalLevels: z2.array(z2.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"])).optional(),
      active: z2.boolean().optional(),
      password: z2.string().min(6).optional()
    })).mutation(async ({ ctx, input }) => {
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      const callerId = ctx.user.id;
      if (!callerIsMaster) {
        if (!input.id || input.id !== callerId) {
          throw new Error("Apenas usu\xE1rios master podem criar ou editar outros usu\xE1rios.");
        }
        throw new Error("Para alterar sua senha, use a op\xE7\xE3o de redefini\xE7\xE3o de senha.");
      }
      if (input.approvalLevel === "master" && !callerIsMaster) {
        throw new Error("Apenas usu\xE1rios master podem atribuir o n\xEDvel master.");
      }
      if (input.id) {
        const target = await getUserById(input.id);
        if (target?.approvalLevel === "master" && !callerIsMaster) {
          throw new Error("Apenas usu\xE1rios master podem editar outro usu\xE1rio master.");
        }
      }
      const result = await upsertUserByAdmin(input);
      if (!input.id && input.email) {
        try {
          const { sendWelcomeEmail: sendWelcomeEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
          await sendWelcomeEmail2({
            toEmail: input.email,
            toName: input.name,
            jobTitle: input.jobTitle
          });
        } catch (e) {
          console.warn("[Email] Welcome email failed (non-critical):", e);
        }
      }
      if (!input.id && input.phone) {
        try {
          const { notifyNewUserRegistration: notifyNewUserRegistration2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
          await notifyNewUserRegistration2({
            userPhone: input.phone,
            userName: input.name,
            userEmail: input.email || void 0,
            jobTitle: input.jobTitle || void 0,
            registeredByName: ctx.user?.name || "Administrador"
          });
        } catch (e) {
          console.warn("[WhatsApp] Welcome notification failed (non-critical):", e);
        }
      }
      return result;
    }),
    toggleActive: protectedProcedure.input(z2.object({ id: z2.number(), active: z2.boolean() })).mutation(async ({ ctx, input }) => {
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      const target = await getUserById(input.id);
      if (target?.approvalLevel === "master" && !callerIsMaster) {
        throw new Error("Apenas usu\xE1rios master podem ativar/desativar outro usu\xE1rio master.");
      }
      return toggleUserActive(input.id, input.active);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteUser(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      users: z2.array(z2.object({
        name: z2.string().min(1),
        email: z2.string().optional(),
        phone: z2.string().optional(),
        department: z2.string().optional(),
        procurementRole: z2.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"])
      }))
    })).mutation(({ input }) => importUsersBatch(input.users)),
    verifyPin: protectedProcedure.input(z2.object({ pin: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      if (!callerIsMaster) throw new Error("Apenas usu\xE1rios master podem usar o PIN.");
      const valid = await verifyMasterPin(ctx.user.id, input.pin);
      return { valid };
    }),
    updatePin: protectedProcedure.input(z2.object({ currentPin: z2.string().min(1), newPin: z2.string().min(4) })).mutation(async ({ ctx, input }) => {
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      if (!callerIsMaster) throw new Error("Apenas usu\xE1rios master podem alterar o PIN.");
      const valid = await verifyMasterPin(ctx.user.id, input.currentPin);
      if (!valid) throw new Error("PIN atual incorreto.");
      await updateMasterPin(ctx.user.id, input.newPin);
      return { success: true };
    }),
    resetPassword: protectedProcedure.input(z2.object({
      userId: z2.number(),
      newPassword: z2.string().min(6, "A senha deve ter pelo menos 6 caracteres")
    })).mutation(async ({ ctx, input }) => {
      const callerRole = ctx.user?.procurementRole;
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      const isAdmin = callerRole === "admin" || callerIsMaster;
      if (!isAdmin) throw new Error("Apenas administradores podem redefinir senhas.");
      const target = await getUserById(input.userId);
      if (!target) throw new Error("Usu\xE1rio n\xE3o encontrado.");
      if (target.approvalLevel === "master" && !callerIsMaster) {
        throw new Error("Apenas usu\xE1rios master podem redefinir a senha de outro master.");
      }
      const bcrypt3 = await import("bcryptjs");
      const passwordHash = await bcrypt3.hash(input.newPassword, 10);
      await updateUserPassword(input.userId, passwordHash);
      return { success: true };
    }),
    testWhatsApp: protectedProcedure.input(z2.object({ userId: z2.number() })).mutation(async ({ ctx, input }) => {
      const callerIsMaster = ctx.user?.approvalLevel === "master";
      if (!callerIsMaster) throw new Error("Apenas usu\xE1rios master podem enviar mensagens de teste.");
      const target = await getUserById(input.userId);
      if (!target) throw new Error("Usu\xE1rio n\xE3o encontrado.");
      if (!target.phone) throw new Error("Este usu\xE1rio n\xE3o possui telefone cadastrado.");
      const { sendWhatsAppTestMessage: sendWhatsAppTestMessage2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
      const sent = await sendWhatsAppTestMessage2({
        phone: target.phone,
        userName: target.name ?? "Usu\xE1rio",
        senderName: ctx.user?.name ?? "Administrador"
      });
      return { success: sent, phone: target.phone };
    })
  }),
  // ─── Cost Centers ──────────────────────────────────────────────────────────
  costCenters: router({
    list: protectedProcedure.query(() => listCostCenters()),
    listAll: protectedProcedure.query(() => listAllCostCenters()),
    toggleActive: protectedProcedure.input(z2.object({ id: z2.number(), active: z2.boolean() })).mutation(({ input }) => toggleCostCenterActive(input.id, input.active)),
    create: protectedProcedure.input(z2.object({
      code: z2.string().min(1),
      name: z2.string().min(1),
      responsible: z2.string().optional()
    })).mutation(({ input }) => createCostCenter(input)),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      code: z2.string().optional(),
      name: z2.string().optional(),
      responsible: z2.string().optional(),
      active: z2.boolean().optional()
    })).mutation(({ input }) => updateCostCenter(input.id, input)),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteCostCenter(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      rows: z2.array(z2.object({
        code: z2.string().min(1),
        name: z2.string().min(1),
        responsible: z2.string().optional()
      }))
    })).mutation(({ input }) => importCostCentersBatch(input.rows))
  }),
  // ─── Assets ────────────────────────────────────────────────────────────────
  assets: router({
    list: protectedProcedure.query(() => listAssets()),
    create: protectedProcedure.input(z2.object({
      code: z2.string().min(1),
      description: z2.string().min(1),
      category: z2.string().optional(),
      location: z2.string().optional(),
      value: z2.string().optional(),
      hasChassi: z2.boolean().optional(),
      chassiNumber: z2.string().optional(),
      licensePlate: z2.string().optional()
    })).mutation(({ input }) => createAsset(input)),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      code: z2.string().optional(),
      description: z2.string().optional(),
      category: z2.string().optional(),
      location: z2.string().optional(),
      active: z2.boolean().optional(),
      value: z2.string().optional(),
      hasChassi: z2.boolean().optional(),
      chassiNumber: z2.string().optional(),
      licensePlate: z2.string().optional()
    })).mutation(({ input }) => updateAsset(input.id, input)),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteAsset(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      rows: z2.array(z2.object({
        code: z2.string().min(1),
        description: z2.string().min(1),
        category: z2.string().optional(),
        location: z2.string().optional(),
        value: z2.string().optional(),
        hasChassi: z2.boolean().optional(),
        chassiNumber: z2.string().optional(),
        licensePlate: z2.string().optional()
      }))
    })).mutation(({ input }) => importAssetsBatch(input.rows))
  }),
  // ─── Purchase Requests ─────────────────────────────────────────────────────
  requests: router({
    create: protectedProcedure.input(z2.object({
      department: z2.string().min(1),
      costCenterId: z2.number().optional(),
      costCenterCode: z2.string().min(1, "Centro de Custo \xE9 obrigat\xF3rio"),
      application: z2.string().min(1),
      urgencyLevel: z2.enum(["normal", "urgente", "emergencial"]),
      observations: z2.string().optional(),
      osMyfarm: z2.string().optional(),
      items: z2.array(z2.object({
        description: z2.string().min(1),
        quantity: z2.string(),
        unit: z2.string().default("un"),
        unitPrice: z2.string().optional()
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createPurchaseRequest(ctx.user, input);
        return result;
      } catch (err) {
        const cause = err?.cause ?? err;
        console.error("[requests.create] ERROR:", err?.message ?? err);
        console.error("[requests.create] CAUSE message:", cause?.message ?? cause);
        console.error("[requests.create] CAUSE sqlMessage:", cause?.sqlMessage);
        console.error("[requests.create] CAUSE code:", cause?.code);
        console.error("[requests.create] CAUSE errno:", cause?.errno);
        console.error("[requests.create] QUERY:", err?.query ?? cause?.sql);
        console.error("[requests.create] PARAMS:", JSON.stringify(err?.params));
        throw err;
      }
    }),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(({ input }) => getPurchaseRequestWithDetails(input.id)),
    myRequests: protectedProcedure.query(
      ({ ctx }) => getRequestsByRequester(ctx.user.id)
    ),
    pendingForMe: protectedProcedure.query(({ ctx }) => {
      const user = ctx.user;
      const isMaster = user.approvalLevel === "master";
      if (isMaster) {
        return getPendingRequestsForUser("master", []);
      }
      const extraRoles = [];
      if (user.extraRoles) {
        try {
          extraRoles.push(...JSON.parse(user.extraRoles));
        } catch {
        }
      }
      if (user.approvalLevel && user.approvalLevel !== "nenhum" && user.approvalLevel !== "master") {
        extraRoles.push(user.approvalLevel);
      }
      if (user.extraApprovalLevels) {
        try {
          const levels = JSON.parse(user.extraApprovalLevels);
          extraRoles.push(...levels.filter((l) => l !== "nenhum" && l !== "master"));
        } catch {
        }
      }
      return getPendingRequestsForUser(ctx.user.procurementRole, extraRoles);
    }),
    all: protectedProcedure.input(z2.object({ department: z2.string().optional() }).optional()).query(({ input }) => getAllRequests(input?.department)),
    dashboardStats: protectedProcedure.query(
      ({ ctx }) => getDashboardStats(ctx.user.id, ctx.user.procurementRole)
    ),
    approvalTimingStats: protectedProcedure.query(
      () => getApprovalTimingStats()
    ),
    monthlyReport: protectedProcedure.input(z2.object({ year: z2.number().int().min(2020).max(2100), month: z2.number().int().min(1).max(12) })).query(({ input }) => getMonthlyReport(input.year, input.month)),
    rankingByCostCenter: protectedProcedure.input(z2.object({ year: z2.number().int().min(2020).max(2100), month: z2.number().int().min(1).max(12) })).query(({ input }) => getRankingByCostCenter(input.year, input.month)),
    rankingByItem: protectedProcedure.input(z2.object({ year: z2.number().int().min(2020).max(2100), month: z2.number().int().min(1).max(12) })).query(({ input }) => getRankingByItem(input.year, input.month)),
    history: protectedProcedure.input(z2.object({ requestId: z2.number() })).query(({ input }) => getApprovalHistory(input.requestId)),
    uploadBudget: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      fileUrl: z2.string().url()
    })).mutation(
      ({ ctx, input }) => attachBudget(input.requestId, ctx.user.id, ctx.user.name ?? "Usu\xE1rio", input.fileUrl)
    ),
    // Upload PDF as base64, store in S3, return public URL
    uploadFile: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      fileName: z2.string(),
      base64: z2.string(),
      // base64-encoded file content
      mimeType: z2.string().default("application/pdf")
    })).mutation(async ({ ctx, input }) => {
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const buffer = Buffer.from(input.base64, "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `budgets/${input.requestId}/${Date.now()}_${safeName}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await attachBudget(input.requestId, ctx.user.id, ctx.user.name ?? "Usu\xE1rio", url, input.fileName);
      return { url };
    }),
    // Upload comprovante de pagamento (Financeiro)
    uploadPaymentProof: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      fileName: z2.string(),
      base64: z2.string(),
      mimeType: z2.string().default("application/pdf")
    })).mutation(async ({ input }) => {
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const buffer = Buffer.from(input.base64, "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `payment-proofs/${input.requestId}/${Date.now()}_${safeName}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await attachPaymentProof(input.requestId, url);
      return { url };
    }),
    // Upload nota fiscal (Compras - verificação final)
    uploadInvoice: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      fileName: z2.string(),
      base64: z2.string(),
      mimeType: z2.string().default("application/pdf")
    })).mutation(async ({ input }) => {
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const buffer = Buffer.from(input.base64, "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `invoices/${input.requestId}/${Date.now()}_${safeName}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await attachInvoice(input.requestId, url);
      return { url };
    }),
    uploadOCSiagri: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      fileName: z2.string(),
      base64: z2.string(),
      mimeType: z2.string().default("application/pdf")
    })).mutation(async ({ input }) => {
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const buffer = Buffer.from(input.base64, "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `oc-siagri/${input.requestId}/${Date.now()}_${safeName}`;
      const { url } = await storagePut2(key, buffer, input.mimeType);
      await attachOCSiagri(input.requestId, url);
      return { url };
    }),
    // Enviar orçamento (Orçamento - avança para Controladoria após anexar PDF)
    submitBudget: protectedProcedure.input(z2.object({ requestId: z2.number(), estimatedValue: z2.number().positive().optional() })).mutation(({ ctx, input }) => submitBudget(input.requestId, ctx.user, input.estimatedValue)),
    // Finalizar OC (Compras - encerra o fluxo e habilita nos Malotes)
    // orderValue é obrigatório: Valor da Ordem de Compra definido pelo Compras na Emissão de OC
    finalizeOC: protectedProcedure.input(z2.object({ requestId: z2.number(), orderValue: z2.number() })).mutation(({ ctx, input }) => finalizeOC(input.requestId, ctx.user, input.orderValue)),
    // Cancelar solicitação (somente solicitante ou master)
    cancel: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      reason: z2.string().min(1, "O motivo do cancelamento \xE9 obrigat\xF3rio.")
    })).mutation(({ ctx, input }) => cancelRequest(input.requestId, ctx.user, input.reason)),
    reopen: protectedProcedure.input(z2.object({
      requestId: z2.number()
    })).mutation(({ ctx, input }) => {
      const user = ctx.user;
      if (user.approvalLevel !== "master") throw new Error("Apenas usu\xE1rios master podem reabrir solicita\xE7\xF5es.");
      return reopenRequest(input.requestId, user.id, user.name);
    }),
    // Listar todas as solicitações (somente master)
    allForMaster: protectedProcedure.query(({ ctx }) => {
      const isMaster = ctx.user.approvalLevel === "master";
      if (!isMaster) throw new Error("Acesso restrito a usu\xE1rios master.");
      return getAllRequests();
    }),
    // Editar solicitação aberta (qualquer usuário autenticado, status editável)
    update: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      department: z2.string().min(1),
      costCenterId: z2.number().optional(),
      costCenterCode: z2.string().optional(),
      application: z2.string().min(1),
      urgencyLevel: z2.enum(["normal", "urgente", "emergencial"]),
      observations: z2.string().optional(),
      osMyfarm: z2.string().optional(),
      items: z2.array(z2.object({
        description: z2.string().min(1),
        quantity: z2.string(),
        unit: z2.string().default("un"),
        unitPrice: z2.string().optional()
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      const { requestId, ...data } = input;
      const result = await updatePurchaseRequest(
        requestId,
        ctx.user.id,
        ctx.user.name ?? "Usu\xE1rio",
        data
      );
      if (!result.success) throw new Error(result.error ?? "Erro ao editar solicita\xE7\xE3o");
      return result;
    }),
    // Edição pela Controladoria (sem reiniciar fluxo)
    updateByControladoria: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      department: z2.string().min(1),
      costCenterId: z2.number().optional(),
      costCenterCode: z2.string().optional(),
      application: z2.string().min(1),
      urgencyLevel: z2.enum(["normal", "urgente", "emergencial"]),
      observations: z2.string().optional(),
      osMyfarm: z2.string().optional(),
      items: z2.array(z2.object({
        description: z2.string().min(1),
        quantity: z2.string(),
        unit: z2.string().default("un"),
        unitPrice: z2.string().optional()
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const allRoles = [user.procurementRole, ...user.extraRoles ? JSON.parse(user.extraRoles) : []];
      const isControladoria = allRoles.includes("controladoria") || user.approvalLevel === "controladoria" || user.approvalLevel === "master";
      if (!isControladoria) throw new Error("Apenas usu\xE1rios da Controladoria podem usar esta edi\xE7\xE3o.");
      const { requestId, ...data } = input;
      const result = await updateByControladoria(
        requestId,
        ctx.user.id,
        ctx.user.name ?? "Usu\xE1rio",
        data
      );
      if (!result.success) throw new Error(result.error ?? "Erro ao editar solicita\xE7\xE3o");
      return result;
    }),
    // Excluir solicitação cancelada (somente solicitante ou admin/master)
    delete: protectedProcedure.input(z2.object({ requestId: z2.number() })).mutation(({ ctx, input }) => {
      const user = ctx.user;
      const isAdmin = user.role === "admin" || user.approvalLevel === "master";
      return deletePurchaseRequest(input.requestId, user.id, isAdmin);
    })
  }),
  // ─── Approvals ─────────────────────────────────────────────────────────────
  approvals: router({
    approve: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      comment: z2.string().optional(),
      purchaseOrderNumber: z2.string().optional(),
      orderValue: z2.number().positive().optional(),
      paymentInfo: z2.string().optional(),
      paymentMethod: z2.enum(["pix", "boleto", "cartao_avista", "cartao_parcelado"]).optional(),
      paymentObservations: z2.string().optional(),
      paymentInstallments: z2.number().int().min(1).max(48).optional()
    })).mutation(
      ({ ctx, input }) => approveRequest(input.requestId, ctx.user, input)
    ),
    reject: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      comment: z2.string().min(1, "Justificativa obrigat\xF3ria")
    })).mutation(
      ({ ctx, input }) => rejectRequest(input.requestId, ctx.user, input.comment)
    )
  }),
  // ─── WhatsApp Configuration ────────────────────────────────────────────────
  whatsapp: router({
    status: protectedProcedure.query(async () => {
      const { getProviderInfo: getProviderInfo2, isConfigured: isConfigured2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
      return getProviderInfo2();
    }),
    testSend: protectedProcedure.input(z2.object({
      phone: z2.string().min(8),
      message: z2.string().min(1).optional()
    })).mutation(async ({ ctx, input }) => {
      const { sendSimpleWhatsApp: sendSimpleWhatsApp2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
      const msg = input.message ?? `\u2705 Teste de notifica\xE7\xE3o CGS Agr\xEDcola

Ol\xE1, *${ctx.user.name ?? "Usu\xE1rio"}*!

Sua integra\xE7\xE3o com WhatsApp est\xE1 funcionando corretamente.

_Sistema de Compras CGS Agr\xEDcola_`;
      const ok = await sendSimpleWhatsApp2(input.phone, msg);
      if (!ok) throw new Error("Falha ao enviar mensagem. Verifique as configura\xE7\xF5es do provedor.");
      return { success: true };
    }),
    notifyApproversNow: protectedProcedure.input(z2.object({ requestId: z2.number() })).mutation(async ({ ctx, input }) => {
      const [req] = await (await getDb()).select().from((await Promise.resolve().then(() => (init_schema(), schema_exports))).purchaseRequests).where((await import("drizzle-orm")).eq((await Promise.resolve().then(() => (init_schema(), schema_exports))).purchaseRequests.id, input.requestId)).limit(1);
      if (!req) throw new Error("Solicita\xE7\xE3o n\xE3o encontrada");
      const { notifyApproverWithToken: notifyApproverWithToken2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
      const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq3 } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (!dbConn) throw new Error("Database not available");
      const { requestItems: requestItems2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const items = await dbConn.select().from(requestItems2).where(eq3(requestItems2.requestId, req.id));
      const itemsForMsg = items.map((it) => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
      if (req.status === "aguardando_orcamento") {
        const { notifyBudgetRequired: notifyBudgetRequired2 } = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
        const [requester] = await dbConn.select().from(users2).where(eq3(users2.id, req.requesterId)).limit(1);
        if (!requester?.phone) throw new Error("Solicitante n\xE3o tem telefone cadastrado");
        await notifyBudgetRequired2({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId: req.id,
          application: req.application,
          urgencyLevel: req.urgencyLevel,
          department: req.department,
          items: itemsForMsg,
          totalValue: req.totalEstimatedValue ?? void 0
        });
        return { sent: 1, approversFound: 1 };
      }
      const roleMap = {
        aguardando_gerente: "gerente",
        aguardando_controladoria: "controladoria",
        aguardando_diretoria: "diretoria",
        aguardando_ordem_compra: "orcamento",
        aguardando_comprovante_pagamento: "financeiro",
        aguardando_verificacao_compras: "orcamento"
      };
      const STEP_LABELS = {
        aguardando_gerente: "Aprova\xE7\xE3o Gerente",
        aguardando_controladoria: "Aprova\xE7\xE3o Controladoria",
        aguardando_diretoria: "Aprova\xE7\xE3o Diretoria",
        aguardando_ordem_compra: "Emiss\xE3o de Ordem de Compra",
        aguardando_comprovante_pagamento: "Comprovante de Pagamento",
        aguardando_verificacao_compras: "Verifica\xE7\xE3o Final"
      };
      const role = roleMap[req.status];
      if (!role) throw new Error("Solicita\xE7\xE3o n\xE3o est\xE1 em etapa pendente de aprova\xE7\xE3o");
      const { or: orOp, and: andOp } = await import("drizzle-orm");
      const approversRaw = await dbConn.select().from(users2).where(
        andOp(
          eq3(users2.active, true),
          orOp(
            eq3(users2.procurementRole, role),
            eq3(users2.approvalLevel, role)
          )
        )
      );
      const approvers = [...new Map(approversRaw.map((a) => [a.id, a])).values()];
      let sent = 0;
      for (const approver of approvers) {
        if (approver.phone) {
          await notifyApproverWithToken2({
            approverPhone: approver.phone,
            approverName: approver.name ?? "Aprovador",
            approverId: approver.id,
            requestNumber: req.requestNumber,
            requestId: req.id,
            requesterName: req.requesterName,
            application: req.application,
            urgencyLevel: req.urgencyLevel,
            department: req.department,
            stepLabel: STEP_LABELS[req.status] ?? role,
            step: role,
            items: itemsForMsg,
            totalValue: req.totalEstimatedValue ?? void 0
          });
          sent++;
        }
      }
      return { sent, approversFound: approvers.length };
    })
  }),
  // ─── Units / Unidades ─────────────────────────────────────────────────────────
  units: router({
    list: protectedProcedure.query(() => listUnits()),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      code: z2.string().min(1),
      address: z2.string().optional(),
      city: z2.string().optional(),
      state: z2.string().optional(),
      responsibleName: z2.string().optional(),
      responsiblePhone: z2.string().optional()
    })).mutation(({ input }) => createUnit(input)),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().optional(),
      code: z2.string().optional(),
      address: z2.string().optional(),
      city: z2.string().optional(),
      state: z2.string().optional(),
      responsibleName: z2.string().optional(),
      responsiblePhone: z2.string().optional(),
      active: z2.boolean().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateUnit(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteUnit(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      rows: z2.array(z2.object({
        code: z2.string().min(1),
        name: z2.string().min(1),
        address: z2.string().optional(),
        city: z2.string().optional(),
        state: z2.string().optional(),
        responsibleName: z2.string().optional(),
        responsiblePhone: z2.string().optional()
      }))
    })).mutation(({ input }) => importUnitsBatch(input.rows))
  }),
  //  // ─── Business Units / Unidades ────────────────────────────────────────────────
  businessUnits: router({
    list: protectedProcedure.query(() => listBusinessUnits()),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      code: z2.string().min(1),
      type: z2.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
      address: z2.string().optional(),
      city: z2.string().optional(),
      state: z2.string().optional(),
      responsibleName: z2.string().optional(),
      responsiblePhone: z2.string().optional()
    })).mutation(({ input }) => createBusinessUnit(input)),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().optional(),
      code: z2.string().optional(),
      type: z2.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
      address: z2.string().optional(),
      city: z2.string().optional(),
      state: z2.string().optional(),
      responsibleName: z2.string().optional(),
      responsiblePhone: z2.string().optional(),
      active: z2.boolean().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateBusinessUnit(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteBusinessUnit(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      rows: z2.array(z2.object({
        code: z2.string().min(1),
        name: z2.string().min(1),
        type: z2.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
        address: z2.string().optional(),
        city: z2.string().optional(),
        state: z2.string().optional(),
        responsibleName: z2.string().optional(),
        responsiblePhone: z2.string().optional()
      }))
    })).mutation(({ input }) => importBusinessUnitsBatch(input.rows))
  }),
  // ─── Departments / Departamentos ───────────────────────────────────────────────────────────
  departments: router({
    list: protectedProcedure.query(() => listDepartments()),
    nextCode: protectedProcedure.query(() => getNextDepartmentCode()),
    create: protectedProcedure.input(z2.object({
      code: z2.string().min(1),
      name: z2.string().min(1),
      responsible: z2.string().optional()
    })).mutation(({ input }) => createDepartment(input)),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      code: z2.string().optional(),
      name: z2.string().optional(),
      responsible: z2.string().optional(),
      active: z2.boolean().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateDepartment(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ input }) => deleteDepartment(input.id)),
    importBatch: protectedProcedure.input(z2.object({
      rows: z2.array(z2.object({
        code: z2.string().min(1),
        name: z2.string().min(1),
        responsible: z2.string().optional()
      }))
    })).mutation(({ input }) => importDepartmentsBatch(input.rows))
  }),
  // ─── Malotes ──────────────────────────────────────────────────────────────
  ai: router({
    analyzeBudget: protectedProcedure.input(z2.object({
      requestId: z2.number(),
      budgetFileUrl: z2.string().url(),
      requestDescription: z2.string(),
      requestItems: z2.array(z2.object({
        name: z2.string(),
        quantity: z2.number(),
        unitPrice: z2.number().nullable()
      })).optional()
    })).mutation(async ({ input }) => {
      const extractionPrompt = 'Voc\xEA \xE9 um assistente especializado em leitura de documentos.\nLeia o PDF do or\xE7amento em anexo e extraia TODOS os itens listados.\nRetorne APENAS um JSON: {"items":[{"name":"nome","quantity":1,"unitPrice":100.00,"totalPrice":100.00}],"supplier":"fornecedor","totalBudget":1000.00}\nSe algum campo n\xE3o estiver vis\xEDvel, use null.';
      const extractionContent = [
        { type: "text", text: `Extraia os itens do or\xE7amento para: "${input.requestDescription}"` },
        { type: "file_url", file_url: { url: input.budgetFileUrl, mime_type: "application/pdf" } }
      ];
      const extractionResponse = await invokeLLM({
        messages: [
          { role: "system", content: extractionPrompt },
          { role: "user", content: extractionContent }
        ],
        response_format: { type: "json_object" }
      });
      const extractedRaw = extractionResponse.choices[0].message.content;
      const extractedStr = typeof extractedRaw === "string" ? extractedRaw : JSON.stringify(extractedRaw);
      let extracted;
      try {
        extracted = JSON.parse(extractedStr);
      } catch {
        extracted = { items: input.requestItems?.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.unitPrice ? i.unitPrice * i.quantity : null })) ?? [] };
      }
      const serperKey = ENV.serperApiKey;
      const webPrices = {};
      if (serperKey && extracted.items.length > 0) {
        const searchPromises = extracted.items.slice(0, 8).map(async (item) => {
          try {
            const resp = await fetch("https://google.serper.dev/shopping", {
              method: "POST",
              headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
              body: JSON.stringify({ q: `${item.name} pre\xE7o Sinop MT Mato Grosso`, gl: "br", hl: "pt-br", num: 8 })
            });
            if (!resp.ok) return;
            const data = await resp.json();
            const prices = (data.shopping ?? []).map((r) => ({ title: r.title, price: parseFloat((r.price ?? "").replace(/[R$\s.]/g, "").replace(",", ".")), link: r.link, source: r.source })).filter((r) => !isNaN(r.price) && r.price > 0);
            if (prices.length > 0) {
              const vals = prices.map((p) => p.price);
              webPrices[item.name] = {
                min: Math.min(...vals),
                max: Math.max(...vals),
                avg: vals.reduce((a, b) => a + b, 0) / vals.length,
                sources: prices.slice(0, 3)
              };
            }
          } catch {
          }
        });
        await Promise.all(searchPromises);
      }
      const hasWebPrices = Object.keys(webPrices).length > 0;
      const webPricesLines = hasWebPrices ? Object.entries(webPrices).map(
        ([name, data]) => `- ${name}: min R$ ${data.min.toFixed(2)}, max R$ ${data.max.toFixed(2)}, m\xE9dia R$ ${data.avg.toFixed(2)} | ${data.sources.map((s) => `${s.source} R$${s.price.toFixed(2)}`).join(", ")}`
      ).join("\n") : "";
      const webPricesContext = hasWebPrices ? `

PRE\xC7OS REAIS DO GOOGLE SHOPPING (refer\xEAncia principal):
${webPricesLines}` : "";
      const refSource = hasWebPrices ? "Use os PRE\xC7OS REAIS DO GOOGLE SHOPPING fornecidos como refer\xEAncia principal. Esses pre\xE7os foram buscados com foco em Sinop-MT e regi\xE3o (Mato Grosso)." : "Use seu conhecimento de pre\xE7os do mercado de Sinop-MT e regi\xE3o (Mato Grosso) para 2024-2025. Considere que Sinop \xE9 um polo agr\xEDcola do Centro-Oeste com pre\xE7os influenciados pela log\xEDstica regional.";
      const sourcesInstruction = hasWebPrices ? "5. Inclua as fontes de pre\xE7o no campo 'sources' de cada item." : "";
      const systemPrompt = `Voc\xEA \xE9 um especialista em compras e an\xE1lise de or\xE7amentos para o setor agr\xEDcola, com profundo conhecimento do mercado de Sinop-MT e regi\xE3o (Mato Grosso).
${refSource}

Para cada item do or\xE7amento:
1. Compare o pre\xE7o cotado com os pre\xE7os praticados em Sinop-MT e regi\xE3o
2. Classifique: ADEQUADO (\xB115%), ACIMA_DO_MERCADO (15-30% acima), MUITO_ACIMA (>30% acima), ABAIXO_DO_MERCADO (>15% abaixo)
3. Calcule a varia\xE7\xE3o percentual em rela\xE7\xE3o ao pre\xE7o m\xE9dio regional
4. Forne\xE7a uma justificativa t\xE9cnica considerando fatores regionais (frete, disponibilidade local, sazonalidade agr\xEDcola do MT)
5. No campo 'justification', mencione explicitamente se o pre\xE7o est\xE1 compat\xEDvel com o mercado de Sinop-MT
${sourcesInstruction}

No campo 'summary', inclua obrigatoriamente:
- Um par\xE1grafo de comparativo regional: como os pre\xE7os deste or\xE7amento se comparam ao mercado de Sinop-MT e regi\xE3o
- Observa\xE7\xF5es sobre disponibilidade local vs. necessidade de compra fora da regi\xE3o
- Recomenda\xE7\xE3o de fornecedores locais quando aplic\xE1vel

Retorne JSON:
{"items":[{"name":"","quantity":1,"unitPrice":0,"totalPrice":0,"marketPriceMin":0,"marketPriceMax":0,"variation":0,"status":"ADEQUADO","justification":"","sources":[{"title":"","price":0,"link":"","source":""}]}],"totalBudget":0,"totalMarketMin":0,"totalMarketMax":0,"overallVariation":0,"recommendation":"APROVADO","summary":"","regionalComparison":"","alerts":[],"usedWebSearch":${hasWebPrices}}`;
      const itemsText = extracted.items.map((i) => `- ${i.name}: ${i.quantity}x R$${(i.unitPrice ?? 0).toFixed(2)} = R$${(i.totalPrice ?? 0).toFixed(2)}`).join("\n");
      const userText = `Or\xE7amento: "${input.requestDescription}" | Fornecedor: ${extracted.supplier ?? "N/A"} | Total: R$ ${(extracted.totalBudget ?? 0).toFixed(2)}

Itens:
${itemsText}${webPricesContext}

Emita o parecer completo.`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        response_format: { type: "json_object" }
      });
      const rawContent = response.choices[0].message.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const analysis = JSON.parse(contentStr);
      analysis.usedWebSearch = hasWebPrices;
      await saveBudgetAnalysis(input.requestId, JSON.stringify(analysis));
      return analysis;
    }),
    getBudgetAnalysis: protectedProcedure.input(z2.object({ requestId: z2.number() })).query(async ({ input }) => {
      const result = await getBudgetAnalysis(input.requestId);
      if (!result) return null;
      try {
        return JSON.parse(result);
      } catch {
        return null;
      }
    }),
    analyzePurchasesByCategory: protectedProcedure.mutation(async () => {
      const completed = await getCompletedRequestsWithItems();
      if (!completed || completed.length === 0) {
        return { categories: [], generatedAt: (/* @__PURE__ */ new Date()).toISOString(), summary: "Nenhuma compra conclu\xEDda encontrada." };
      }
      const categoryMap = /* @__PURE__ */ new Map();
      for (const req of completed) {
        const cat = req.application || "Outros";
        if (!categoryMap.has(cat)) categoryMap.set(cat, { totalPaid: 0, items: [], count: 0 });
        const entry = categoryMap.get(cat);
        entry.totalPaid += Number(req.totalValue ?? 0);
        entry.count += 1;
        for (const item of req.items) {
          entry.items.push(`${item.description} (${item.quantity}x R$${Number(item.unitPrice ?? 0).toFixed(2)})`);
        }
      }
      const categorySummary = Array.from(categoryMap.entries()).sort((a, b) => b[1].totalPaid - a[1].totalPaid).slice(0, 10).map(([name, data]) => ({
        name,
        totalPaid: data.totalPaid,
        count: data.count,
        sampleItems: data.items.slice(0, 5)
      }));
      const systemPrompt = `Voc\xEA \xE9 um especialista em compras e an\xE1lise de mercado para o setor agr\xEDcola brasileiro.
Analise os dados de compras conclu\xEDdas agrupadas por categoria e compare com os pre\xE7os de mercado.

Para cada categoria, estime:
1. O valor de mercado esperado (min e max) para os itens comprados
2. A varia\xE7\xE3o percentual entre o valor pago e o mercado
3. Uma avalia\xE7\xE3o: OTIMO (>10% abaixo do mercado), BOM (at\xE9 10% abaixo), ADEQUADO (\xB110%), ATENCAO (at\xE9 20% acima), CRITICO (>20% acima)
4. Uma observa\xE7\xE3o curta sobre a categoria

Retorne JSON:
{
  "categories": [
    {
      "name": "nome da categoria",
      "totalPaid": 1000.00,
      "marketMin": 900.00,
      "marketMax": 1100.00,
      "variation": -5.0,
      "status": "ADEQUADO",
      "observation": "Pre\xE7os dentro do esperado para insumos agr\xEDcolas"
    }
  ],
  "overallEfficiency": -3.5,
  "summary": "Resumo geral da efici\xEAncia de compras...",
  "topOpportunity": "Categoria com maior potencial de economia..."
}`;
      const userText = `Analise as seguintes categorias de compras conclu\xEDdas:

${categorySummary.map(
        (c) => `Categoria: "${c.name}"
Total pago: R$ ${c.totalPaid.toFixed(2)}
N\xFAmero de compras: ${c.count}
Itens de exemplo: ${c.sampleItems.join("; ")}`
      ).join("\n\n")}`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ],
        response_format: { type: "json_object" }
      });
      const rawContent = response.choices[0].message.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const analysis = JSON.parse(contentStr);
      return {
        ...analysis,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    })
  }),
  malotes: router({
    list: protectedProcedure.query(() => listMalotes()),
    stats: protectedProcedure.query(() => getMaloteStats()),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(({ input }) => getMaloteWithItems(input.id)),
    readyRequests: protectedProcedure.query(() => getRequestsReadyForMalote()),
    create: protectedProcedure.input(z2.object({
      originUnit: z2.string().min(1),
      destinationUnit: z2.string().min(1),
      notes: z2.string().optional()
    })).mutation(
      ({ ctx, input }) => createMalote({
        originUnit: input.originUnit,
        destinationUnit: input.destinationUnit,
        notes: input.notes ?? null,
        createdById: ctx.user.id,
        createdByName: ctx.user.name ?? "Usu\xE1rio"
      })
    ),
    addRequest: protectedProcedure.input(z2.object({
      maloteId: z2.number(),
      requestId: z2.number(),
      requestCode: z2.string(),
      requesterName: z2.string(),
      application: z2.string()
    })).mutation(
      ({ ctx, input }) => addRequestToMalote({
        maloteId: input.maloteId,
        requestId: input.requestId,
        requestCode: input.requestCode,
        requesterName: input.requesterName,
        application: input.application,
        addedById: ctx.user.id,
        addedByName: ctx.user.name ?? "Usu\xE1rio"
      })
    ),
    removeRequest: protectedProcedure.input(z2.object({ maloteItemId: z2.number() })).mutation(({ input }) => removeRequestFromMalote(input.maloteItemId)),
    send: protectedProcedure.input(z2.object({ maloteId: z2.number() })).mutation(
      ({ ctx, input }) => sendMalote({
        maloteId: input.maloteId,
        sentById: ctx.user.id,
        sentByName: ctx.user.name ?? "Usu\xE1rio"
      })
    ),
    receive: protectedProcedure.input(z2.object({
      maloteId: z2.number(),
      receiptNotes: z2.string().default(""),
      signatureData: z2.string().optional(),
      itemReceipts: z2.array(z2.object({
        itemId: z2.number(),
        receiptStatus: z2.enum(["recebido", "devolvido"]),
        receiptNotes: z2.string().optional()
      }))
    })).mutation(
      ({ ctx, input }) => receiveMalote({
        maloteId: input.maloteId,
        receivedById: ctx.user.id,
        receivedByName: ctx.user.name ?? "Usu\xE1rio",
        receiptNotes: input.receiptNotes,
        signatureData: input.signatureData,
        itemReceipts: input.itemReceipts
      })
    )
  }),
  // ─── Safras (Harvests) ────────────────────────────────────────────────────────────────────────────────
  harvests: router({
    list: protectedProcedure.query(() => listHarvests()),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      year: z2.string().min(1),
      startDate: z2.string().optional(),
      endDate: z2.string().optional()
    })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode criar safras.");
      }
      return createHarvest(input);
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().optional(),
      year: z2.string().optional(),
      startDate: z2.string().optional(),
      endDate: z2.string().optional(),
      active: z2.boolean().optional()
    })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode editar safras.");
      }
      const { id, ...data } = input;
      return updateHarvest(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode excluir safras.");
      }
      return deleteHarvest(input.id);
    })
  }),
  // ─── Orçamentos (Budgets) ─────────────────────────────────────────────────────────────────────────────
  budgets: router({
    list: protectedProcedure.input(z2.object({ harvestId: z2.number().optional() })).query(({ input }) => listBudgets(input.harvestId)),
    summary: protectedProcedure.query(() => getBudgetSummary()),
    create: protectedProcedure.input(z2.object({
      harvestId: z2.number(),
      costCenterId: z2.number().optional(),
      costCenterCode: z2.string().optional(),
      costCenterName: z2.string().optional(),
      category: z2.string().optional(),
      totalValue: z2.string().min(1),
      notes: z2.string().optional()
    })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode criar or\xE7amentos.");
      }
      return createBudget({ ...input, createdBy: ctx.user.name ?? "Oscar" });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      harvestId: z2.number().optional(),
      costCenterId: z2.number().optional(),
      costCenterCode: z2.string().optional(),
      costCenterName: z2.string().optional(),
      category: z2.string().optional(),
      totalValue: z2.string().optional(),
      notes: z2.string().optional()
    })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode editar or\xE7amentos.");
      }
      const { id, ...data } = input;
      return updateBudget(id, data);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ ctx, input }) => {
      if (ctx.user.name !== "Oscar" && ctx.user.procurementRole !== "master") {
        throw new Error("Apenas o usu\xE1rio Oscar pode excluir or\xE7amentos.");
      }
      return deleteBudget(input.id);
    })
  }),
  // ─── API Keys ───────────────────────────────────────────────────────────────────────────────────
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => {
      const isMaster = ctx.user?.approvalLevel === "master";
      if (!isMaster) throw new Error("Apenas usu\xE1rios master podem gerenciar chaves de API.");
      return listApiKeys();
    }),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1),
      description: z2.string().optional(),
      permissions: z2.array(z2.string()).optional(),
      expiresAt: z2.string().optional()
    })).mutation(({ ctx, input }) => {
      const isMaster = ctx.user?.approvalLevel === "master";
      if (!isMaster) throw new Error("Apenas usu\xE1rios master podem criar chaves de API.");
      return createApiKey({
        name: input.name,
        description: input.description,
        permissions: input.permissions ?? ["create_request"],
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : void 0,
        createdById: ctx.user.id,
        createdByName: ctx.user.name ?? ""
      });
    }),
    revoke: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ ctx, input }) => {
      const isMaster = ctx.user?.approvalLevel === "master";
      if (!isMaster) throw new Error("Apenas usu\xE1rios master podem revogar chaves de API.");
      return revokeApiKey(input.id);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(({ ctx, input }) => {
      const isMaster = ctx.user?.approvalLevel === "master";
      if (!isMaster) throw new Error("Apenas usu\xE1rios master podem excluir chaves de API.");
      return deleteApiKey(input.id);
    })
  }),
  // ─── Integração CGS Manutenções ────────────────────────────────────────────
  maintenance: router({
    listWorkOrders: protectedProcedure.input(z2.object({
      search: z2.string().optional(),
      status: z2.string().optional()
    }).optional()).query(async ({ input }) => {
      const apiKey = ENV.cgsMaintainApiKey;
      if (!apiKey) throw new Error("CGS_MAINTENANCE_API_KEY n\xE3o configurada.");
      const baseUrl = "https://cgsmaintain-yb3cdfwd.manus.space";
      const url = new URL(`${baseUrl}/api/integration/work-orders`);
      if (input?.search) url.searchParams.set("search", input.search);
      if (input?.status) url.searchParams.set("status", input.status);
      const res = await fetch(url.toString(), {
        headers: {
          "X-API-Key": apiKey,
          "Accept": "application/json"
        }
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Erro ao buscar OS: ${res.status} ${err}`);
      }
      const data = await res.json();
      return data.data ?? [];
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/whatsapp-webhook.ts
init_whatsapp();
init_db();
function parseReply(text2) {
  const normalized = text2.trim().toUpperCase();
  if (normalized === "APROVAR" || normalized === "APPROVE" || normalized === "SIM" || normalized === "OK") {
    return { action: "approve" };
  }
  if (normalized.startsWith("REJEITAR ") || normalized.startsWith("REJECT ") || normalized.startsWith("N\xC3O ") || normalized.startsWith("NAO ")) {
    const comment = text2.trim().replace(/^(REJEITAR|REJECT|NÃO|NAO)\s+/i, "").trim();
    return { action: "reject", comment: comment || "Rejeitado via WhatsApp" };
  }
  if (normalized === "REJEITAR" || normalized === "REJECT" || normalized === "N\xC3O" || normalized === "NAO") {
    return { action: "reject", comment: "Rejeitado via WhatsApp" };
  }
  return { action: "unknown" };
}
function extractSenderAndText(body, provider) {
  try {
    if (provider === "zapi") {
      const phone = body.phone || body.from;
      const text2 = body.text?.message || body.body || "";
      if (phone && text2) return { phone, text: text2 };
    } else if (provider === "twilio") {
      const from = body.From || "";
      const text2 = body.Body || "";
      const phone = from.replace("whatsapp:", "");
      if (phone && text2) return { phone, text: text2 };
    } else {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const msg = change?.value?.messages?.[0];
      if (msg) {
        return { phone: msg.from, text: msg.text?.body || "" };
      }
    }
  } catch {
  }
  return null;
}
function registerWhatsAppWebhook(app) {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "cgs-agricola-webhook";
  const PROVIDER2 = process.env.ZAPI_INSTANCE_ID ? "zapi" : (process.env.WHATSAPP_PROVIDER ?? "meta").toLowerCase();
  app.get("/api/whatsapp/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified \u2713");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });
  app.post("/api/whatsapp/webhook", async (req, res) => {
    res.sendStatus(200);
    try {
      const body = req.body;
      const extracted = extractSenderAndText(body, PROVIDER2);
      if (!extracted) {
        console.log("[WhatsApp] Webhook: could not extract sender/text from payload");
        return;
      }
      const { phone, text: text2 } = extracted;
      const normalizedPhone = normalizePhone(phone);
      console.log(`[WhatsApp] Incoming from ${normalizedPhone}: "${text2}"`);
      const session = await findPendingSessionByPhone(normalizedPhone);
      if (!session) {
        console.log(`[WhatsApp] No pending session for ${normalizedPhone}`);
        return;
      }
      const reply = parseReply(text2);
      if (reply.action === "unknown") {
        console.log(`[WhatsApp] Unknown reply from ${normalizedPhone}: "${text2}"`);
        return;
      }
      console.log(`[WhatsApp] Processing ${reply.action} for request #${session.requestNumber} (step: ${session.step})`);
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
          action: "approved"
        });
        console.log(`[WhatsApp] \u2713 Request #${session.requestNumber} approved by ${normalizedPhone}`);
      } else if (reply.action === "reject") {
        await rejectRequest(session.requestId, approverUser, reply.comment || "Rejeitado via WhatsApp");
        await resolveSession(session.id, "rejected");
        await notifyApproverActionConfirmation({
          approverPhone: normalizedPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "rejected",
          comment: reply.comment
        });
        console.log(`[WhatsApp] \u2717 Request #${session.requestNumber} rejected by ${normalizedPhone}: ${reply.comment}`);
      }
    } catch (error) {
      console.error("[WhatsApp] Webhook processing error:", error);
    }
  });
  app.get("/api/approve", async (req, res) => {
    const { token, action } = req.query;
    const htmlPage = (title, emoji, message, color) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} \u2014 CGS Agr\xEDcola</title>
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
    <p class="brand">\u{1F4F1} CompraF\xE1cil \u2014 CGS Agr\xEDcola</p>
  </div>
</body>
</html>`;
    if (!token || !action) {
      return res.status(400).send(htmlPage("Link inv\xE1lido", "\u26A0\uFE0F", "Este link de aprova\xE7\xE3o \xE9 inv\xE1lido ou est\xE1 incompleto.", "#F59E0B"));
    }
    if (action !== "approve" && action !== "reject") {
      return res.status(400).send(htmlPage("A\xE7\xE3o inv\xE1lida", "\u26A0\uFE0F", "A a\xE7\xE3o solicitada n\xE3o \xE9 reconhecida.", "#F59E0B"));
    }
    try {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { whatsappSessions: whatsappSessions2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq3 } = await import("drizzle-orm");
      const db = await getDb2();
      if (!db) return res.status(500).send(htmlPage("Erro interno", "\u274C", "N\xE3o foi poss\xEDvel conectar ao banco de dados.", "#EF4444"));
      const sessions = await db.select().from(whatsappSessions2).where(eq3(whatsappSessions2.token, token));
      const session = sessions[0];
      if (!session) {
        return res.status(404).send(htmlPage("Link n\xE3o encontrado", "\u{1F50D}", "Este link de aprova\xE7\xE3o n\xE3o existe ou j\xE1 foi utilizado.", "#6B7280"));
      }
      if (session.status !== "pending") {
        const statusMsg = session.status === "approved" ? "j\xE1 foi aprovada" : session.status === "rejected" ? "j\xE1 foi rejeitada" : "expirou";
        return res.status(410).send(htmlPage("Link expirado", "\u23F0", `Esta solicita\xE7\xE3o ${statusMsg}. N\xE3o \xE9 poss\xEDvel processar novamente.`, "#6B7280"));
      }
      if (session.expiresAt < /* @__PURE__ */ new Date()) {
        await db.update(whatsappSessions2).set({ status: "expired" }).where(eq3(whatsappSessions2.id, session.id));
        return res.status(410).send(htmlPage("Link expirado", "\u23F0", "Este link de aprova\xE7\xE3o expirou (validade de 48h). Solicite uma nova notifica\xE7\xE3o.", "#6B7280"));
      }
      const { approveRequest: approveRequest2, rejectRequest: rejectRequest2, getUserById: getUserById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const approverUser = await getUserById2(session.approverId);
      if (!approverUser) {
        return res.status(404).send(htmlPage("Usu\xE1rio n\xE3o encontrado", "\u274C", "O aprovador associado a este link n\xE3o foi encontrado no sistema.", "#EF4444"));
      }
      if (action === "approve") {
        await approveRequest2(session.requestId, approverUser, { comment: "Aprovado via link WhatsApp" });
        await db.update(whatsappSessions2).set({ status: "approved", resolvedAt: /* @__PURE__ */ new Date() }).where(eq3(whatsappSessions2.id, session.id));
        await notifyApproverActionConfirmation({
          approverPhone: session.approverPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "approved"
        });
        return res.send(htmlPage("Aprova\xE7\xE3o registrada!", "\u2705", `A solicita\xE7\xE3o <strong>${session.requestNumber}</strong> foi aprovada com sucesso. O solicitante ser\xE1 notificado.`, "#22C55E"));
      } else {
        await rejectRequest2(session.requestId, approverUser, "Rejeitado via link WhatsApp");
        await db.update(whatsappSessions2).set({ status: "rejected", resolvedAt: /* @__PURE__ */ new Date() }).where(eq3(whatsappSessions2.id, session.id));
        await notifyApproverActionConfirmation({
          approverPhone: session.approverPhone,
          approverName: session.approverName || "Aprovador",
          requestNumber: session.requestNumber,
          requestId: session.requestId,
          action: "rejected"
        });
        return res.send(htmlPage("Rejei\xE7\xE3o registrada!", "\u274C", `A solicita\xE7\xE3o <strong>${session.requestNumber}</strong> foi rejeitada. O solicitante ser\xE1 notificado para realizar corre\xE7\xF5es.`, "#EF4444"));
      }
    } catch (error) {
      console.error("[WhatsApp] Link approval error:", error);
      return res.status(500).send(htmlPage("Erro interno", "\u274C", "Ocorreu um erro ao processar sua resposta. Tente novamente ou responda APROVAR/REJEITAR pelo WhatsApp.", "#EF4444"));
    }
  });
  console.log("[WhatsApp] Webhook routes registered: GET/POST /api/whatsapp/webhook + GET /api/approve");
}

// server/cron.ts
import cron from "node-cron";

// server/daily-report.ts
init_db();
init_schema();
init_email();
init_whatsapp();
var TERMINAL_STATUSES = ["concluida", "rejeitada", "cancelada"];
function toReportItem(r) {
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
    itemNames: r.itemNames
  };
}
async function runDailyReport() {
  console.log("[DailyReport] Starting daily report generation...");
  const db = await getDb();
  if (!db) {
    console.warn("[DailyReport] No database connection \u2014 skipping.");
    return;
  }
  const now = /* @__PURE__ */ new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1e3);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const allRequests = await db.select().from(purchaseRequests);
  const allItems = await db.select().from(requestItems);
  const itemsByRequest = /* @__PURE__ */ new Map();
  for (const item of allItems) {
    const list = itemsByRequest.get(item.requestId) ?? [];
    list.push(item.description);
    itemsByRequest.set(item.requestId, list);
  }
  const getItemNames = (id) => {
    const names = itemsByRequest.get(id);
    if (!names || names.length === 0) return void 0;
    const preview = names.slice(0, 3).join(", ");
    return names.length > 3 ? `${preview} (+${names.length - 3})` : preview;
  };
  const openRequests = allRequests.filter((r) => !TERMINAL_STATUSES.includes(r.status)).map((r) => toReportItem({ ...r, itemNames: getItemNames(r.id) }));
  const completedToday = allRequests.filter((r) => r.status === "concluida" && r.updatedAt >= todayStart && r.updatedAt <= todayEnd).map((r) => toReportItem({ ...r, itemNames: getItemNames(r.id) }));
  const criticalRequests = openRequests.filter(
    (r) => r.deadlineAt != null && r.deadlineAt > now && r.deadlineAt <= in24h
  );
  const allUsers = await db.select().from(users);
  const activeUsers = allUsers.filter((u) => u.active);
  if (activeUsers.length === 0) {
    console.warn("[DailyReport] No active users found \u2014 skipping.");
    return;
  }
  const dateStr = now.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  console.log(
    `[DailyReport] Sending to ${activeUsers.length} users | Open: ${openRequests.length} | Critical: ${criticalRequests.length} | Completed today: ${completedToday.length}`
  );
  const urgencyLabel2 = (level) => level === "emergencial" ? "\u{1F534} Emergencial" : level === "urgente" ? "\u{1F7E1} Urgente" : "\u{1F7E2} Normal";
  const statusLabel2 = (status) => {
    const map = {
      aguardando_gerente: "Aguardando Gerente",
      aguardando_orcamento: "Aguardando Or\xE7amento",
      aguardando_controladoria: "Aguardando Controladoria",
      aguardando_diretoria: "Aguardando Diretoria",
      aguardando_ordem_compra: "Aguardando Ordem de Compra",
      aguardando_financeiro: "Aguardando Financeiro",
      concluida: "Conclu\xEDda",
      rejeitada: "Rejeitada",
      cancelada: "Cancelada"
    };
    return map[status] ?? status;
  };
  const formatDeadline2 = (date) => {
    if (!date) return "\u2014";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  const criticalSet = new Set(criticalRequests.map((r) => r.requestNumber));
  let whatsappMsg = `\u{1F4CA} *Relat\xF3rio Di\xE1rio de Compras \u2014 ${dateStr}*

`;
  whatsappMsg += `\u{1F4CC} *Resumo:*
`;
  whatsappMsg += `  \u2022 Em Aberto: *${openRequests.length}*
`;
  whatsappMsg += `  \u2022 \u26A0\uFE0F Prazo Cr\xEDtico (24h): *${criticalRequests.length}*
`;
  whatsappMsg += `  \u2022 \u2705 Conclu\xEDdas Hoje: *${completedToday.length}*

`;
  if (criticalRequests.length > 0) {
    whatsappMsg += `\u{1F6A8} *ATEN\xC7\xC3O \u2014 Prazos Cr\xEDticos:*
`;
    for (const r of criticalRequests) {
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  \u26A0\uFE0F *${r.requestNumber}*${items} | ${r.requesterName} | ${urgencyLabel2(r.urgencyLevel)} | Prazo: ${formatDeadline2(r.deadlineAt)}
`;
    }
    whatsappMsg += `
`;
  }
  if (openRequests.length > 0) {
    whatsappMsg += `\u{1F4CB} *Solicita\xE7\xF5es em Aberto:*
`;
    for (const r of openRequests) {
      const critical = criticalSet.has(r.requestNumber) ? " \u26A0\uFE0F" : "";
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  \u2022 *${r.requestNumber}*${critical}${items} | ${r.requesterName} | ${statusLabel2(r.status)}
`;
    }
    whatsappMsg += `
`;
  }
  if (completedToday.length > 0) {
    whatsappMsg += `\u2705 *Conclu\xEDdas Hoje:*
`;
    for (const r of completedToday) {
      const items = r.itemNames ? ` | _${r.itemNames}_` : "";
      whatsappMsg += `  \u2022 *${r.requestNumber}*${items} | ${r.requesterName}
`;
    }
  }
  const emailPromises = [];
  const whatsappPromises = [];
  for (const user of activeUsers) {
    if (user.email) {
      emailPromises.push(
        sendDailyReportEmail({
          toEmail: user.email,
          toName: user.name ?? "Usu\xE1rio",
          openRequests,
          completedToday,
          criticalRequests,
          date: dateStr
        })
      );
    }
    if (user.phone) {
      const personalizedMsg = whatsappMsg.replace(
        `\u{1F4CA} *Relat\xF3rio Di\xE1rio de Compras \u2014 ${dateStr}*`,
        `\u{1F4CA} *Relat\xF3rio Di\xE1rio de Compras \u2014 ${dateStr}*
Ol\xE1, ${user.name ?? "Usu\xE1rio"}!`
      );
      whatsappPromises.push(
        sendSimpleWhatsApp(user.phone, personalizedMsg)
      );
    }
  }
  const emailResults = await Promise.allSettled(emailPromises);
  const emailSent = emailResults.filter((r) => r.status === "fulfilled" && r.value).length;
  console.log(`[DailyReport] Emails sent: ${emailSent}/${emailPromises.length}`);
  await Promise.allSettled(whatsappPromises);
  console.log(`[DailyReport] WhatsApp messages sent to ${whatsappPromises.length} users`);
  console.log("[DailyReport] Daily report completed.");
}

// server/cron.ts
var initialized = false;
function registerCronJobs() {
  if (initialized) return;
  initialized = true;
  cron.schedule(
    "0 19 * * *",
    async () => {
      console.log("[Cron] Running daily report job (19:00 BRT)...");
      try {
        await runDailyReport();
      } catch (err) {
        console.error("[Cron] Daily report job failed:", err);
      }
    },
    {
      timezone: "America/Sao_Paulo"
    }
  );
  console.log("[Cron] Daily report scheduled for 19:00 BRT (America/Sao_Paulo)");
}

// server/api-integration.ts
init_db();
async function requireApiKey(req, res) {
  const rawKey = req.headers["x-api-key"];
  if (!rawKey) {
    res.status(401).json({ error: "API Key n\xE3o fornecida. Use o header X-API-Key." });
    return null;
  }
  const keyData = await validateApiKey(rawKey);
  if (!keyData) {
    res.status(401).json({ error: "API Key inv\xE1lida, revogada ou expirada." });
    return null;
  }
  return keyData;
}
function registerApiIntegration(app) {
  app.post("/api/integration/requests", async (req, res) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    const permissions = keyData.permissions ? JSON.parse(keyData.permissions) : [];
    if (!permissions.includes("create_request")) {
      res.status(403).json({ error: "Esta chave de API n\xE3o tem permiss\xE3o para criar solicita\xE7\xF5es." });
      return;
    }
    const {
      requesterName,
      department,
      costCenterCode,
      application,
      urgencyLevel = "normal",
      observations,
      osMaintenance,
      items
    } = req.body;
    if (!requesterName || typeof requesterName !== "string") {
      res.status(400).json({ error: "Campo obrigat\xF3rio: requesterName" });
      return;
    }
    if (!department || typeof department !== "string") {
      res.status(400).json({ error: "Campo obrigat\xF3rio: department" });
      return;
    }
    if (!costCenterCode || typeof costCenterCode !== "string") {
      res.status(400).json({ error: "Campo obrigat\xF3rio: costCenterCode" });
      return;
    }
    if (!application || typeof application !== "string") {
      res.status(400).json({ error: "Campo obrigat\xF3rio: application" });
      return;
    }
    if (!["normal", "urgente", "emergencial"].includes(urgencyLevel)) {
      res.status(400).json({ error: "urgencyLevel deve ser: normal, urgente ou emergencial" });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Campo obrigat\xF3rio: items (array com pelo menos 1 item)" });
      return;
    }
    for (const item of items) {
      if (!item.description || typeof item.description !== "string") {
        res.status(400).json({ error: "Cada item deve ter um campo 'description'" });
        return;
      }
    }
    try {
      const allUsers = await listUsers();
      const systemUser = allUsers.find((u) => u.approvalLevel === "master") ?? allUsers[0];
      if (!systemUser) {
        res.status(500).json({ error: "Nenhum usu\xE1rio dispon\xEDvel para criar a solicita\xE7\xE3o." });
        return;
      }
      const proxyUser = { ...systemUser, name: requesterName.trim() };
      const insertId = await createPurchaseRequest(proxyUser, {
        department: department.trim(),
        costCenterCode: costCenterCode.trim(),
        application: application.trim(),
        urgencyLevel,
        observations: observations?.trim() || void 0,
        osMyfarm: osMaintenance?.trim() || void 0,
        items: items.map((item) => ({
          description: String(item.description).trim(),
          quantity: String(item.quantity ?? "1"),
          unit: String(item.unit ?? "un"),
          unitPrice: item.unitPrice ? String(item.unitPrice) : void 0
        }))
      });
      const newReq = await getPurchaseRequestWithDetails(insertId);
      const result = { id: insertId, requestNumber: newReq?.requestNumber ?? `ID-${insertId}` };
      console.log(`[Integration] Solicita\xE7\xE3o criada via API Key "${keyData.name}": ${result.requestNumber}`);
      res.status(201).json({
        success: true,
        requestId: result.id,
        requestNumber: result.requestNumber,
        status: "aguardando_gerente"
      });
    } catch (err) {
      console.error("[Integration] Erro ao criar solicita\xE7\xE3o:", err);
      res.status(500).json({ error: err.message || "Erro interno ao criar solicita\xE7\xE3o." });
    }
  });
  app.get("/api/integration/requests/:requestNumber", async (req, res) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    const { requestNumber } = req.params;
    try {
      const allReqs = await getAllRequests();
      const request = allReqs.find((r) => r.requestNumber === requestNumber);
      if (!request) {
        res.status(404).json({ error: `Solicita\xE7\xE3o ${requestNumber} n\xE3o encontrada.` });
        return;
      }
      res.json({
        requestNumber: request.requestNumber,
        status: request.status,
        urgencyLevel: request.urgencyLevel,
        department: request.department,
        application: request.application,
        costCenterCode: request.costCenterCode,
        osMaintenance: request.osMyfarm,
        totalEstimatedValue: request.totalEstimatedValue,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      });
    } catch (err) {
      console.error("[Integration] Erro ao consultar solicita\xE7\xE3o:", err);
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });
  app.get("/api/integration/health", async (req, res) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    res.json({
      ok: true,
      keyName: keyData.name,
      permissions: keyData.permissions ? JSON.parse(keyData.permissions) : [],
      message: "Integra\xE7\xE3o CGS Compras funcionando corretamente."
    });
  });
  console.log("[Integration] Endpoints de integra\xE7\xE3o registrados em /api/integration/*");
}

// server/_core/index.ts
var __filename = fileURLToPath(import.meta.url);
var __currentDir = path.dirname(__filename);
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  registerWhatsAppWebhook(app);
  registerApiIntegration(app);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  const BUILD_ID = "2026-05-05_v5";
  app.get("/api/debug/fs", (_req, res) => {
    const webDistPath = path.resolve(__currentDir, "web");
    const indexPath = path.join(webDistPath, "index.html");
    import("fs").then((fs2) => {
      res.json({
        buildId: BUILD_ID,
        nodeEnv: process.env.NODE_ENV,
        cwd: process.cwd(),
        webDistPath,
        webDistExists: fs2.existsSync(webDistPath),
        indexHtmlExists: fs2.existsSync(indexPath)
      });
    });
  });
  app.post("/api/admin/daily-report", async (_req, res) => {
    console.log("[Admin] Manual daily report triggered via API");
    try {
      await runDailyReport();
      res.json({ ok: true, message: "Relatorio diario enviado com sucesso." });
    } catch (err) {
      console.error("[Admin] Daily report error:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  app.get("/privacidade", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "privacidade.html"));
  });
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    const webDistPath = path.resolve(__currentDir, "web");
    console.log(`[Server] Production mode: serving static files from ${webDistPath}`);
    app.use("/api/app", express.static(webDistPath, {
      maxAge: "1d",
      etag: true,
      index: false
      // Nao servir index.html automaticamente - controlamos isso abaixo
    }));
    const BASE_URL = "/api/app";
    const baseUrlScript = `<script>
  (function() {
    var base = '${BASE_URL}';
    var p = window.location.pathname;
    // Se o pathname comecar com /api/app, remover o prefixo para o Expo Router
    if (p === base || p.startsWith(base + '/')) {
      var newPath = p.slice(base.length) || '/';
      window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
    }
  })();
</script>`;
    const serveWebApp = (_req, res) => {
      const indexPath = path.join(webDistPath, "index.html");
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        html = html.replace("</head>", `${baseUrlScript}</head>`);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
      } catch (err) {
        console.error(`[Server] Failed to serve index.html: ${err}`);
        res.status(503).send("Frontend not built. Run: pnpm build:web");
      }
    };
    app.get("/api/app", serveWebApp);
    app.get("/api/app/*", (req, res, next) => {
      const hasExtension = path.extname(req.path).length > 0;
      if (hasExtension) return next();
      serveWebApp(req, res);
    });
    console.log(`[Server] Web app available at /api/app`);
  } else {
    const metroPort = parseInt(process.env.EXPO_PORT || "8081");
    const metroProxy = createProxyMiddleware({
      target: `http://127.0.0.1:${metroPort}`,
      changeOrigin: false,
      ws: true,
      on: {
        error: (_err, _req, res) => {
          if (res && "writeHead" in res) {
            res.status(502).json({ error: "Frontend not available" });
          }
        }
      }
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      return metroProxy(req, res, next);
    });
    server.on("upgrade", (req, socket, head) => {
      if (!req.url?.startsWith("/api/")) {
        metroProxy.upgrade(req, socket, head);
      }
    });
  }
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use((err, _req, res, _next) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    registerCronJobs();
  });
}
startServer().catch(console.error);
