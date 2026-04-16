import {
  and, desc, eq, gte, inArray, lte, or, sql
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool as createPromisePool } from "mysql2/promise";
import type { Pool as CallbackPool } from "mysql2";
import {
  approvalHistory,
  assets,
  budgets,
  businessUnits,
  costCenters,
  departments,
  harvests,
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
  apiKeys,
  type ApiKey,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import * as WA from "./whatsapp";

const STEP_LABELS_SERVER: Record<string, string> = {
  aguardando_gerente:              "Aprovação do Gerente",
  aguardando_orcamento:            "Orçamento",
  aguardando_controladoria:        "Aprovação Controladoria",
  aguardando_diretoria:            "Aprovação Diretoria",
  aguardando_ordem_compra:         "Emissão de OC (Compras)",
  aguardando_aprovacao_compra:     "Aprovação Financeiro",
  aguardando_comprovante_pagamento:"Comprovante de Pagamento",
  aguardando_verificacao_compras:  "Verificação Final (Compras)",
  concluida:                       "Concluída",
};

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Use promise-based connection pool for automatic reconnection on ECONNRESET/timeout
      // Cast needed because drizzle types reference mysql2 callback Pool but runtime uses promise Pool
      const pool = createPromisePool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      }) as unknown as CallbackPool;
      _db = drizzle(pool);
      console.log("[Database] Connection pool created successfully");
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
  extraRoles?: string[];
  department?: string;
  phone?: string;
  jobTitle?: string;
  approvalLevel?: string;
  extraApprovalLevels?: string[];
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

  // Serializar arrays como JSON (remover duplicatas e o valor primário dos extras)
  const extraRolesJson = data.extraRoles && data.extraRoles.length > 0
    ? JSON.stringify([...new Set(data.extraRoles.filter(r => r !== data.procurementRole))])
    : null;
  const extraApprovalLevelsJson = data.extraApprovalLevels && data.extraApprovalLevels.length > 0
    ? JSON.stringify([...new Set(data.extraApprovalLevels.filter(l => l !== (data.approvalLevel ?? "nenhum")))])
    : null;

  if (data.id) {
    // UPDATE existing user
    await db.update(users).set({
      name: data.name,
      email: data.email ?? null,
      procurementRole: data.procurementRole as User["procurementRole"],
      extraRoles: extraRolesJson,
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: (data.approvalLevel ?? "nenhum") as User["approvalLevel"],
      extraApprovalLevels: extraApprovalLevelsJson,
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
      extraRoles: extraRolesJson,
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: (data.approvalLevel ?? "nenhum") as User["approvalLevel"],
      extraApprovalLevels: extraApprovalLevelsJson,
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
export async function listAllCostCenters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(costCenters).orderBy(costCenters.code);
}
export async function toggleCostCenterActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(costCenters).set({ active }).where(eq(costCenters.id, id));
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

async function generatePatrimonialCode(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  // Busca o maior número sequencial existente em PAT-NNNNN
  const [row] = await (db as any).execute(
    "SELECT patrimonialCode FROM assets WHERE patrimonialCode LIKE 'PAT-%' ORDER BY patrimonialCode DESC LIMIT 1"
  ) as any;
  const last = row?.[0]?.patrimonialCode as string | undefined;
  const lastNum = last ? parseInt(last.replace("PAT-", ""), 10) : 0;
  const next = isNaN(lastNum) ? 1 : lastNum + 1;
  return "PAT-" + String(next).padStart(5, "0");
}

export async function createAsset(data: { code: string; description: string; category?: string; location?: string; value?: string; hasChassi?: boolean; chassiNumber?: string; licensePlate?: string }) {
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
    patrimonialCode,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}
export async function updateAsset(id: number, data: Partial<{ code: string; description: string; category: string; location: string; active: boolean; value: string; hasChassi: boolean; chassiNumber: string; licensePlate: string }>) {
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
  code: string; description: string; category?: string; location?: string; value?: string; hasChassi?: boolean; chassiNumber?: string; licensePlate?: string;
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
        await db.update(assets).set({ description: row.description, category: row.category ?? null, location: row.location ?? null, value: row.value ?? null, hasChassi: row.hasChassi ?? false, chassiNumber: row.chassiNumber ?? null, licensePlate: row.licensePlate ?? null }).where(eq(assets.code, row.code));
      } else {
        await db.insert(assets).values({ code: row.code, description: row.description, category: row.category ?? null, location: row.location ?? null, value: row.value ?? null, hasChassi: row.hasChassi ?? false, chassiNumber: row.chassiNumber ?? null, licensePlate: row.licensePlate ?? null });
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
  // Use MAX of existing sequence numbers to avoid duplicates when records are deleted/cancelled
  const prefix = `SOL-${year}-`;
  const [row] = await db!.select({ maxNum: sql<string | null>`MAX(CAST(SUBSTRING(${purchaseRequests.requestNumber}, ${prefix.length + 1}) AS UNSIGNED))` })
    .from(purchaseRequests)
    .where(sql`${purchaseRequests.requestNumber} LIKE ${prefix + '%'}`);
  const lastSeq = row?.maxNum ? Number(row.maxNum) : 0;
  const seq = String(lastSeq + 1).padStart(4, "0");
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
    osMyfarm?: string;
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
    osMyfarm: input.osMyfarm ?? null,
    totalEstimatedValue: total > 0 ? String(total) : null,
    // Todos os pedidos começam pelo Gerente (urgentes/emergenciais vão para Diretoria após o Gerente)
    status: "aguardando_gerente",
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
    // Todos os pedidos (incluindo urgentes/emergenciais) começam pelo Gerente.
    // Fluxo urgente/emergencial: Gerente → Orçamento → Diretoria → Controladoria
    // Fluxo normal:              Gerente → Orçamento → Controladoria → Diretoria
    const approverRole = "gerente";
    const stepLabel = "Gerente de Unidade";
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
  const reqs = await db.select().from(purchaseRequests).where(eq(purchaseRequests.requesterId, requesterId)).orderBy(desc(purchaseRequests.createdAt));
  if (reqs.length === 0) return [];
  const ids = reqs.map(r => r.id);
  const allItems = await db.select().from(requestItems).where(inArray(requestItems.requestId, ids));
  return reqs.map(r => ({ ...r, items: allItems.filter(i => i.requestId === r.id) }));
}

export async function getPendingRequestsForUser(role: string, extraRoles?: string[]) {
  const db = await getDb();
  if (!db) return [];

  // Combinar papel primário + extras
  const allRoles = [role, ...(extraRoles ?? [])].filter(Boolean);

  // Coletar todos os status pendentes para todos os papéis do usuário
  const pendingStatuses = new Set<string>();

  // Helper: busca solicitações e enriquece com itens
  const dbConn = db;
  async function fetchWithItems(statuses: string[]) {
    const reqs = await dbConn.select().from(purchaseRequests)
      .where(inArray(purchaseRequests.status, statuses as any[]))
      .orderBy(purchaseRequests.urgencyLevel, purchaseRequests.deadlineAt);
    if (reqs.length === 0) return [];
    const ids = reqs.map(r => r.id);
    const allItems = await dbConn.select().from(requestItems).where(inArray(requestItems.requestId, ids));
    return reqs.map(r => ({ ...r, items: allItems.filter(i => i.requestId === r.id) }));
  }

  // Usuário master vê todas as etapas pendentes de aprovação
  if (allRoles.includes("master")) {
    const allPendingStatuses = [
      "aguardando_gerente",
      "aguardando_orcamento",
      "aguardando_controladoria",
      "aguardando_diretoria",
      "aguardando_ordem_compra",
      "aguardando_aprovacao_compra",
      "aguardando_comprovante_pagamento",
      "aguardando_verificacao_compras",
    ];
    return fetchWithItems(allPendingStatuses);
  }

  for (const r of allRoles) {
    if (r === "orcamento") {
      // Role orcamento responde por 3 etapas
      pendingStatuses.add("aguardando_orcamento");
      pendingStatuses.add("aguardando_ordem_compra");
      pendingStatuses.add("aguardando_verificacao_compras");
    } else {
      if (r === "financeiro") {
        // Financeiro responde por 2 etapas: aprovação de compra + comprovante de pagamento
        pendingStatuses.add("aguardando_aprovacao_compra");
        pendingStatuses.add("aguardando_comprovante_pagamento");
      } else {
        const singleStatusMap: Record<string, string> = {
          gerente: "aguardando_gerente",
          controladoria: "aguardando_controladoria",
          diretoria: "aguardando_diretoria",
        };
        const s = singleStatusMap[r];
        if (s) pendingStatuses.add(s);
      }
    }
  }

  if (pendingStatuses.size === 0) return [];

  return fetchWithItems([...pendingStatuses]);
}

export async function getAllRequests(departmentFilter?: string) {
  const db = await getDb();
  if (!db) return [];
  const reqs = departmentFilter
    ? await db.select().from(purchaseRequests).where(eq(purchaseRequests.department, departmentFilter)).orderBy(desc(purchaseRequests.createdAt))
    : await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
  if (reqs.length === 0) return [];
  const ids = reqs.map(r => r.id);
  const allItems = await db.select().from(requestItems).where(inArray(requestItems.requestId, ids));
  return reqs.map(r => ({ ...r, items: allItems.filter(i => i.requestId === r.id) }));
}

export async function getDashboardStats(userId: number, role: string) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, approved: 0, rejected: 0, urgent: 0, emergency: 0 };

  // Todos os perfis vêem todas as solicitações no dashboard
  const all = await db.select().from(purchaseRequests);

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

export async function getMonthlyReport(year: number, month: number) {
  const db = await getDb();
  if (!db) return { requests: [], summary: { total: 0, concluidas: 0, pendentes: 0, rejeitadas: 0, canceladas: 0, totalValue: 0 }, byDepartment: [], byStatus: [], byUrgency: [] };

  // Filtrar pelo mês/ano selecionado
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const all = await db.select().from(purchaseRequests)
    .where(and(
      gte(purchaseRequests.createdAt, startDate),
      lte(purchaseRequests.createdAt, endDate)
    ))
    .orderBy(purchaseRequests.createdAt);

  // Buscar itens de todas as solicitações do período
  const allIds = all.map(r => r.id);
  const items = allIds.length > 0
    ? await db.select().from(requestItems).where(inArray(requestItems.requestId, allIds))
    : [];

  // Calcular valor total real (soma dos itens)
  const totalValue = items.reduce((sum, item) => sum + parseFloat(item.totalPrice ?? "0"), 0);

  // Resumo geral
  const summary = {
    total: all.length,
    concluidas: all.filter(r => r.status === "concluida").length,
    pendentes: all.filter(r => r.status.startsWith("aguardando")).length,
    rejeitadas: all.filter(r => r.status === "rejeitada").length,
    canceladas: all.filter(r => r.status === "cancelada").length,
    totalValue,
  };

  // Agrupamento por departamento
  const deptMap = new Map<string, { department: string; total: number; concluidas: number; pendentes: number; rejeitadas: number; totalValue: number }>();
  for (const r of all) {
    const dept = r.department || "Não informado";
    if (!deptMap.has(dept)) deptMap.set(dept, { department: dept, total: 0, concluidas: 0, pendentes: 0, rejeitadas: 0, totalValue: 0 });
    const entry = deptMap.get(dept)!;
    entry.total++;
    if (r.status === "concluida") entry.concluidas++;
    else if (r.status.startsWith("aguardando")) entry.pendentes++;
    else if (r.status === "rejeitada" || r.status === "cancelada") entry.rejeitadas++;
    // Somar valor dos itens desta solicitação
    const reqItems = items.filter(i => i.requestId === r.id);
    entry.totalValue += reqItems.reduce((sum, i) => sum + parseFloat(i.totalPrice ?? "0"), 0);
  }
  const byDepartment = Array.from(deptMap.values()).sort((a, b) => b.total - a.total);

  // Agrupamento por status
  const statusMap = new Map<string, number>();
  for (const r of all) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  }
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

  // Agrupamento por urgência
  const urgencyMap = new Map<string, number>();
  for (const r of all) {
    urgencyMap.set(r.urgencyLevel, (urgencyMap.get(r.urgencyLevel) ?? 0) + 1);
  }
  const byUrgency = Array.from(urgencyMap.entries()).map(([urgency, count]) => ({ urgency, count }));

  // Lista detalhada de solicitações
  const requests = all.map(r => ({
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
    itemCount: items.filter(i => i.requestId === r.id).length,
    totalValue: items.filter(i => i.requestId === r.id).reduce((sum, i) => sum + parseFloat(i.totalPrice ?? "0"), 0),
  }));

  return { requests, summary, byDepartment, byStatus, byUrgency };
}

