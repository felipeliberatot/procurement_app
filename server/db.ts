import {
  and, desc, eq, gte, inArray, or, sql
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvalHistory,
  assets,
  businessUnits,
  costCenters,
  departments,
  InsertUser,
  maloteItems,
  maloteTagLinks,
  maloteTags,
  malotes,
  purchaseRequests,
  requestItems,
  units,
  users,
  type BusinessUnit,
  type Department,
  type Malote,
  type MaloteItem,
  type MaloteTag,
  type Unit,
  type User,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as WA from "./whatsapp";

const STEP_LABELS_SERVER: Record<string, string> = {
  aguardando_gerente: "Gerente de Unidade",
  aguardando_orcamento: "Orçamento",
  aguardando_controladoria: "Controladoria",
  aguardando_diretoria: "Diretoria",
  aguardando_ordem_compra: "Ordem de Compra",
  aguardando_financeiro: "Financeiro",
  concluida: "Concluída",
};

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Core Auth ────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

/**
 * Links a pre-registered user (created manually) to an OAuth login by matching email.
 * If a user with the same email exists but a different openId, updates the openId to the OAuth one.
 * Returns true if a link was performed, false otherwise.
 */
export async function linkUserByEmail(oauthOpenId: string, email: string): Promise<boolean> {
  const db = await getDb();
  if (!db || !email) return false;

  // Find existing user with this email but different openId
  const existing = await getUserByEmail(email);
  if (!existing || existing.openId === oauthOpenId) return false;

  // Update the openId to the OAuth one, preserving all other data
  console.log(`[Auth] Linking pre-registered user '${existing.name}' (${email}) to OAuth openId: ${oauthOpenId}`);
  await db.update(users)
    .set({ openId: oauthOpenId, updatedAt: new Date() })
    .where(eq(users.id, existing.id));

  return true;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateUserProfile(
  userId: number,
  data: { procurementRole?: string; department?: string; phone?: string; jobTitle?: string; approvalLevel?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update: Record<string, unknown> = {};
  if (data.procurementRole) update.procurementRole = data.procurementRole;
  if (data.department !== undefined) update.department = data.department;
  if (data.phone !== undefined) update.phone = data.phone;
  if (data.jobTitle !== undefined) update.jobTitle = data.jobTitle;
  if (data.approvalLevel !== undefined) update.approvalLevel = data.approvalLevel;
  await db.update(users).set(update).where(eq(users.id, userId));
}

export async function getUserByEmailForLogin(email: string) {
  const db = await getDb();
  if (!db) return null;
  // Get all users with this email (there may be duplicates from import)
  const result = await db.select().from(users).where(eq(users.email, email));
  if (result.length === 0) return null;
  // Prefer the user with a password hash set
  const withPassword = result.find((u) => u.passwordHash);
  return withPassword ?? result[0];
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function upsertUserByAdmin(data: {
  id?: number;
  name: string;
  email?: string;
  procurementRole: string;
  department?: string;
  phone?: string;
  jobTitle?: string;
  approvalLevel?: string;
  active?: boolean;
  passwordHash?: string;
  password?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Hash password if provided as plain text
  let finalPasswordHash = data.passwordHash;
  if (data.password) {
    const bcrypt = await import("bcryptjs");
    finalPasswordHash = await bcrypt.hash(data.password, 10);
  }
  // Check for duplicate email
  if (data.email && data.email.trim() !== "") {
    const emailConflict = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.trim()))
      .limit(1);
    if (emailConflict.length > 0 && emailConflict[0].id !== data.id) {
      throw new Error("Este e-mail já está sendo usado por outro cadastro.");
    }
  }

  if (data.id) {
    // UPDATE existing user
    await db.update(users).set({
      name: data.name,
      email: data.email ?? null,
      procurementRole: data.procurementRole as User["procurementRole"],
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: (data.approvalLevel ?? "nenhum") as User["approvalLevel"],
      active: data.active ?? true,
      ...(finalPasswordHash !== undefined ? { passwordHash: finalPasswordHash } : {}),
    }).where(eq(users.id, data.id));
    return { id: data.id };
  } else {
    // INSERT new user (pre-registered, no OAuth yet)
    // Use email as unique key if provided; generate a placeholder openId
    const openId = `admin_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const result = await db.insert(users).values({
      openId,
      name: data.name,
      email: data.email || null,
      procurementRole: data.procurementRole as User["procurementRole"],
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: (data.approvalLevel ?? "nenhum") as User["approvalLevel"],
      active: data.active ?? true,
      lastSignedIn: new Date(),
      ...(finalPasswordHash !== undefined ? { passwordHash: finalPasswordHash } : {}),
    });
    const insertId = (result as any)[0]?.insertId ?? 0;
    return { id: insertId };
  }
}

export async function importUsersBatch(rows: Array<{
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  procurementRole: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  let errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Use email as unique key for upsert; if no email, always insert
      if (row.email) {
        const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email)).limit(1);
        if (existing.length > 0) {
          await db.update(users).set({
            name: row.name,
            phone: row.phone ?? null,
            department: row.department ?? null,
            procurementRole: row.procurementRole as User["procurementRole"],
          }).where(eq(users.email, row.email));
        } else {
          await db.insert(users).values({
            openId: `import_${Date.now()}_${i}`,
            name: row.name,
            email: row.email,
            phone: row.phone ?? null,
            department: row.department ?? null,
            procurementRole: row.procurementRole as User["procurementRole"],
            active: true,
            lastSignedIn: new Date(),
          });
        }
      } else {
        await db.insert(users).values({
          openId: `import_${Date.now()}_${i}`,
          name: row.name,
          phone: row.phone ?? null,
          department: row.department ?? null,
          procurementRole: row.procurementRole as User["procurementRole"],
          active: true,
          lastSignedIn: new Date(),
        });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

export async function toggleUserActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ active }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Soft delete: desativar o usuário em vez de remover do banco
  await db.update(users).set({ active: false }).where(eq(users.id, id));
}

// ─── Cost Centers ─────────────────────────────────────────────────────────────

export async function listCostCenters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(costCenters).where(eq(costCenters.active, true)).orderBy(costCenters.code);
}

export async function createCostCenter(data: { code: string; name: string; responsible?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(costCenters).values({
    code: data.code,
    name: data.name,
    responsible: data.responsible ?? null,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}
export async function updateCostCenter(id: number, data: Partial<{ code: string; name: string; responsible: string; active: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set(data).where(eq(costCenters.id, id));
}

export async function deleteCostCenter(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set({ active: false }).where(eq(costCenters.id, id));
}

export async function importCostCentersBatch(rows: Array<{
  code: string;
  name: string;
  responsible?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: costCenters.id }).from(costCenters).where(eq(costCenters.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(costCenters).set({ name: row.name, responsible: row.responsible ?? null }).where(eq(costCenters.code, row.code));
      } else {
        await db.insert(costCenters).values({ code: row.code, name: row.name, responsible: row.responsible ?? null });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export async function listAssets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets).where(eq(assets.active, true)).orderBy(assets.code);
}

export async function createAsset(data: { code: string; description: string; category?: string; location?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(assets).values({
    code: data.code,
    description: data.description,
    category: data.category ?? null,
    location: data.location ?? null,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}
export async function updateAsset(id: number, data: Partial<{ code: string; description: string; category: string; location: string; active: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets).set(data).where(eq(assets.id, id));
}

export async function deleteAsset(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(assets).set({ active: false }).where(eq(assets.id, id));
}

export async function importAssetsBatch(rows: Array<{
  code: string; description: string; category?: string; location?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: assets.id }).from(assets).where(eq(assets.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(assets).set({ description: row.description, category: row.category ?? null, location: row.location ?? null }).where(eq(assets.code, row.code));
      } else {
        await db.insert(assets).values({ code: row.code, description: row.description, category: row.category ?? null, location: row.location ?? null });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

// ─── Purchase Requests ────────────────────────────────────────────────────────

async function generateRequestNumber(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  // Count existing requests this year to generate sequential code
  const startOfYear = new Date(year, 0, 1);
  const [{ count }] = await db!.select({ count: sql<number>`COUNT(*)` }).from(purchaseRequests).where(gte(purchaseRequests.createdAt, startOfYear));
  const seq = String((Number(count) + 1)).padStart(4, "0");
  return `SOL-${year}-${seq}`;
}

function getDeadlineDate(urgencyLevel: string): Date {
  const days = urgencyLevel === "emergencial" ? 1 : urgencyLevel === "urgente" ? 3 : 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function getStepDeadline(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 48);
  return date;
}

export async function createPurchaseRequest(
  user: User,
  input: {
    department: string;
    costCenterId?: number;
    costCenterCode?: string;
    application: string;
    urgencyLevel: "normal" | "urgente" | "emergencial";
    observations?: string;
    items: Array<{ description: string; quantity: string; unit: string; unitPrice?: string }>;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const requestNumber = await generateRequestNumber(db);
  const deadlineAt = getDeadlineDate(input.urgencyLevel);
  const stepDeadlineAt = getStepDeadline();

  // Calculate total
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }

  const result = await db.insert(purchaseRequests).values({
    requestNumber,
    requesterId: user.id,
    requesterName: user.name ?? "Usuário",
    department: input.department,
    costCenterId: input.costCenterId ?? null,
    costCenterCode: input.costCenterCode ?? null,
    application: input.application,
    urgencyLevel: input.urgencyLevel,
    observations: input.observations ?? null,
    totalEstimatedValue: total > 0 ? String(total) : null,
    // Urgentes e emergenciais vão direto para aprovação da Diretoria
    status: (input.urgencyLevel === "urgente" || input.urgencyLevel === "emergencial") ? "aguardando_diretoria" : "aguardando_gerente",
    deadlineAt,
    stepDeadlineAt,
  });

  const insertId = (result as unknown as [{ insertId: number }])[0].insertId;

  // Insert items
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId: insertId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null,
    });
  }

  // Log history
  await db.insert(approvalHistory).values({
    requestId: insertId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: "criacao",
    action: "criada",
    comment: `Solicitação criada. Prazo: ${deadlineAt.toLocaleDateString("pt-BR")}`,
  });

  // Notify approvers via WhatsApp
  try {
    const isUrgent = input.urgencyLevel === "urgente" || input.urgencyLevel === "emergencial";
    // Urgentes/emergenciais vão direto para Diretoria; normais vão para Gerente
    const approverRole = isUrgent ? "diretoria" : "gerente";
    const stepLabel = isUrgent ? "Diretoria" : "Gerente de Unidade";
    const approvers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.active, true),
        or(
          eq(users.procurementRole, approverRole as any),
          eq(users.approvalLevel, approverRole as any),
        ),
      ));
    // Deduplicar por id (um usuário pode ter role E approvalLevel iguais)
    const uniqueApprovers = [...new Map(approvers.map(a => [a.id, a])).values()];
    console.log(`[WhatsApp] Nova solicitação: notificando aprovadores "${approverRole}": ${uniqueApprovers.length} encontrado(s)`);
    for (const approver of uniqueApprovers) {
      const phoneRaw = approver.phone;
      console.log(`[WhatsApp] Aprovador: ${approver.name} | phone raw: ${phoneRaw}`);
      if (phoneRaw) {
        await WA.notifyNewRequest({
          approverPhone: phoneRaw,
          approverName: approver.name ?? "Aprovador",
          requestNumber,
          requestId: insertId,
          requesterName: user.name ?? "Usuário",
          application: input.application,
          urgencyLevel: input.urgencyLevel,
          department: input.department,
          stepLabel,
        });
      } else {
        console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) não tem telefone cadastrado.`);
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to notify approvers:", e);
  }

  return insertId;
}

export async function getPurchaseRequestWithDetails(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
  if (!request) return null;

  const items = await db.select().from(requestItems).where(eq(requestItems.requestId, id));
  const history = await db.select().from(approvalHistory).where(eq(approvalHistory.requestId, id)).orderBy(approvalHistory.createdAt);

  return { ...request, items, history };
}

export async function getRequestsByRequester(requesterId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseRequests).where(eq(purchaseRequests.requesterId, requesterId)).orderBy(desc(purchaseRequests.createdAt));
}

export async function getPendingRequestsForUser(role: string) {
  const db = await getDb();
  if (!db) return [];

  // Role orcamento responde por 3 etapas: orçamento, emissão de OC e verificação final
  if (role === "orcamento") {
    return db.select().from(purchaseRequests)
      .where(inArray(purchaseRequests.status, ["aguardando_orcamento", "aguardando_ordem_compra", "aguardando_verificacao_compras"] as any[]))
      .orderBy(purchaseRequests.urgencyLevel, purchaseRequests.deadlineAt);
  }

  const singleStatusMap: Record<string, string> = {
    gerente: "aguardando_gerente",
    controladoria: "aguardando_controladoria",
    diretoria: "aguardando_diretoria",
    financeiro: "aguardando_comprovante_pagamento",
  };

  const status = singleStatusMap[role];
  if (!status) return [];

  return db.select().from(purchaseRequests)
    .where(eq(purchaseRequests.status, status as any))
    .orderBy(purchaseRequests.urgencyLevel, purchaseRequests.deadlineAt);
}

export async function getAllRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
}

