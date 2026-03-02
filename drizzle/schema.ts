import {
  boolean,
  decimal,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
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
    "admin",
  ])
    .default("solicitante")
    .notNull(),
  department: varchar("department", { length: 128 }),
  phone: varchar("phone", { length: 32 }), // WhatsApp number
  jobTitle: varchar("jobTitle", { length: 128 }), // Cargo/título do usuário
  approvalLevel: mysqlEnum("approvalLevel", [
    "nenhum",
    "gerente",
    "controladoria",
    "orcamento",
    "diretoria",
    "financeiro",
    "master",
  ]).default("nenhum").notNull(),
  // Papéis e níveis adicionais (JSON array de strings, ex: '["gerente","orcamento"]')
  extraRoles: text("extraRoles"), // JSON array de ProcurementRole extras
  extraApprovalLevels: text("extraApprovalLevels"), // JSON array de ApprovalLevel extras
  pinHash: varchar("pinHash", { length: 255 }), // Hashed PIN for master quick access
  passwordHash: varchar("passwordHash", { length: 255 }), // Hashed password for email+password login
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Cost Centers ─────────────────────────────────────────────────────────────

export const costCenters = mysqlTable("costCenters", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  responsible: varchar("responsible", { length: 128 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CostCenter = typeof costCenters.$inferSelect;
export type InsertCostCenter = typeof costCenters.$inferInsert;

// ─── Assets / Bens ────────────────────────────────────────────────────────────

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  description: varchar("description", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }),
  location: varchar("location", { length: 128 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// ─── Purchase Requests ────────────────────────────────────────────────────────

export const purchaseRequests = mysqlTable("purchaseRequests", {
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
  urgencyLevel: mysqlEnum("urgencyLevel", ["normal", "urgente", "emergencial"])
    .default("normal")
    .notNull(),

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
    "cancelada",
  ])
    .default("aguardando_gerente")
    .notNull(),

  // Step-specific data
  budgetFileUrl: text("budgetFileUrl"),   // PDF orçamento
  purchaseOrderNumber: varchar("purchaseOrderNumber", { length: 64 }),
  paymentMethod: mysqlEnum("paymentMethod", ["pix", "boleto", "cartao_avista", "cartao_parcelado"]), // Método de pagamento selecionado pelo Compras
  paymentInfo: text("paymentInfo"),        // Dados de pagamento inseridos pelo Compras
  paymentProofUrl: text("paymentProofUrl"), // PDF comprovante de pagamento (Financeiro)
  paymentObservations: text("paymentObservations"), // Observações de pagamento (boleto/cartão)
  invoiceUrl: text("invoiceUrl"),           // PDF nota fiscal (Compras na verificação final)
  ocSiagriUrl: text("ocSiagriUrl"),          // PDF OC Siagri (Compras na emissão de OC)

  // OS Myfarm
  osMyfarm: varchar("osMyfarm", { length: 64 }), // Número da OS Myfarm vinculada

  // Urgente/Emergencial: controle de retorno ao orçamento
  orcamentoFeitoUrgente: boolean("orcamentoFeitoUrgente").default(false).notNull(), // true após o orçamento ser feito pela primeira vez em pedidos urgentes/emergenciais

  // Malotes integration
  isEnabledInMalotes: boolean("isEnabledInMalotes").default(false).notNull(), // Habilitado nos Malotes após OC finalizada

  // Deadline tracking
  deadlineAt: timestamp("deadlineAt"),                     // Overall deadline based on urgency
  stepDeadlineAt: timestamp("stepDeadlineAt"),             // 48h deadline for current approver
  cancellationDeadlineAt: timestamp("cancellationDeadlineAt"), // 10-day deadline before auto-cancel (set on rejection/expiry)
  cancellationWarningSentAt: timestamp("cancellationWarningSentAt"), // When the 1-day warning was sent (prevents duplicates)

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = typeof purchaseRequests.$inferInsert;

// ─── Request Items ────────────────────────────────────────────────────────────

export const requestItems = mysqlTable("requestItems", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 32 }).default("un").notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 2 }),
  totalPrice: decimal("totalPrice", { precision: 14, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RequestItem = typeof requestItems.$inferSelect;
export type InsertRequestItem = typeof requestItems.$inferInsert;

// ─── Approval History ─────────────────────────────────────────────────────────

export const approvalHistory = mysqlTable("approvalHistory", {
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
  ]).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalHistory = typeof approvalHistory.$inferSelect;
export type InsertApprovalHistory = typeof approvalHistory.$inferInsert;

// ─── WhatsApp Sessions ────────────────────────────────────────────────────────

export const whatsappSessions = mysqlTable("whatsappSessions", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  requestId: int("requestId").notNull(),
  requestNumber: varchar("requestNumber", { length: 32 }).notNull(),
  approverPhone: varchar("approverPhone", { length: 32 }).notNull(),
  approverId: int("approverId").notNull(),
  approverName: varchar("approverName", { length: 128 }),
  step: varchar("step", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"])
    .default("pending")
    .notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappSession = typeof whatsappSessions.$inferSelect;
export type InsertWhatsappSession = typeof whatsappSessions.$inferInsert;

// ─── Malotes ──────────────────────────────────────────────────────────────────

export const malotes = mysqlTable("malotes", {
  id: int("id").autoincrement().primaryKey(),
  maloteCode: varchar("maloteCode", { length: 20 }).notNull().unique(),
  status: mysqlEnum("status", ["aberto", "enviado", "recebido", "devolvido"])
    .default("aberto")
    .notNull(),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Malote = typeof malotes.$inferSelect;
export type InsertMalote = typeof malotes.$inferInsert;

// ─── Malote Items ─────────────────────────────────────────────────────────────

export const maloteItems = mysqlTable("maloteItems", {
  id: int("id").autoincrement().primaryKey(),
  maloteId: int("maloteId").notNull(),
  requestId: int("requestId").notNull(),
  requestCode: varchar("requestCode", { length: 20 }).notNull(),
  requesterName: varchar("requesterName", { length: 255 }).notNull(),
  application: varchar("application", { length: 255 }).notNull(),
  addedById: int("addedById").notNull(),
  addedByName: varchar("addedByName", { length: 255 }).notNull(),
  receiptStatus: mysqlEnum("receiptStatus", ["pendente", "recebido", "devolvido"])
    .default("pendente")
    .notNull(),
  receiptNotes: text("receiptNotes"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type MaloteItem = typeof maloteItems.$inferSelect;
export type InsertMaloteItem = typeof maloteItems.$inferInsert;

// ─── Units / Unidades ─────────────────────────────────────────────────────────
export const units = mysqlTable("units", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;
// ─── Business Units / Unidades ──────────────────────────────────────────────
export const businessUnits = mysqlTable("businessUnits", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BusinessUnit = typeof businessUnits.$inferSelect;
export type InsertBusinessUnit = typeof businessUnits.$inferInsert;

// ─── Departments / Departamentos ────────────────────────────────────────────
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  responsible: varchar("responsible", { length: 128 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// ─── Malote Tags ──────────────────────────────────────────────────────────────
export const maloteTags = mysqlTable("maloteTags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#6B7280"),
  icon: varchar("icon", { length: 8 }).notNull().default("🏷️"),
  category: mysqlEnum("category", ["prioridade", "tipo", "custom"]).notNull().default("custom"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MaloteTag = typeof maloteTags.$inferSelect;
export type InsertMaloteTag = typeof maloteTags.$inferInsert;

// ─── Malote Tag Links ─────────────────────────────────────────────────────────
export const maloteTagLinks = mysqlTable("maloteTagLinks", {
  id: int("id").autoincrement().primaryKey(),
  maloteId: int("maloteId").notNull(),
  tagId: int("tagId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MaloteTagLink = typeof maloteTagLinks.$inferSelect;
export type InsertMaloteTagLink = typeof maloteTagLinks.$inferInsert;