export async function getApprovalHistory(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(approvalHistory).where(eq(approvalHistory.requestId, requestId)).orderBy(approvalHistory.createdAt);
}

/**
 * Calcula o tempo médio (em horas) que cada etapa de aprovação leva para ser concluída.
 * Usa o histórico de aprovações: para cada solicitação, calcula o intervalo entre
 * a entrada na etapa (registro anterior) e a aprovação/rejeição (registro atual).
 * Retorna as etapas ranqueadas da mais lenta para a mais rápida.
 */
export async function getApprovalTimingStats() {
  const db = await getDb();
  if (!db) return [];

  // Busca todo o histórico de aprovações com ações de decisão (aprovada/rejeitada)
  const history = await db
    .select()
    .from(approvalHistory)
    .where(inArray(approvalHistory.action, ["aprovada", "rejeitada", "compra_aprovada", "compra_cancelada", "oc_finalizada", "pagamento_verificado"]))
    .orderBy(approvalHistory.requestId, approvalHistory.createdAt);

  // Para cada registro de decisão, busca o registro anterior da mesma solicitação
  // para calcular o tempo de espera naquela etapa
  const allHistory = await db
    .select()
    .from(approvalHistory)
    .orderBy(approvalHistory.requestId, approvalHistory.createdAt);

  // Agrupa histórico por requestId
  const byRequest = new Map<number, typeof allHistory>();
  for (const h of allHistory) {
    if (!byRequest.has(h.requestId)) byRequest.set(h.requestId, []);
    byRequest.get(h.requestId)!.push(h);
  }

  // Labels amigáveis por step
  const STEP_LABELS: Record<string, string> = {
    gerente:             "Gerente",
    orcamento:           "Orçamento",
    controladoria:       "Controladoria",
    diretoria:           "Diretoria",
    ordem_compra:        "Emissão de OC",
    aprovacao_compra:    "Financeiro",
    financeiro:          "Comprovante",
    verificacao_compras: "Verificação Final",
  };

  // Acumula tempos por step
  const stepTimes = new Map<string, { totalHours: number; count: number }>();

  for (const decision of history) {
    const reqHistory = byRequest.get(decision.requestId) ?? [];
    const idx = reqHistory.findIndex(h => h.id === decision.id);
    if (idx <= 0) continue; // sem registro anterior

    const prev = reqHistory[idx - 1];
    const diffMs = new Date(decision.createdAt).getTime() - new Date(prev.createdAt).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Ignora tempos negativos ou absurdamente longos (> 30 dias = dados inconsistentes)
    if (diffHours <= 0 || diffHours > 720) continue;

    const step = decision.step;
    if (!STEP_LABELS[step]) continue; // ignora etapas sem label (criacao, cancelamento, etc)

    if (!stepTimes.has(step)) stepTimes.set(step, { totalHours: 0, count: 0 });
    const entry = stepTimes.get(step)!;
    entry.totalHours += diffHours;
    entry.count++;
  }

  // Monta resultado ranqueado do mais lento para o mais rápido
  const result = Array.from(stepTimes.entries())
    .map(([step, { totalHours, count }]) => ({
      step,
      label: STEP_LABELS[step] ?? step,
      avgHours: Math.round((totalHours / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgHours - a.avgHours);

  return result;
}

export async function attachBudget(requestId: number, userId: number, userName: string, fileUrl: string, fileName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verifica se já existe um orçamento anexado (substituição vs. primeiro anexo)
  const [existing] = await db
    .select({ budgetFileUrl: purchaseRequests.budgetFileUrl, status: purchaseRequests.status })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);

  if (!existing) throw new Error("Solicitação não encontrada");

  // Proteção anti-loop: só permite anexar/substituir orçamento nos status válidos:
  // - aguardando_orcamento: envio inicial do orçamento
  // - aguardando_controladoria: edição permitida enquanto aguarda Controladoria
  const ALLOWED_BUDGET_STATUSES = ["aguardando_orcamento", "aguardando_controladoria"];
  if (!ALLOWED_BUDGET_STATUSES.includes(existing.status)) {
    throw new Error(`Não é possível anexar orçamento nesta etapa. A solicitação está em "${existing.status}" e o orçamento só pode ser enviado ou substituído quando aguardando orçamento ou controladoria.`);
  }

  const isSubstitution = !!(existing?.budgetFileUrl);
  const fileLabel = fileName ? `"${fileName}"` : "PDF";
  const now = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  await db.update(purchaseRequests).set({
    budgetFileUrl: fileUrl,
  }).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId,
    userName,
    step: "orcamento",
    action: "orcamento_anexado",
    comment: isSubstitution
      ? `Orçamento substituído por ${userName} em ${now} — Arquivo: ${fileLabel}`
      : `Orçamento em PDF anexado — aguardando envio`,
  });
}

// ─── Approvals ────────────────────────────────────────────────────────────────

// Fluxo NORMAL: Gerente → Orçamento → Controladoria → Diretoria → OC → Financeiro → Comprovante → Verificação
const STEP_FLOW_NORMAL: Record<string, { step: string; nextStatus: string; action: string }> = {
  aguardando_gerente:              { step: "gerente",           nextStatus: "aguardando_orcamento",              action: "aprovada" },
  aguardando_orcamento:            { step: "orcamento",         nextStatus: "aguardando_controladoria",          action: "aprovada" },
  aguardando_controladoria:        { step: "controladoria",     nextStatus: "aguardando_diretoria",              action: "aprovada" },
  aguardando_diretoria:            { step: "diretoria",         nextStatus: "aguardando_ordem_compra",           action: "aprovada" },
  aguardando_ordem_compra:         { step: "ordem_compra",      nextStatus: "aguardando_aprovacao_compra",       action: "ordem_emitida" },
  aguardando_aprovacao_compra:     { step: "aprovacao_compra",  nextStatus: "aguardando_comprovante_pagamento",  action: "compra_aprovada" },
  aguardando_comprovante_pagamento:{ step: "financeiro",        nextStatus: "aguardando_verificacao_compras",   action: "comprovante_aprovado" },
  rejeitada:                       { step: "gerente",           nextStatus: "aguardando_gerente",                action: "reaberta" },
};

// Fluxo URGENTE/EMERGENCIAL: Gerente → Orçamento → Diretoria → Controladoria → OC → Financeiro → Comprovante → Verificação
const STEP_FLOW_URGENT: Record<string, { step: string; nextStatus: string; action: string }> = {
  aguardando_gerente:              { step: "gerente",           nextStatus: "aguardando_orcamento",              action: "aprovada" },
  aguardando_orcamento:            { step: "orcamento",         nextStatus: "aguardando_diretoria",              action: "aprovada" },
  aguardando_diretoria:            { step: "diretoria",         nextStatus: "aguardando_controladoria",          action: "aprovada" },
  aguardando_controladoria:        { step: "controladoria",     nextStatus: "aguardando_ordem_compra",           action: "aprovada" },
  aguardando_ordem_compra:         { step: "ordem_compra",      nextStatus: "aguardando_aprovacao_compra",       action: "ordem_emitida" },
  aguardando_aprovacao_compra:     { step: "aprovacao_compra",  nextStatus: "aguardando_comprovante_pagamento",  action: "compra_aprovada" },
  aguardando_comprovante_pagamento:{ step: "financeiro",        nextStatus: "aguardando_verificacao_compras",   action: "comprovante_aprovado" },
  rejeitada:                       { step: "gerente",           nextStatus: "aguardando_gerente",                action: "reaberta" },
};

function getStepFlow(urgencyLevel: string) {
  return (urgencyLevel === "urgente" || urgencyLevel === "emergencial")
    ? STEP_FLOW_URGENT
    : STEP_FLOW_NORMAL;
}

// Mantém compatibilidade com código que usa STEP_FLOW diretamente
const STEP_FLOW = STEP_FLOW_NORMAL;

// Fluxo de rejeição NORMAL
const REJECT_FLOW_NORMAL: Record<string, string> = {
  aguardando_gerente:              "aguardando_gerente",
  aguardando_orcamento:            "aguardando_orcamento",
  aguardando_controladoria:        "aguardando_orcamento",
  aguardando_diretoria:            "aguardando_controladoria",
  aguardando_ordem_compra:         "aguardando_diretoria",
  aguardando_aprovacao_compra:     "aguardando_ordem_compra",
  aguardando_comprovante_pagamento:"rejeitada",
};

// Fluxo de rejeição URGENTE/EMERGENCIAL
const REJECT_FLOW_URGENT: Record<string, string> = {
  aguardando_gerente:              "aguardando_gerente",
  aguardando_orcamento:            "aguardando_orcamento",
  aguardando_diretoria:            "aguardando_orcamento",
  aguardando_controladoria:        "aguardando_diretoria",
  aguardando_ordem_compra:         "aguardando_controladoria",
  aguardando_aprovacao_compra:     "aguardando_ordem_compra",
  aguardando_comprovante_pagamento:"rejeitada",
};

function getRejectFlow(urgencyLevel: string) {
  return (urgencyLevel === "urgente" || urgencyLevel === "emergencial")
    ? REJECT_FLOW_URGENT
    : REJECT_FLOW_NORMAL;
}

// Compatível com código legado
const REJECT_FLOW = REJECT_FLOW_NORMAL;

export async function submitBudget(
  requestId: number,
  user: User,
  orderValue?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");
  if (request.status !== "aguardando_orcamento") throw new Error("Esta solicitação não está aguardando orçamento.");
  if (!request.budgetFileUrl) throw new Error("Anexe o PDF do orçamento antes de enviar.");

  const isUrgent = request.urgencyLevel === "urgente" || request.urgencyLevel === "emergencial";

  // No fluxo urgente/emergencial:
  // - 1ª vez (orcamentoFeitoUrgente=false): vai para aguardando_diretoria (Diretoria aprova antes da Controladoria)
  // - 2ª vez em diante (orcamentoFeitoUrgente=true): vai direto para aguardando_controladoria (Diretoria já aprovou antes)
  let nextStatus: string;
  if (isUrgent && request.orcamentoFeitoUrgente) {
    // Segunda vez ou mais: Diretoria já aprovou, vai direto para Controladoria
    nextStatus = "aguardando_controladoria";
  } else {
    const stepFlow = getStepFlow(request.urgencyLevel);
    const flow = stepFlow["aguardando_orcamento"];
    if (!flow) throw new Error("Fluxo de orçamento não configurado");
    nextStatus = flow.nextStatus;
  }

  await db.update(purchaseRequests).set({
    status: nextStatus as any,
    stepDeadlineAt: getStepDeadline(),
    // Salvar o valor da ordem de compra se fornecido
    ...(orderValue != null ? { orderValue: String(orderValue) } : {}),
    // Marcar que o orçamento já foi feito ao menos uma vez (para fluxo urgente/emergencial)
    ...(isUrgent ? { orcamentoFeitoUrgente: true } : {}),
  }).where(eq(purchaseRequests.id, requestId));

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: "orcamento" as any,
    action: "aprovada" as any,
    comment: "Orçamento enviado",
  });

  // ── Notificar aprovadores da próxima etapa via WhatsApp ───────────────────────
  // No fluxo urgente/emergencial: aguardando_orcamento → aguardando_diretoria
  // No fluxo normal: aguardando_orcamento → aguardando_controladoria
  // Em ambos os casos, notificar os aprovadores da próxima etapa
  try {
    const WA = await import("./whatsapp");
    // Mapa: próximo status → papel do aprovador
    const nextRoleMap: Record<string, string> = {
      aguardando_controladoria: "controladoria",
      aguardando_diretoria:     "diretoria",
    };
    const nextRole = nextRoleMap[nextStatus];
    if (nextRole) {
      const { users: usersTable } = await import("../drizzle/schema");
      const { or, eq: eqDrizzle, and } = await import("drizzle-orm");
      const nextApproversRaw = await db
        .select()
        .from(usersTable)
        .where(and(
          eqDrizzle(usersTable.active, true),
          or(
            eqDrizzle(usersTable.procurementRole, nextRole as any),
            eqDrizzle(usersTable.approvalLevel, nextRole as any),
          ),
        ));
      const nextApprovers = [...new Map(nextApproversRaw.map(a => [a.id, a])).values()];
      const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
      const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
      const itemsForMsg = items.map(it => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
      const STEP_LABELS: Record<string, string> = {
        aguardando_controladoria: "Aprovação Controladoria",
        aguardando_diretoria:     "Aprovação Diretoria",
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
            totalValue: req.totalEstimatedValue ?? undefined,
          });
        } else {
          console.warn(`[submitBudget] Aprovador ${approver.name} (id=${approver.id}) não tem telefone cadastrado.`);
        }
      }
      console.log(`[submitBudget] Notificados ${nextApprovers.length} aprovador(es) para etapa "${nextRole}"`);
    }
  } catch (notifyErr) {
    console.warn("[submitBudget] Falha ao notificar aprovadores:", notifyErr);
  }

  return { success: true, nextStatus };
}