export async function getDashboardStats(userId: number, role: string) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0, emergency: 0 };

  const all = role === "solicitante"
    ? await db.select().from(purchaseRequests).where(eq(purchaseRequests.requesterId, userId))
    : await db.select().from(purchaseRequests);

  const pending = all.filter(r => r.status.startsWith("aguardando")).length;
  const approved = all.filter(r => r.status === "concluida").length;
  // Separar rejeitadas e canceladas corretamente
  const rejected = all.filter(r => r.status === "rejeitada").length;
  const cancelled = all.filter(r => r.status === "cancelada").length;
  const urgent = all.filter(r => r.urgencyLevel === "urgente" && r.status.startsWith("aguardando")).length;
  const emergency = all.filter(r => r.urgencyLevel === "emergencial" && r.status.startsWith("aguardando")).length;
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiringSoon = all.filter(r =>
    r.status.startsWith("aguardando") &&
    r.deadlineAt != null &&
    r.deadlineAt > now &&
    r.deadlineAt <= in24h
  ).length;
  return { total: all.length, pending, approved, rejected, cancelled, urgent, emergency, expiringSoon };
}

export async function getApprovalHistory(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(approvalHistory).where(eq(approvalHistory.requestId, requestId)).orderBy(approvalHistory.createdAt);
}

