import { desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvalHistory,
  assets,
  costCenters,
  InsertUser,
  maloteItems,
  maloteTagLinks,
  maloteTags,
  malotes,
  purchaseRequests,
  requestItems,
  units,
  users,
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
    const approvers = await db.select().from(users).where(eq(users.procurementRole, approverRole as any));
    for (const approver of approvers) {
      if (approver.phone) {
        await WA.notifyNewRequest({
          approverPhone: approver.phone,
          approverName: approver.name ?? "Aprovador",
          requestNumber,
          requestId: insertId,
          requesterName: user.name ?? "Usuário",
          application: input.application,
          urgencyLevel: input.urgencyLevel,
          department: input.department,
          stepLabel,
        });
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

  const statusMap: Record<string, string> = {
    gerente: "aguardando_gerente",
    orcamento: "aguardando_orcamento",
    controladoria: "aguardando_controladoria",
    diretoria: "aguardando_diretoria",
    financeiro: "aguardando_financeiro",
  };

  const status = statusMap[role];
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
  const rejected = all.filter(r => r.status === "rejeitada" || r.status === "cancelada").length;
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
  return { total: all.length, pending, approved, rejected, urgent, emergency, expiringSoon };
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
  aguardando_gerente: { step: "gerente", nextStatus: "aguardando_orcamento", action: "aprovada" },
  aguardando_orcamento: { step: "orcamento", nextStatus: "aguardando_controladoria", action: "aprovada" },
  aguardando_controladoria: { step: "controladoria", nextStatus: "aguardando_diretoria", action: "aprovada" },
  aguardando_diretoria: { step: "diretoria", nextStatus: "aguardando_ordem_compra", action: "aprovada" },
  aguardando_ordem_compra: { step: "ordem_compra", nextStatus: "aguardando_financeiro", action: "ordem_emitida" },
  aguardando_financeiro: { step: "financeiro", nextStatus: "concluida", action: "pagamento_realizado" },
};

const REJECT_FLOW: Record<string, string> = {
  aguardando_gerente: "aguardando_gerente",
  aguardando_orcamento: "aguardando_orcamento",
  aguardando_controladoria: "aguardando_orcamento",
  aguardando_diretoria: "aguardando_controladoria",
  aguardando_ordem_compra: "aguardando_diretoria",
  aguardando_financeiro: "aguardando_ordem_compra",
};

export async function approveRequest(
  requestId: number,
  user: User,
  data: { comment?: string; purchaseOrderNumber?: string; paymentInfo?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");

  const flow = STEP_FLOW[request.status];
  if (!flow) throw new Error("Ação não permitida neste status");

  const updateData: Record<string, unknown> = {
    status: flow.nextStatus,
    stepDeadlineAt: getStepDeadline(),
  };
  if (data.purchaseOrderNumber) updateData.purchaseOrderNumber = data.purchaseOrderNumber;
  if (data.paymentInfo) updateData.paymentInfo = data.paymentInfo;

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

    if (flow.nextStatus === "aguardando_orcamento" && requester?.phone) {
      // Notify requester to attach budget
      await WA.notifyBudgetRequired({
        requesterPhone: requester.phone,
        requesterName: requester.name ?? "Solicitante",
        requestNumber: req.requestNumber,
        requestId,
      });
    } else if (flow.nextStatus === "concluida" && requester?.phone) {
      // Notify completion
      await WA.notifyApproval({
        requesterPhone: requester.phone,
        requesterName: requester.name ?? "Solicitante",
        requestNumber: req.requestNumber,
        requestId,
        approverName: user.name ?? "Aprovador",
        stepLabel: STEP_LABELS_SERVER[request.status] ?? request.status,
      });
    } else {
      // Notify requester of progress
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
      // Notify next approvers
      const nextRoleMap: Record<string, string> = {
        aguardando_orcamento: "orcamento",
        aguardando_controladoria: "controladoria",
        aguardando_diretoria: "diretoria",
        aguardando_ordem_compra: "financeiro",
        aguardando_financeiro: "financeiro",
      };
      const nextRole = nextRoleMap[flow.nextStatus];
      if (nextRole && req) {
        const nextApprovers = await db.select().from(users).where(eq(users.procurementRole, nextRole as any));
        const items = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
        const itemsForMsg = items.map(it => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));
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
              stepLabel: STEP_LABELS_SERVER[flow.nextStatus] ?? flow.nextStatus,
              step: nextRole,
              items: itemsForMsg,
              totalValue: req.totalEstimatedValue ?? undefined,
            });
          }
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

  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: (flow?.step ?? "gerente") as any,
    action: "rejeitada",
    comment,
  });

  // Notify requester of rejection via WhatsApp
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq(users.id, req.requesterId)).limit(1);
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
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send rejection notification:", e);
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