export async function approveRequest(
  requestId: number,
  user: User,
  data: { comment?: string; purchaseOrderNumber?: string; paymentInfo?: string; paymentMethod?: string; paymentObservations?: string; paymentInstallments?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");

  // ── Verificação de permissão por etapa ─────────────────────────────────────
  // Mapa: status atual → papel(is) que podem aprovar essa etapa
  const STEP_ROLE_MAP: Record<string, string[]> = {
    aguardando_gerente:               ["gerente", "master"],
    aguardando_orcamento:             ["orcamento", "master"],
    aguardando_controladoria:         ["controladoria", "master"],
    aguardando_diretoria:             ["diretoria", "master"],
    aguardando_ordem_compra:          ["orcamento", "master"],
    aguardando_aprovacao_compra:      ["financeiro", "master"],
    aguardando_comprovante_pagamento: ["financeiro", "master"],
    aguardando_verificacao_compras:   ["orcamento", "master"],
    rejeitada:                        ["master"],
  };
  const allowedRoles = STEP_ROLE_MAP[request.status];
  if (allowedRoles) {
    const userProcurementRole = (user as any).procurementRole ?? "";
    const userApprovalLevel = (user as any).approvalLevel ?? "nenhum";
    const userExtraRoles: string[] = (() => { try { return JSON.parse((user as any).extraRoles ?? "[]"); } catch { return []; } })();
    const userExtraApprovalLevels: string[] = (() => { try { return JSON.parse((user as any).extraApprovalLevels ?? "[]"); } catch { return []; } })();
    const isMaster = userApprovalLevel === "master";
    const hasPermission = isMaster ||
      allowedRoles.includes(userProcurementRole) ||
      allowedRoles.includes(userApprovalLevel) ||
      userExtraRoles.some(r => allowedRoles.includes(r)) ||
      userExtraApprovalLevels.some(l => allowedRoles.includes(l));
    if (!hasPermission) {
      const stepLabel = ({
        aguardando_gerente: "Gerente",
        aguardando_orcamento: "Orçamento",
        aguardando_controladoria: "Controladoria",
        aguardando_diretoria: "Diretoria",
        aguardando_ordem_compra: "Compras",
        aguardando_aprovacao_compra: "Financeiro",
        aguardando_comprovante_pagamento: "Financeiro",
        aguardando_verificacao_compras: "Compras",
      } as Record<string, string>)[request.status] ?? request.status;
      throw new Error(`Você não tem permissão para aprovar a etapa "${stepLabel}". Apenas usuários com o papel correto podem executar esta ação.`);
    }
  }

  // Seleciona o fluxo correto com base na urgência do pedido
  const stepFlow = getStepFlow(request.urgencyLevel);
  const flow = stepFlow[request.status];
  if (!flow) throw new Error("Ação não permitida neste status");;

  // ── Verificação de orçamento obrigatório ─────────────────────────────────────
  // Na etapa de orçamento, o PDF deve estar anexado antes de aprovar/avançar
  if (request.status === "aguardando_orcamento" && !request.budgetFileUrl) {
    throw new Error("É obrigatório anexar o PDF do orçamento antes de aprovar esta etapa. Clique em \"Anexar Orçamento\" e envie o arquivo para continuar.");
  }

  // ── Verificação de orçamento obrigatório na etapa da Diretoria ───────────────
  // A Diretoria só pode aprovar se o orçamento já estiver anexado.
  // Isso evita que usuários com múltiplos papéis (ex: Gerente + Diretoria)
  // aprovem a etapa da Diretoria sem que o orçamento tenha sido enviado.
  if (request.status === "aguardando_diretoria" && !request.budgetFileUrl) {
    throw new Error("Não é possível aprovar a etapa da Diretoria sem orçamento anexado. O responsável pelo orçamento deve enviar o PDF antes desta aprovação.");
  }

  // ── Aprovação simples da Diretoria ───────────────────────────────────────────
  // Uma aprovação de qualquer diretor é suficiente para avançar o status
  if (request.status === "aguardando_diretoria") {
    // Limpar directorApprovals caso haja dados residuais de lógica anterior
    await db.update(purchaseRequests).set({
      directorApprovals: null,
    }).where(eq(purchaseRequests.id, requestId));
  }

  const effectiveNextStatus = flow.nextStatus;

  const updateData: Record<string, unknown> = {
    status: effectiveNextStatus,
    stepDeadlineAt: getStepDeadline(),
  };
  if (data.purchaseOrderNumber) updateData.purchaseOrderNumber = data.purchaseOrderNumber;
  if (data.paymentInfo) updateData.paymentInfo = data.paymentInfo;
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
  if (data.paymentObservations) updateData.paymentObservations = data.paymentObservations;
  if (data.paymentInstallments) updateData.paymentInstallments = data.paymentInstallments;

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
    // IMPORTANTE: aguardando_orcamento NÃO está aqui pois não é aprovado via WhatsApp.
    // Quando o próximo status é aguardando_orcamento, o SOLICITANTE é notificado para
    // anexar o PDF do orçamento no app (via notifyBudgetRequired), não os aprovadores.
    const nextRoleMap: Record<string, string> = {
      aguardando_gerente:              "gerente",
      // aguardando_orcamento: removido intencionalmente para evitar looping
      aguardando_controladoria:        "controladoria",
      aguardando_diretoria:            "diretoria",
      aguardando_ordem_compra:         "orcamento",          // Fluxo 06: OC → Orçamento
      aguardando_aprovacao_compra:     "financeiro",         // Fluxo 06b: Aprovação de Compra → Financeiro
      aguardando_comprovante_pagamento:"financeiro",         // Fluxo 07: Comprovante → Financeiro
      aguardando_verificacao_compras:  "orcamento",          // Fluxo 08: Verificação Final → Orçamento
    };

    const isUrgentOrEmergency = request.urgencyLevel === "urgente" || request.urgencyLevel === "emergencial";
    if (effectiveNextStatus === "aguardando_orcamento") {
      // Qualquer etapa que avança para orçamento → notificar SOLICITANTE para anexar orçamento
      // NÃO enviar token de aprovação para equipe de orçamento (causaria looping)
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

  const stepFlow = getStepFlow(request.urgencyLevel);
  const rejectFlow = getRejectFlow(request.urgencyLevel);
  const flow = stepFlow[request.status];
  const prevStatus = rejectFlow[request.status] ?? "aguardando_gerente";

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
        // NOTA: aguardando_orcamento não envia token de aprovação (evita looping)
        // Quando volta para orçamento, o solicitante é notificado separadamente
        const prevRoleMap: Record<string, string> = {
          // aguardando_orcamento: removido intencionalmente para evitar looping
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

export async function finalizeOC(requestId: number, user: User, orderValue?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");
  if (request.status !== "aguardando_verificacao_compras") throw new Error("Status inválido para finalizar OC");

  // Marcar como concluída e habilitar nos Malotes
  // orderValue: Valor da Ordem de Compra definido pelo Compras na Emissão de OC
  await db.update(purchaseRequests).set({
    status: "concluida" as any,
    isEnabledInMalotes: true,
    stepDeadlineAt: null,
    ...(orderValue != null ? { orderValue: String(orderValue) } : {}),
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
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!reason || reason.trim().length === 0) {
    throw new Error("O motivo do cancelamento é obrigatório.");
  }

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

// ─── Reopen Request ─────────────────────────────────────────────────────────────

/**
 * Allows a master user to reopen a cancelled request, resetting it to the beginning of the flow.
 */
export async function reopenRequest(requestId: number, masterId: number, masterName: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify the request exists and is cancelled
  const [existing] = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);

  if (!existing) throw new Error("Solicitação não encontrada.");
  if (existing.status !== "cancelada") throw new Error("Apenas solicitações canceladas podem ser reabertas.");

  // Reset status to beginning of flow
  await db
    .update(purchaseRequests)
    .set({ status: "aguardando_gerente", updatedAt: new Date() })
    .where(eq(purchaseRequests.id, requestId));

  // Record in approval history
  await db.insert(approvalHistory).values({
    requestId: requestId,
    userId: masterId,
    userName: masterName,
    step: "criacao",
    action: "reaberta",
    comment: `Solicitação reaberta pelo master ${masterName}. Retornada ao início do fluxo.`,
  });
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

export async function getMaloteWithItems(maloteId: number): Promise<{ malote: Malote; items: (MaloteItem & { ocItems: import('../drizzle/schema').RequestItem[] })[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const [malote] = await db.select().from(malotes).where(eq(malotes.id, maloteId)).limit(1);
  if (!malote) return null;
  const items = await db.select().from(maloteItems).where(eq(maloteItems.maloteId, maloteId));
  // Para cada item do malote, buscar os itens da OC (requestItems) da solicitação vinculada
  const itemsWithOC = await Promise.all(
    items.map(async (item) => {
      const ocItems = item.requestId
        ? await db.select().from(requestItems).where(eq(requestItems.requestId, item.requestId))
        : [];
      return { ...item, ocItems };
    })
  );
  return { malote, items: itemsWithOC };
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

// ─── Ranking por Centro de Custo ─────────────────────────────────────────────
export async function getRankingByCostCenter(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Busca todas as solicitações do mês (excluindo canceladas e rascunhos)
  const requests = await db
    .select({
      costCenterCode: purchaseRequests.costCenterCode,
      costCenterId: purchaseRequests.costCenterId,
      department: purchaseRequests.department,
      totalEstimatedValue: purchaseRequests.totalEstimatedValue,
      status: purchaseRequests.status,
    })
    .from(purchaseRequests)
    .where(
      and(
        gte(purchaseRequests.createdAt, startDate),
        lte(purchaseRequests.createdAt, endDate),
        sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
      )
    );

  // Busca nomes dos centros de custo
  const ccList = await db.select().from(costCenters);
  const ccMap = new Map(ccList.map(cc => [cc.code, cc.name]));

  // Agrupa por centro de custo
  const grouped = new Map<string, { label: string; total: number; count: number }>();
  for (const req of requests) {
    const key = req.costCenterCode ?? req.department ?? "Sem Centro de Custo";
    const label = req.costCenterCode
      ? (ccMap.get(req.costCenterCode) ?? req.costCenterCode)
      : (req.department ?? "Sem Centro de Custo");
    if (!grouped.has(key)) grouped.set(key, { label, total: 0, count: 0 });
    const entry = grouped.get(key)!;
    entry.total += parseFloat(req.totalEstimatedValue ?? "0");
    entry.count++;
  }

  // Calcula trend dos 3 meses (m-2, m-1, m)
  const months3 = [-2, -1, 0].map(offset => {
    let m = month + offset;
    let y = year;
    if (m <= 0) { m += 12; y--; }
    return { y, m };
  });
  const [totalsM2, totalsM1] = await Promise.all([
    getCCTotalsForMonth(db, months3[0].y, months3[0].m),
    getCCTotalsForMonth(db, months3[1].y, months3[1].m),
  ]);

  return Array.from(grouped.entries())
    .map(([code, { label, total, count }]) => ({
      code,
      label,
      total: Math.round(total * 100) / 100,
      count,
      trend: [
        Math.round((totalsM2.get(code) ?? 0) * 100) / 100,
        Math.round((totalsM1.get(code) ?? 0) * 100) / 100,
        Math.round(total * 100) / 100,
      ],
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // top 10
}

// ─── Helper: total por CC em um mês específico ───────────────────────────────
async function getCCTotalsForMonth(db: any, year: number, month: number): Promise<Map<string, number>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const rows = await db
    .select({
      costCenterCode: purchaseRequests.costCenterCode,
      department: purchaseRequests.department,
      totalEstimatedValue: purchaseRequests.totalEstimatedValue,
    })
    .from(purchaseRequests)
    .where(
      and(
        gte(purchaseRequests.createdAt, startDate),
        lte(purchaseRequests.createdAt, endDate),
        sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
      )
    );
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.costCenterCode ?? r.department ?? "Sem Centro de Custo";
    map.set(key, (map.get(key) ?? 0) + parseFloat(r.totalEstimatedValue ?? "0"));
  }
  return map;
}

// ─── Helper: total por item em um mês específico ──────────────────────────────
async function getItemTotalsForMonth(db: any, year: number, month: number): Promise<Map<string, number>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const requests = await db
    .select({ id: purchaseRequests.id })
    .from(purchaseRequests)
    .where(
      and(
        gte(purchaseRequests.createdAt, startDate),
        lte(purchaseRequests.createdAt, endDate),
        sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
      )
    );
  if (requests.length === 0) return new Map();
  const items = await db
    .select()
    .from(requestItems)
    .where(inArray(requestItems.requestId, requests.map((r: any) => r.id)));
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.description.toLowerCase().trim();
    map.set(key, (map.get(key) ?? 0) + parseFloat(item.totalPrice ?? item.unitPrice ?? "0"));
  }
  return map;
}

// ─── Ranking por Bem/Item ─────────────────────────────────────────────────────
export async function getRankingByItem(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // Busca IDs das solicitações do mês (excluindo canceladas e rascunhos)
  const requests = await db
    .select({ id: purchaseRequests.id })
    .from(purchaseRequests)
    .where(
      and(
        gte(purchaseRequests.createdAt, startDate),
        lte(purchaseRequests.createdAt, endDate),
        sql`${purchaseRequests.status} NOT IN ('cancelada', 'rascunho')`
      )
    );

  if (requests.length === 0) return [];

  const requestIds = requests.map(r => r.id);

  // Busca todos os itens dessas solicitações
  const items = await db
    .select()
    .from(requestItems)
    .where(inArray(requestItems.requestId, requestIds));

  // Agrupa por descrição do item (normaliza para lowercase)
  const grouped = new Map<string, { label: string; total: number; quantity: number; count: number }>();
  for (const item of items) {
    const key = item.description.toLowerCase().trim();
    if (!grouped.has(key)) grouped.set(key, { label: item.description, total: 0, quantity: 0, count: 0 });
    const entry = grouped.get(key)!;
    entry.total += parseFloat(item.totalPrice ?? item.unitPrice ?? "0");
    entry.quantity += parseFloat(item.quantity ?? "1");
    entry.count++;
  }

  // Calcula trend dos 3 meses (m-2, m-1, m)
  const months3 = [-2, -1, 0].map(offset => {
    let m = month + offset;
    let y = year;
    if (m <= 0) { m += 12; y--; }
    return { y, m };
  });
  const [itemsM2, itemsM1] = await Promise.all([
    getItemTotalsForMonth(db, months3[0].y, months3[0].m),
    getItemTotalsForMonth(db, months3[1].y, months3[1].m),
  ]);

  return Array.from(grouped.entries())
    .map(([key, { label, total, quantity, count }]) => ({
      label,
      total: Math.round(total * 100) / 100,
      quantity: Math.round(quantity * 100) / 100,
      count,
      trend: [
        Math.round((itemsM2.get(key) ?? 0) * 100) / 100,
        Math.round((itemsM1.get(key) ?? 0) * 100) / 100,
        Math.round(total * 100) / 100,
      ],
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // top 10
}

export async function deletePurchaseRequest(
  id: number,
  requesterId: number,
  isAdmin: boolean
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id)).limit(1);
  if (!request) return { success: false, error: "Solicitação não encontrada" };

  if (request.status !== "cancelada") {
    return { success: false, error: "Apenas solicitações canceladas podem ser excluídas" };
  }

  if (!isAdmin && request.requesterId !== requesterId) {
    return { success: false, error: "Sem permissão para excluir esta solicitação" };
  }

  await db.delete(requestItems).where(eq(requestItems.requestId, id));
  await db.delete(approvalHistory).where(eq(approvalHistory.requestId, id));
  await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));

  return { success: true };
}

// ─── AI Budget Analysis ────────────────────────────────────────────────────────────────────────────────

export async function saveBudgetAnalysis(requestId: number, analysisJson: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db
    .update(purchaseRequests)
    .set({ aiAnalysis: analysisJson, updatedAt: new Date() })
    .where(eq(purchaseRequests.id, requestId));
}

export async function getBudgetAnalysis(requestId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ aiAnalysis: purchaseRequests.aiAnalysis })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);
  return row?.aiAnalysis ?? null;
}

export async function getCompletedRequestsWithItems() {
  const db = await getDb();
  if (!db) return [];

  const reqs = await db
    .select({
      id: purchaseRequests.id,
      application: purchaseRequests.application,
      totalValue: purchaseRequests.totalEstimatedValue,
    })
    .from(purchaseRequests)
    .where(inArray(purchaseRequests.status, [
      "aguardando_aprovacao_compra",
      "aguardando_comprovante_pagamento",
      "aguardando_verificacao_compras",
      "concluida",
    ] as any[]))
    .orderBy(desc(purchaseRequests.createdAt))
    .limit(200);
  if (reqs.length === 0) return [];

  const reqIds = reqs.map(r => r.id);
  const items = await db
    .select({
      requestId: requestItems.requestId,
      description: requestItems.description,
      quantity: requestItems.quantity,
      unitPrice: requestItems.unitPrice,
      totalPrice: requestItems.totalPrice,
    })
    .from(requestItems)
    .where(inArray(requestItems.requestId, reqIds));

  const itemsByRequest = new Map<number, typeof items>();
  for (const item of items) {
    if (!itemsByRequest.has(item.requestId)) itemsByRequest.set(item.requestId, []);
    itemsByRequest.get(item.requestId)!.push(item);
  }

  return reqs.map(r => ({
    ...r,
    items: itemsByRequest.get(r.id) ?? [],
  }));
}

// ─── Update Purchase Request (edição com reinício de aprovação) ────────────────

/** Status que permitem edição (até o orçamento ser enviado) */
const EDITABLE_STATUSES = [
  "aguardando_gerente",
  "aguardando_orcamento",
  "rejeitada",
] as const;

export async function updatePurchaseRequest(
  requestId: number,
  editorId: number,
  editorName: string,
  input: {
    department: string;
    costCenterId?: number;
    costCenterCode?: string;
    application: string;
    urgencyLevel: "normal" | "urgente" | "emergencial";
    observations?: string;
    osMyfarm?: string;
    items: Array<{ description: string; quantity: string; unit: string; unitPrice?: string }>;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) return { success: false, error: "Solicitação não encontrada" };

  if (!EDITABLE_STATUSES.includes(request.status as any)) {
    return { success: false, error: `Solicitações com status "${request.status}" não podem ser editadas. Apenas solicitações aguardando gerente, aguardando orçamento ou rejeitadas podem ser editadas.` };
  }

  // Recalcular total
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }

  const deadlineAt = getDeadlineDate(input.urgencyLevel);
  const stepDeadlineAt = getStepDeadline();

  // Atualizar a solicitação e reiniciar o fluxo de aprovação
  await db.update(purchaseRequests)
    .set({
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
      updatedAt: new Date(),
    })
    .where(eq(purchaseRequests.id, requestId));

  // Substituir itens: deletar os antigos e inserir os novos
  await db.delete(requestItems).where(eq(requestItems.requestId, requestId));
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null,
    });
  }

  // Registrar no histórico
  await db.insert(approvalHistory).values({
    requestId,
    userId: editorId,
    userName: editorName,
    step: "edicao",
    action: "editada",
    comment: `Solicitação editada por ${editorName}. Processo de aprovação reiniciado. Novo prazo: ${deadlineAt.toLocaleDateString("pt-BR")}`,
  });

  // Notificar aprovadores via WhatsApp
  try {
    // Todos os pedidos (incluindo urgentes/emergenciais) reiniciam pelo Gerente após edição.
    // Fluxo urgente/emergencial: Gerente → Orçamento → Diretoria → Controladoria
    const approverRole = "gerente";
    const stepLabel = "Gerente de Unidade";
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
    const uniqueApprovers = [...new Map(approvers.map(a => [a.id, a])).values()];
    for (const approver of uniqueApprovers) {
      if (approver.phone) {
        await WA.notifyNewRequest({
          approverPhone: approver.phone,
          approverName: approver.name ?? "Aprovador",
          requestNumber: request.requestNumber,
          requestId,
          requesterName: request.requesterName,
          application: input.application,
          urgencyLevel: input.urgencyLevel,
          department: input.department,
          stepLabel,
        });
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to notify approvers after edit:", e);
  }

  return { success: true };
}

// ─── Edição pela Controladoria (sem reiniciar fluxo) ─────────────────────────
// Permite que usuários com role controladoria editem dados da solicitação
// sem alterar o status atual — a solicitação permanece na etapa em que está.
export async function updateByControladoria(
  requestId: number,
  editorId: number,
  editorName: string,
  input: {
    department: string;
    costCenterId?: number;
    costCenterCode?: string;
    application: string;
    urgencyLevel: "normal" | "urgente" | "emergencial";
    observations?: string;
    osMyfarm?: string;
    items: Array<{ description: string; quantity: string; unit: string; unitPrice?: string }>;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) return { success: false, error: "Solicitação não encontrada" };

  // Só permite edição quando está na etapa da controladoria
  if (request.status !== "aguardando_controladoria") {
    return {
      success: false,
      error: `Esta edição só pode ser feita quando a solicitação está na etapa da Controladoria. Status atual: "${request.status}"`,
    };
  }

  // Recalcular total
  let total = 0;
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    total += qty * price;
  }

  // Atualizar apenas os dados da solicitação — NÃO altera o status
  await db.update(purchaseRequests)
    .set({
      department: input.department,
      costCenterId: input.costCenterId ?? null,
      costCenterCode: input.costCenterCode ?? null,
      application: input.application,
      urgencyLevel: input.urgencyLevel,
      observations: input.observations ?? null,
      osMyfarm: input.osMyfarm ?? null,
      totalEstimatedValue: total > 0 ? String(total) : null,
      // status NÃO é alterado — permanece "aguardando_controladoria"
      updatedAt: new Date(),
    })
    .where(eq(purchaseRequests.id, requestId));

  // Substituir itens: deletar os antigos e inserir os novos
  await db.delete(requestItems).where(eq(requestItems.requestId, requestId));
  for (const item of input.items) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice ?? "0") || 0;
    await db.insert(requestItems).values({
      requestId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? null,
      totalPrice: price > 0 ? String(qty * price) : null,
    });
  }

  // Registrar no histórico
  await db.insert(approvalHistory).values({
    requestId,
    userId: editorId,
    userName: editorName,
    step: "edicao",
    action: "editada",
    comment: `Dados editados pela Controladoria (${editorName}). O fluxo de aprovação não foi reiniciado.`,
  });

  return { success: true };
}