export async function attachBudget(requestId: number, userId: number, userName: string, fileUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(purchaseRequests).set({
    budgetFileUrl: fileUrl,
    status: "aguardando_controladoria",
    stepDeadlineAt: getStepDeadline(),
  }).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId,
    userName,
    step: "orcamento",
    action: "orcamento_anexado",
    comment: "Orçamento em PDF anexado",
  });
}

// ─── Approvals ────────────────────────────────────────────────────────────────

const STEP_FLOW: Record<string, { step: string; nextStatus: string; action: string }> = {
  aguardando_gerente:              { step: "gerente",           nextStatus: "aguardando_orcamento",              action: "aprovada" },
  aguardando_orcamento:            { step: "orcamento",         nextStatus: "aguardando_controladoria",          action: "aprovada" },
  aguardando_controladoria:        { step: "controladoria",     nextStatus: "aguardando_diretoria",              action: "aprovada" },
  aguardando_diretoria:            { step: "diretoria",         nextStatus: "aguardando_ordem_compra",           action: "aprovada" },
  // Fluxo 06: Compras emite OC e define método de pagamento → vai para Aprovação de Compra (Financeiro)
  aguardando_ordem_compra:         { step: "ordem_compra",      nextStatus: "aguardando_aprovacao_compra",       action: "ordem_emitida" },
  // Fluxo 06b: Financeiro aprova a compra → vai para Comprovante de Pagamento
  aguardando_aprovacao_compra:     { step: "aprovacao_compra",  nextStatus: "aguardando_comprovante_pagamento",  action: "compra_aprovada" },
  aguardando_comprovante_pagamento:{ step: "financeiro",        nextStatus: "aguardando_verificacao_compras",   action: "comprovante_aprovado" },
  // Reenvio pelo solicitante após rejeição → reinicia o fluxo a partir do gerente
  rejeitada:                       { step: "gerente",           nextStatus: "aguardando_gerente",                action: "reaberta" },
};

