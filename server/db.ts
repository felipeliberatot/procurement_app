import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvalHistory,
  assets,
  costCenters,
  InsertUser,
  purchaseRequests,
  requestItems,
  users,
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    await db.update(users).set({
      name: data.name,
      email: data.email ?? null,
      procurementRole: data.procurementRole as User["procurementRole"],
      department: data.department ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle ?? null,
      approvalLevel: (data.approvalLevel ?? "nenhum") as User["approvalLevel"],
      active: data.active ?? true,
    }).where(eq(users.id, data.id));
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

function generateRequestNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `REQ-${y}${m}${d}-${rand}`;
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

  const requestNumber = generateRequestNumber();
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
    const approvers = await db.select().from(users).where(eq(users.procurementRole, "gerente" as any));
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
          stepLabel: "Gerente de Unidade",
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

  return { total: all.length, pending, approved, rejected, urgent, emergency };
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
}