// ─── Safras (Harvests) ────────────────────────────────────────────────────────
export async function listHarvests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(harvests).orderBy(desc(harvests.createdAt));
}

export async function createHarvest(data: { name: string; year: string; startDate?: string; endDate?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(harvests).values({
    name: data.name,
    year: data.year,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    active: true,
  });
  return { id: (result as any).insertId };
}

export async function updateHarvest(id: number, data: Partial<{ name: string; year: string; startDate: string; endDate: string; active: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(harvests).set({ ...data, updatedAt: new Date() }).where(eq(harvests.id, id));
  return { success: true };
}

export async function deleteHarvest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(harvests).where(eq(harvests.id, id));
  return { success: true };
}

// ─── Orçamentos (Budgets) ─────────────────────────────────────────────────────
export async function listBudgets(harvestId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (harvestId) {
    return db.select().from(budgets).where(eq(budgets.harvestId, harvestId)).orderBy(budgets.costCenterCode);
  }
  return db.select().from(budgets).orderBy(desc(budgets.createdAt));
}

export async function createBudget(data: {
  harvestId: number;
  costCenterId?: number;
  costCenterCode?: string;
  costCenterName?: string;
  category?: string;
  totalValue: string;
  notes?: string;
  createdBy?: string;
}) {
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
    createdBy: data.createdBy ?? null,
  });
  return { id: (result as any).insertId };
}