const REJECT_FLOW: Record<string, string> = {
  aguardando_gerente:              "aguardando_gerente",
  aguardando_orcamento:            "aguardando_orcamento",
  aguardando_controladoria:        "aguardando_orcamento",
  aguardando_diretoria:            "aguardando_controladoria",
  aguardando_ordem_compra:         "aguardando_diretoria",
  // Fluxo 06b: Financeiro recusa a compra → volta para o Compras (aguardando_ordem_compra)
  aguardando_aprovacao_compra:     "aguardando_ordem_compra",
  // Fluxo 07: Financeiro recusa comprovante → volta para o solicitante (rejeitada)
  aguardando_comprovante_pagamento:"rejeitada",
};

export async function approveRequest(
  requestId: number,
  user: User,
  data: { comment?: string; purchaseOrderNumber?: string; paymentInfo?: string; paymentMethod?: string; paymentObservations?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");

  const flow = STEP_FLOW[request.status];
  if (!flow) throw new Error("Ação não permitida neste status");

  // Fluxo especial: pedidos urgentes/emergenciais vão direto para diretoria.
  // Quando a diretoria aprova, o fluxo retoma a partir do orçamento (não vai direto para OC).
  const isUrgentOrEmergency = request.urgencyLevel === "urgente" || request.urgencyLevel === "emergencial";
  const effectiveNextStatus =
    (request.status === "aguardando_diretoria" && isUrgentOrEmergency)
      ? "aguardando_orcamento"   // diretoria aprovou pedido urgente/emergencial → segue para orçamento
      : flow.nextStatus;

  const updateData: Record<string, unknown> = {
    status: effectiveNextStatus,
    stepDeadlineAt: getStepDeadline(),
  };
  if (data.purchaseOrderNumber) updateData.purchaseOrderNumber = data.purchaseOrderNumber;
  if (data.paymentInfo) updateData.paymentInfo = data.paymentInfo;
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
  if (data.paymentObservations) updateData.paymentObservations = data.paymentObservations;

  await db.update(purchaseRequests).set(updateData).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: flow.step as any,
    action: flow.action as any,
    comment: data.comment ?? null,
  });

  // WhatsApp notifications
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
    const [requester] = req ? await db.select().from(users).where(eq(users.id, req.requesterId)).limit(1) : [];
    const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
    const itemsForMsg = items.map(it => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));

    // ── Mapa: próximo status → papel do aprovador que deve ser notificado ──────
    const nextRoleMap: Record<string, string> = {
      aguardando_gerente:              "gerente",
      aguardando_orcamento:            "orcamento",
      aguardando_controladoria:        "controladoria",
      aguardando_diretoria:            "diretoria",
      aguardando_ordem_compra:         "orcamento",          // Fluxo 06: OC → Orçamento
      aguardando_aprovacao_compra:     "financeiro",         // Fluxo 06b: Aprovação de Compra → Financeiro
      aguardando_comprovante_pagamento:"financeiro",         // Fluxo 07: Comprovante → Financeiro
      aguardando_verificacao_compras:  "orcamento",          // Fluxo 08: Verificação Final → Orçamento
    };

    if (effectiveNextStatus === "aguardando_orcamento" && (request.status === "aguardando_gerente" || (request.status === "aguardando_diretoria" && isUrgentOrEmergency))) {
      // Gerente aprovou OU diretoria aprovou pedido urgente/emergencial → notificar solicitante para anexar orçamento
      if (requester?.phone) {
        await WA.notifyBudgetRequired({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
        });
      }
    } else if (effectiveNextStatus === "concluida") {
      // Etapa final concluída → notificar solicitante
      if (requester?.phone) {
        await WA.notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Aprovador",
          stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
        });
      }
    } else {
      // Notificar solicitante do progresso
      if (requester?.phone) {
        await WA.notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Aprovador",
          stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
          nextStepLabel: STEP_LABELS_SERVER[flow.nextStatus],
        });
      }
    }

    // ── Notificar o(s) aprovador(es) da próxima etapa ─────────────────────────
    const nextRole = nextRoleMap[flow.nextStatus];
    if (nextRole && req) {
      // Buscar aprovadores ativos com o papel correto (procurementRole OU approvalLevel)
      const nextApproversRaw = await db
        .select()
        .from(users)
        .where(and(
          eq(users.active, true),
          or(
            eq(users.procurementRole, nextRole as any),
            eq(users.approvalLevel, nextRole as any),
          ),
        ));
      // Deduplicar por id
      const nextApprovers = [...new Map(nextApproversRaw.map(a => [a.id, a])).values()];
      console.log(`[WhatsApp] Notificando aprovadores para etapa "${nextRole}": ${nextApprovers.length} encontrado(s)`);
      for (const approver of nextApprovers) {
        const phoneRaw = approver.phone;
        console.log(`[WhatsApp] Aprovador: ${approver.name} | phone raw: ${phoneRaw}`);
        if (phoneRaw) {
          await WA.notifyApproverWithToken({
            approverPhone: phoneRaw,  // normalizePhone é chamado dentro de sendWhatsAppMessage
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
            totalValue: req.totalEstimatedValue ?? undefined,
          });
        } else {
          console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) não tem telefone cadastrado.`);
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send notifications:", e);
  }
}

export async function rejectRequest(requestId: number, user: User, comment: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");

  const flow = STEP_FLOW[request.status];
  const prevStatus = REJECT_FLOW[request.status] ?? "aguardando_gerente";

  await db.update(purchaseRequests).set({
    status: prevStatus as any,
    stepDeadlineAt: getStepDeadline(),
  }).where(eq(purchaseRequests.id, requestId));

  // Determinar a action correta com base no status atual
  const rejectActionMap: Record<string, string> = {
    aguardando_comprovante_pagamento: "comprovante_recusado",
  };
  const rejectAction = rejectActionMap[request.status] ?? "rejeitada";

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: (flow?.step ?? "gerente") as any,
    action: rejectAction as any,
    comment,
  });

  // Notify requester and/or previous approver via WhatsApp
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq(users.id, req.requesterId)).limit(1);
      const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
      const itemsForMsg = items.map(it => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));

      if (request.status === "aguardando_comprovante_pagamento") {
        // Financeiro recusou comprovante → notificar solicitante que precisa corrigir
        if (requester?.phone) {
          await WA.notifyRejection({
            requesterPhone: requester.phone,
            requesterName: requester.name ?? "Solicitante",
            requestNumber: req.requestNumber,
            requestId,
            rejectorName: user.name ?? "Financeiro",
            stepLabel: "Comprovante de Pagamento",
            comment,
          });
        }
      } else {
        // Rejeição normal → notificar solicitante
        if (requester?.phone) {
          await WA.notifyRejection({
            requesterPhone: requester.phone,
            requesterName: requester.name ?? "Solicitante",
            requestNumber: req.requestNumber,
            requestId,
            rejectorName: user.name ?? "Aprovador",
            stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
            comment,
          });
        }

        // Também notificar o aprovador da etapa anterior (para onde voltou)
        const prevRoleMap: Record<string, string> = {
          aguardando_orcamento:     "orcamento",
          aguardando_controladoria: "controladoria",
          aguardando_diretoria:     "diretoria",
        };
        const prevRole = prevRoleMap[prevStatus];
        if (prevRole && req) {
          const prevApproversRaw = await db
            .select()
            .from(users)
            .where(and(
              eq(users.active, true),
              or(
                eq(users.procurementRole, prevRole as any),
                eq(users.approvalLevel, prevRole as any),
              ),
            ));
          const prevApprovers = [...new Map(prevApproversRaw.map(a => [a.id, a])).values()];
          console.log(`[WhatsApp] Notificando aprovadores (rejeição) para etapa "${prevRole}": ${prevApprovers.length} encontrado(s)`);
          for (const approver of prevApprovers) {
            const phoneRaw = approver.phone;
            console.log(`[WhatsApp] Aprovador (rejeição): ${approver.name} | phone raw: ${phoneRaw}`);
            if (phoneRaw) {
              await WA.notifyApproverWithToken({
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
                totalValue: req.totalEstimatedValue ?? undefined,
              });
            } else {
              console.warn(`[WhatsApp] Aprovador ${approver.name} (id=${approver.id}) não tem telefone cadastrado.`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send rejection notification:", e);
  }
}

// ─── Novas etapas do fluxo: Comprovante de Pagamento e Verificação Final ─────────

export async function attachPaymentProof(requestId: number, fileUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ paymentProofUrl: fileUrl }).where(eq(purchaseRequests.id, requestId));
}

export async function attachInvoice(requestId: number, fileUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ invoiceUrl: fileUrl }).where(eq(purchaseRequests.id, requestId));
}

export async function attachOCSiagri(requestId: number, fileUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(purchaseRequests).set({ ocSiagriUrl: fileUrl }).where(eq(purchaseRequests.id, requestId));
}

export async function finalizeOC(requestId: number, user: User): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");
  if (request.status !== "aguardando_verificacao_compras") throw new Error("Status inválido para finalizar OC");

  // Marcar como concluída e habilitar nos Malotes
  await db.update(purchaseRequests).set({
    status: "concluida" as any,
    isEnabledInMalotes: true,
    stepDeadlineAt: null,
  }).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: "verificacao_compras" as any,
    action: "oc_finalizada" as any,
    comment: "Ordem de Compra finalizada. Nota fiscal verificada.",
  });

  // Notificar solicitante
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq(users.id, req.requesterId)).limit(1);
      if (requester?.phone) {
        await WA.notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Compras",
          stepLabel: "Verificação Final",
        });
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send finalization notification:", e);
  }
}

// ─── Cancel Request ─────────────────────────────────────────────────────────

/**
 * Cancela uma solicitação.
 * Somente o solicitante que abriu (requesterId) ou um usuário master pode cancelar.
 * Solicitações já concluídas ou canceladas não podem ser canceladas.
 */
export async function cancelRequest(
  requestId: number,
  user: User,
  reason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");

  const isMaster = (user as any).approvalLevel === "master";
  const isOwner = request.requesterId === user.id;

  if (!isMaster && !isOwner) {
    throw new Error("Apenas o solicitante ou um usuário master pode cancelar esta solicitação.");
  }

  if (request.status === "cancelada") {
    throw new Error("Esta solicitação já foi cancelada.");
  }
  if (request.status === "concluida") {
    throw new Error("Solicitações concluídas não podem ser canceladas.");
  }

  await db.update(purchaseRequests).set({
    status: "cancelada" as any,
    stepDeadlineAt: null,
  }).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: "cancelamento" as any,
    action: "cancelada" as any,
    comment: reason ?? "Solicitação cancelada pelo solicitante.",
  });

  // Notificar solicitante se for o master cancelando
  if (isMaster && !isOwner) {
    try {
      const [requester] = await db.select().from(users).where(eq(users.id, request.requesterId)).limit(1);
      if (requester?.phone) {
        await WA.notifyRejection({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: request.requestNumber,
          requestId,
          rejectorName: user.name ?? "Master",
          stepLabel: "Cancelamento",
          comment: reason ?? "Solicitação cancelada pelo administrador.",
        });
      }
    } catch (e) {
      console.warn("[WhatsApp] Failed to send cancellation notification:", e);
    }
  }
}

// ─── Master PIN ───────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";

/**
 * Verifies the master PIN for a given user ID.
 * Returns true if the PIN matches the stored hash.
 */
export async function verifyMasterPin(userId: number, pin: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [user] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.pinHash) return false;
  return bcrypt.compare(pin, user.pinHash);
}

/**
 * Updates the master PIN for a given user ID.
 * Hashes the new PIN with bcrypt before storing.
 */
export async function updateMasterPin(userId: number, newPin: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const hash = await bcrypt.hash(newPin, 12);
  await db.update(users).set({ pinHash: hash }).where(eq(users.id, userId));
}

// ─── Malotes ──────────────────────────────────────────────────────────────────

/** Gera código único de malote: MAL-AAAA-NNNN */
async function generateMaloteCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const year = new Date().getFullYear();
  const prefix = `MAL-${year}-`;
  const [row] = await db
    .select({ maloteCode: malotes.maloteCode })
    .from(malotes)
    .where(sql`maloteCode LIKE ${prefix + "%"}`)
    .orderBy(desc(malotes.id))
    .limit(1);
  let next = 1;
  if (row) {
    const parts = row.maloteCode.split("-");
    next = parseInt(parts[parts.length - 1] ?? "0", 10) + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function createMalote(opts: {
  originUnit: string;
  destinationUnit: string;
  createdById: number;
  createdByName: string;
  notes?: string | null;
}): Promise<Malote> {
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
    notes: opts.notes ?? null,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const [malote] = await db.select().from(malotes).where(eq(malotes.id, insertId)).limit(1);
  return malote;
}

export async function listMalotes(): Promise<Malote[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(malotes).orderBy(desc(malotes.createdAt));
}

export async function getMaloteWithItems(maloteId: number): Promise<{ malote: Malote; items: MaloteItem[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const [malote] = await db.select().from(malotes).where(eq(malotes.id, maloteId)).limit(1);
  if (!malote) return null;
  const items = await db.select().from(maloteItems).where(eq(maloteItems.maloteId, maloteId));
  return { malote, items };
}

export async function addRequestToMalote(opts: {
  maloteId: number;
  requestId: number;
  requestCode: string;
  requesterName: string;
  application: string;
  addedById: number;
  addedByName: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(maloteItems)
    .where(eq(maloteItems.requestId, opts.requestId))
    .limit(1);
  if (existing.length > 0) throw new Error("Solicitação já está em um malote.");
  await db.insert(maloteItems).values({
    maloteId: opts.maloteId,
    requestId: opts.requestId,
    requestCode: opts.requestCode,
    requesterName: opts.requesterName,
    application: opts.application,
    addedById: opts.addedById,
    addedByName: opts.addedByName,
    receiptStatus: "pendente",
  });
}

export async function removeRequestFromMalote(maloteItemId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(maloteItems).where(eq(maloteItems.id, maloteItemId));
}

export async function sendMalote(opts: {
  maloteId: number;
  sentById: number;
  sentByName: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Buscar dados do malote antes de atualizar
  const [malote] = await db.select().from(malotes).where(eq(malotes.id, opts.maloteId)).limit(1);
  await db.update(malotes).set({
    status: "enviado",
    sentAt: new Date(),
    sentById: opts.sentById,
    sentByName: opts.sentByName,
  }).where(eq(malotes.id, opts.maloteId));
  // Notificar responsável da unidade de destino via WhatsApp
  if (malote) {
    try {
      const [destUnit] = await db.select().from(units).where(eq(units.name, malote.destinationUnit)).limit(1);
      if (destUnit?.responsiblePhone) {
        const msg = `📦 *Malote ${malote.maloteCode} enviado!*\n\nOrigem: ${malote.originUnit}\nDestino: ${malote.destinationUnit}\nEnviado por: ${opts.sentByName}\n\nO malote está a caminho. Confirme o recebimento no app CGS quando chegar.`;
        await WA.sendSimpleWhatsApp(destUnit.responsiblePhone, msg);
      }
    } catch (_) { /* silently ignore WhatsApp errors */ }
  }
}

export async function receiveMalote(opts: {
  maloteId: number;
  receivedById: number;
  receivedByName: string;
  receiptNotes: string;
  signatureData?: string;
  itemReceipts: Array<{ itemId: number; receiptStatus: "recebido" | "devolvido"; receiptNotes?: string }>;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const item of opts.itemReceipts) {
    await db.update(maloteItems).set({
      receiptStatus: item.receiptStatus,
      receiptNotes: item.receiptNotes ?? null,
    }).where(eq(maloteItems.id, item.itemId));

    if (item.receiptStatus === "devolvido") {
      const [mi] = await db.select().from(maloteItems).where(eq(maloteItems.id, item.itemId)).limit(1);
      if (mi) {
        await db.update(purchaseRequests).set({
          status: "aguardando_gerente",
          stepDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        }).where(eq(purchaseRequests.id, mi.requestId));
        await db.insert(approvalHistory).values({
          requestId: mi.requestId,
          userId: opts.receivedById,
          userName: opts.receivedByName,
          step: "gerente" as any,
          action: "reaberta" as any,
          comment: `Item devolvido no malote. Motivo: ${item.receiptNotes ?? "não informado"}`,
        });
      }
    }
  }

  const hasReturn = opts.itemReceipts.some(i => i.receiptStatus === "devolvido");
  const finalStatus = hasReturn ? "devolvido" : "recebido";
  // Buscar dados do malote antes de atualizar
  const [maloteForNotif] = await db.select().from(malotes).where(eq(malotes.id, opts.maloteId)).limit(1);
  await db.update(malotes).set({
    status: finalStatus,
    receivedAt: new Date(),
    receivedById: opts.receivedById,
    receivedByName: opts.receivedByName,
    receiptNotes: opts.receiptNotes,
    signatureData: opts.signatureData ?? null,
  }).where(eq(malotes.id, opts.maloteId));
  // Notificar responsável da unidade de origem via WhatsApp
  if (maloteForNotif) {
    try {
      const [originUnit] = await db.select().from(units).where(eq(units.name, maloteForNotif.originUnit)).limit(1);
      if (originUnit?.responsiblePhone) {
        const devolvidos = opts.itemReceipts.filter(i => i.receiptStatus === "devolvido").length;
        const recebidos = opts.itemReceipts.filter(i => i.receiptStatus === "recebido").length;
        const statusEmoji = hasReturn ? "⚠️" : "✅";
        let msg = `${statusEmoji} *Malote ${maloteForNotif.maloteCode} ${hasReturn ? "recebido com devoluções" : "recebido com sucesso"}!*\n\nOrigem: ${maloteForNotif.originUnit}\nDestino: ${maloteForNotif.destinationUnit}\nRecebido por: ${opts.receivedByName}\n\n✅ Recebidos: ${recebidos}${hasReturn ? `\n🔄 Devolvidos: ${devolvidos}\n\nAs solicitações devolvidas foram reabertas para novo atendimento.` : ""}`;
        if (opts.receiptNotes) msg += `\n\nObservação: ${opts.receiptNotes}`;
        await WA.sendSimpleWhatsApp(originUnit.responsiblePhone, msg);
      }
    } catch (_) { /* silently ignore WhatsApp errors */ }
  }
}

export async function getMaloteStats(): Promise<{ abertos: number; enviados: number; recebidos: number }> {
  const db = await getDb();
  if (!db) return { abertos: 0, enviados: 0, recebidos: 0 };
  const all = await db.select({ status: malotes.status }).from(malotes);
  return {
    abertos: all.filter(m => m.status === "aberto").length,
    enviados: all.filter(m => m.status === "enviado").length,
    recebidos: all.filter(m => m.status === "recebido").length,
  };
}

export async function getRequestsReadyForMalote(): Promise<Array<{ id: number; requestNumber: string; requesterName: string; application: string; department: string }>> {
  const db = await getDb();
  if (!db) return [];
  const inMalote = await db.select({ requestId: maloteItems.requestId }).from(maloteItems);
  const inMaloteIds = new Set(inMalote.map(i => i.requestId));
  const concluded = await db
    .select({
      id: purchaseRequests.id,
      requestNumber: purchaseRequests.requestNumber,
      requesterName: purchaseRequests.requesterName,
      application: purchaseRequests.application,
      department: purchaseRequests.department,
    })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.status, "concluida"));
  return concluded.filter(r => !inMaloteIds.has(r.id));
}

// ─── Units / Unidades ─────────────────────────────────────────────────────────

export async function listUnits(): Promise<Unit[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(units).where(eq(units.active, true)).orderBy(units.name);
}

export async function createUnit(data: {
  name: string; code: string; address?: string; city?: string;
  state?: string; responsibleName?: string; responsiblePhone?: string;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(units).values({
    name: data.name, code: data.code.toUpperCase(),
    address: data.address ?? null, city: data.city ?? null,
    state: data.state ?? null, responsibleName: data.responsibleName ?? null,
    responsiblePhone: data.responsiblePhone ?? null,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return { id: insertId };
}

export async function updateUnit(id: number, data: Partial<{
  name: string; code: string; address: string; city: string;
  state: string; responsibleName: string; responsiblePhone: string; active: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set(data).where(eq(units.id, id));
}

export async function deleteUnit(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set({ active: false }).where(eq(units.id, id));
}

export async function importUnitsBatch(rows: Array<{
  code: string; name: string; address?: string; city?: string; state?: string;
  responsibleName?: string; responsiblePhone?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: units.id }).from(units).where(eq(units.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(units).set({ name: row.name, address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null }).where(eq(units.code, row.code));
      } else {
        await db.insert(units).values({ code: row.code.toUpperCase(), name: row.name, address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

// ─── Business Units / Unidades ──────────────────────────────────────────────

export async function listBusinessUnits(): Promise<BusinessUnit[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(businessUnits).where(eq(businessUnits.active, true)).orderBy(businessUnits.name);
}

export async function createBusinessUnit(data: {
  name: string; code: string;
  type?: "escritorio" | "filial" | "deposito" | "outro";
  address?: string; city?: string;
  state?: string; responsibleName?: string; responsiblePhone?: string;
}): Promise<{ id: number }> {
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
    responsiblePhone: data.responsiblePhone ?? null,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return { id: insertId };
}

export async function updateBusinessUnit(id: number, data: Partial<{
  name: string; code: string;
  type: "escritorio" | "filial" | "deposito" | "outro";
  address: string; city: string;
  state: string; responsibleName: string; responsiblePhone: string; active: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(businessUnits).set(data).where(eq(businessUnits.id, id));
}

export async function deleteBusinessUnit(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(businessUnits).set({ active: false }).where(eq(businessUnits.id, id));
}

export async function importBusinessUnitsBatch(rows: Array<{
  code: string; name: string;
  type?: "escritorio" | "filial" | "deposito" | "outro";
  address?: string; city?: string; state?: string;
  responsibleName?: string; responsiblePhone?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: businessUnits.id }).from(businessUnits).where(eq(businessUnits.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(businessUnits).set({ name: row.name, type: row.type ?? "escritorio", address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null }).where(eq(businessUnits.code, row.code));
      } else {
        await db.insert(businessUnits).values({ code: row.code.toUpperCase(), name: row.name, type: row.type ?? "escritorio", address: row.address ?? null, city: row.city ?? null, state: row.state ?? null, responsibleName: row.responsibleName ?? null, responsiblePhone: row.responsiblePhone ?? null });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

// ─── Malote Tags ──────────────────────────────────────────────────────────────

export async function listMaloteTags(): Promise<MaloteTag[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maloteTags).where(eq(maloteTags.active, true)).orderBy(maloteTags.category, maloteTags.name);
}

export async function createMaloteTag(data: {
  name: string;
  color: string;
  icon: string;
  category: "prioridade" | "tipo" | "custom";
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(maloteTags).values({
    name: data.name,
    color: data.color,
    icon: data.icon,
    category: data.category,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return { id: insertId };
}

export async function updateMaloteTag(id: number, data: Partial<{
  name: string; color: string; icon: string; active: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(maloteTags).set(data).where(eq(maloteTags.id, id));
}

export async function getMaloteTagsForMalote(maloteId: number): Promise<MaloteTag[]> {
  const db = await getDb();
  if (!db) return [];
  const links = await db
    .select({ tag: maloteTags })
    .from(maloteTagLinks)
    .innerJoin(maloteTags, eq(maloteTagLinks.tagId, maloteTags.id))
    .where(eq(maloteTagLinks.maloteId, maloteId));
  return links.map(l => l.tag);
}

export async function setMaloteTags(maloteId: number, tagIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Remove existing links
  await db.delete(maloteTagLinks).where(eq(maloteTagLinks.maloteId, maloteId));
  // Insert new links
  if (tagIds.length > 0) {
    await db.insert(maloteTagLinks).values(
      tagIds.map(tagId => ({ maloteId, tagId }))
    );
  }
}

// ─── Departments / Departamentos ─────────────────────────────────────────────────────

export async function listDepartments(): Promise<Department[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).where(eq(departments.active, true)).orderBy(departments.name);
}

export async function createDepartment(data: {
  code: string;
  name: string;
  responsible?: string;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(departments).values({
    code: data.code.toUpperCase(),
    name: data.name,
    responsible: data.responsible ?? null,
  });
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return { id: insertId };
}

export async function updateDepartment(id: number, data: Partial<{
  code: string;
  name: string;
  responsible: string;
  active: boolean;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departments).set(data).where(eq(departments.id, id));
}

export async function deleteDepartment(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(departments).set({ active: false }).where(eq(departments.id, id));
}

export async function importDepartmentsBatch(rows: Array<{
  code: string;
  name: string;
  responsible?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const existing = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, row.code)).limit(1);
      if (existing.length > 0) {
        await db.update(departments).set({ name: row.name, responsible: row.responsible ?? null }).where(eq(departments.code, row.code));
      } else {
        await db.insert(departments).values({ code: row.code.toUpperCase(), name: row.name, responsible: row.responsible ?? null });
      }
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, message: err.message ?? "Erro desconhecido" });
    }
  }
  return { imported, errors };
}

export async function getNextDepartmentCode(): Promise<string> {
  const db = await getDb();
  if (!db) return "DEP-001";
  const all = await db.select({ code: departments.code }).from(departments);
  const nums = all
    .map(r => r.code)
    .filter(c => /^DEP-\d+$/.test(c))
    .map(c => parseInt(c.split("-")[1] ?? "0", 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `DEP-${String(next).padStart(3, "0")}`;
}