export async function updateBudget(id: number, data: Partial<{
  harvestId: number;
  costCenterId: number;
  costCenterCode: string;
  costCenterName: string;
  category: string;
  totalValue: string;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(budgets).set({ ...data, updatedAt: new Date() }).where(eq(budgets.id, id));
  return { success: true };
}

export async function deleteBudget(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(budgets).where(eq(budgets.id, id));
  return { success: true };
}

// Desconta valor do orçamento (chamado quando financeiro insere comprovante de pagamento)
export async function deductFromBudget(params: {
  costCenterId?: number;
  costCenterCode?: string;
  amount: string;
}) {
  const db = await getDb();
  if (!db) return { success: true, deducted: false };
  const amount = parseFloat(params.amount) || 0;
  if (amount <= 0) return { success: true, deducted: false };

  let rows: any[] = [];
  if (params.costCenterId) {
    rows = await db.select().from(budgets).where(eq(budgets.costCenterId, params.costCenterId)).orderBy(desc(budgets.createdAt)).limit(1);
  } else if (params.costCenterCode) {
    rows = await db.select().from(budgets).where(eq(budgets.costCenterCode, params.costCenterCode)).orderBy(desc(budgets.createdAt)).limit(1);
  }
  if (!rows || rows.length === 0) return { success: true, deducted: false };

  const budget = rows[0];
  const currentUsed = parseFloat(budget.usedValue) || 0;
  const newUsed = (currentUsed + amount).toFixed(2);
  await db.update(budgets).set({ usedValue: newUsed, updatedAt: new Date() }).where(eq(budgets.id, budget.id));
  return { success: true, deducted: true, budgetId: budget.id };
}

// Retorna resumo de todos os orçamentos para o dashboard
export async function getBudgetSummary() {
  const db = await getDb();
  if (!db) return { budgets: [], harvests: [] };
  const allBudgets = await db.select().from(budgets).orderBy(desc(budgets.createdAt));
  const allHarvests = await db.select().from(harvests).where(eq(harvests.active, true)).orderBy(desc(harvests.createdAt));
  return { budgets: allBudgets, harvests: allHarvests };
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from "crypto";

/** Gera uma nova API Key no formato cgsk_<random32hex> */
function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = "cgsk_" + randomBytes(24).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.substring(0, 12); // "cgsk_" + 7 chars
  return { raw, hash, prefix };
}

export async function listApiKeys(): Promise<Omit<ApiKey, "keyHash">[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  // Nunca retornar o hash completo — apenas o prefixo para identificação
  return rows.map(({ keyHash: _kh, ...rest }) => rest);
}

export async function createApiKey(params: {
  name: string;
  description?: string;
  permissions?: string[];
  expiresAt?: Date;
  createdById: number;
  createdByName: string;
}): Promise<{ id: number; key: string; prefix: string; name: string }> {
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
    active: true,
  });

  const insertId = (result as any)[0]?.insertId ?? 0;

  console.log(`[ApiKey] Nova chave criada: ${prefix}... por ${params.createdByName}`);

  // Retornar a chave em texto puro APENAS neste momento (nunca mais será exibida)
  return { id: insertId, key: raw, prefix, name: params.name };
}

export async function revokeApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(apiKeys).set({ active: false, updatedAt: new Date() }).where(eq(apiKeys.id, id));
  return { success: true };
}

export async function deleteApiKey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return { success: true };
}

/** Valida uma API Key recebida em requisições externas. Retorna os dados da chave se válida. */
export async function validateApiKey(rawKey: string): Promise<Omit<ApiKey, "keyHash"> | null> {
  const db = await getDb();
  if (!db) return null;

  const hash = createHash("sha256").update(rawKey).digest("hex");
  const rows = await db.select().from(apiKeys).where(
    and(eq(apiKeys.keyHash, hash), eq(apiKeys.active, true))
  ).limit(1);

  if (!rows || rows.length === 0) return null;

  const key = rows[0];

  // Verificar expiração
  if (key.expiresAt && new Date() > new Date(key.expiresAt)) {
    console.log(`[ApiKey] Chave expirada: ${key.keyPrefix}...`);
    return null;
  }

  // Atualizar lastUsedAt
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

  const { keyHash: _kh, ...rest } = key;
  return rest;
}
