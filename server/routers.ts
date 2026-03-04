import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Management ───────────────────────────────────────────────────────
  users: router({
    list: protectedProcedure.query(() => db.listUsers()),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getUserById(input.id)),
    updateProfile: protectedProcedure
      .input(z.object({
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"]).optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
      }))
      .mutation(({ ctx, input }) => db.updateUserProfile(ctx.user.id, input)),
    upsertByAdmin: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"]),
        extraRoles: z.array(z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"])).optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
        extraApprovalLevels: z.array(z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"])).optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        const callerId = ctx.user.id;
        // Non-masters can only edit their own profile, and only specific fields
        if (!callerIsMaster) {
          if (!input.id || input.id !== callerId) {
            throw new Error("Apenas usuários master podem criar ou editar outros usuários.");
          }
          // Non-master editing own profile: only password is allowed (handled via resetPassword route)
          // Block any attempt to change name, email, role, approvalLevel, active status
          throw new Error("Para alterar sua senha, use a opção de redefinição de senha.");
        }
        // Only masters can assign or change the 'master' approval level
        if (input.approvalLevel === "master" && !callerIsMaster) {
          throw new Error("Apenas usuários master podem atribuir o nível master.");
        }
        // Only masters can edit another master user
        if (input.id) {
          const target = await db.getUserById(input.id);
          if (target?.approvalLevel === "master" && !callerIsMaster) {
            throw new Error("Apenas usuários master podem editar outro usuário master.");
          }
        }
        const result = await db.upsertUserByAdmin(input);
        // Send welcome email for new users (no id = new user)
        if (!input.id && input.email) {
          try {
            const { sendWelcomeEmail } = await import("./email");
            await sendWelcomeEmail({
              toEmail: input.email,
              toName: input.name,
              jobTitle: input.jobTitle,
            });
          } catch (e) {
            console.warn("[Email] Welcome email failed (non-critical):", e);
          }
        }
        // Send WhatsApp welcome notification for new users with phone
        if (!input.id && input.phone) {
          try {
            const { notifyNewUserRegistration } = await import("./whatsapp");
            await notifyNewUserRegistration({
              userPhone: input.phone,
              userName: input.name,
              userEmail: input.email || undefined,
              jobTitle: input.jobTitle || undefined,
              registeredByName: (ctx.user as any)?.name || "Administrador",
            });
          } catch (e) {
            console.warn("[WhatsApp] Welcome notification failed (non-critical):", e);
          }
        }
        return result;
      }),
    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        const target = await db.getUserById(input.id);
        if (target?.approvalLevel === "master" && !callerIsMaster) {
          throw new Error("Apenas usuários master podem ativar/desativar outro usuário master.");
        }
        return db.toggleUserActive(input.id, input.active);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteUser(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        users: z.array(z.object({
          name: z.string().min(1),
          email: z.string().optional(),
          phone: z.string().optional(),
          department: z.string().optional(),
          procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento"]),
        }))
      }))
      .mutation(({ input }) => db.importUsersBatch(input.users)),
    verifyPin: protectedProcedure
      .input(z.object({ pin: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!callerIsMaster) throw new Error("Apenas usuários master podem usar o PIN.");
        const valid = await db.verifyMasterPin(ctx.user.id, input.pin);
        return { valid };
      }),
    updatePin: protectedProcedure
      .input(z.object({ currentPin: z.string().min(1), newPin: z.string().min(4) }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!callerIsMaster) throw new Error("Apenas usuários master podem alterar o PIN.");
        const valid = await db.verifyMasterPin(ctx.user.id, input.currentPin);
        if (!valid) throw new Error("PIN atual incorreto.");
        await db.updateMasterPin(ctx.user.id, input.newPin);
        return { success: true };
      }),
    resetPassword: protectedProcedure
      .input(z.object({
        userId: z.number(),
        newPassword: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins and masters can reset passwords
        const callerRole = (ctx.user as any)?.procurementRole;
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        const isAdmin = callerRole === "admin" || callerIsMaster;
        if (!isAdmin) throw new Error("Apenas administradores podem redefinir senhas.");
        // Masters can reset any user; admins cannot reset master users
        const target = await db.getUserById(input.userId);
        if (!target) throw new Error("Usuário não encontrado.");
        if (target.approvalLevel === "master" && !callerIsMaster) {
          throw new Error("Apenas usuários master podem redefinir a senha de outro master.");
        }
        const bcrypt = await import("bcryptjs");
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await db.updateUserPassword(input.userId, passwordHash);
        return { success: true };
      }),
    testWhatsApp: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!callerIsMaster) throw new Error("Apenas usuários master podem enviar mensagens de teste.");
        const target = await db.getUserById(input.userId);
        if (!target) throw new Error("Usuário não encontrado.");
        if (!target.phone) throw new Error("Este usuário não possui telefone cadastrado.");
        const { sendWhatsAppTestMessage } = await import("./whatsapp");
        const sent = await sendWhatsAppTestMessage({
          phone: target.phone,
          userName: target.name ?? "Usuário",
          senderName: (ctx.user as any)?.name ?? "Administrador",
        });
        return { success: sent, phone: target.phone };
      }),
  }),

  // ─── Cost Centers ──────────────────────────────────────────────────────────
  costCenters: router({
    list: protectedProcedure.query(() => db.listCostCenters()),
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        responsible: z.string().optional(),
      }))
      .mutation(({ input }) => db.createCostCenter(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().optional(),
        responsible: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => db.updateCostCenter(input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCostCenter(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          responsible: z.string().optional(),
        }))
      }))
      .mutation(({ input }) => db.importCostCentersBatch(input.rows)),
  }),

  // ─── Assets ────────────────────────────────────────────────────────────────
  assets: router({
    list: protectedProcedure.query(() => db.listAssets()),
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        description: z.string().min(1),
        category: z.string().optional(),
        location: z.string().optional(),
      }))
      .mutation(({ input }) => db.createAsset(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        location: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => db.updateAsset(input.id, input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteAsset(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          code: z.string().min(1),
          description: z.string().min(1),
          category: z.string().optional(),
          location: z.string().optional(),
        }))
      }))
      .mutation(({ input }) => db.importAssetsBatch(input.rows)),
  }),

  // ─── Purchase Requests ─────────────────────────────────────────────────────
  requests: router({
    create: protectedProcedure
      .input(z.object({
        department: z.string().min(1),
        costCenterId: z.number().optional(),
        costCenterCode: z.string().optional(),
        application: z.string().min(1),
        urgencyLevel: z.enum(["normal", "urgente", "emergencial"]),
        observations: z.string().optional(),
        osMyfarm: z.string().optional(),
        items: z.array(z.object({
          description: z.string().min(1),
          quantity: z.string(),
          unit: z.string().default("un"),
          unitPrice: z.string().optional(),
        })).min(1),
      }))
      .mutation(({ ctx, input }) => db.createPurchaseRequest(ctx.user, input)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getPurchaseRequestWithDetails(input.id)),

    myRequests: protectedProcedure.query(({ ctx }) =>
      db.getRequestsByRequester(ctx.user.id)
    ),

    pendingForMe: protectedProcedure.query(({ ctx }) => {
      const user = ctx.user as any;

      // Usuário master vê TODAS as solicitações pendentes de qualquer etapa de aprovação
      const isMaster = user.approvalLevel === "master";
      if (isMaster) {
        return db.getPendingRequestsForUser("master", []);
      }

      // Combinar papel primário + extras (approvalLevel e extraApprovalLevels também contam)
      const extraRoles: string[] = [];
      if (user.extraRoles) {
        try { extraRoles.push(...JSON.parse(user.extraRoles)); } catch {}
      }
      if (user.approvalLevel && user.approvalLevel !== "nenhum" && user.approvalLevel !== "master") {
        extraRoles.push(user.approvalLevel);
      }
      if (user.extraApprovalLevels) {
        try {
          const levels = JSON.parse(user.extraApprovalLevels);
          extraRoles.push(...levels.filter((l: string) => l !== "nenhum" && l !== "master"));
        } catch {}
      }
      return db.getPendingRequestsForUser(ctx.user.procurementRole, extraRoles);
    }),

    all: protectedProcedure
      .input(z.object({ department: z.string().optional() }).optional())
      .query(({ input }) => db.getAllRequests(input?.department)),

    dashboardStats: protectedProcedure.query(({ ctx }) =>
      db.getDashboardStats(ctx.user.id, ctx.user.procurementRole)
    ),
    approvalTimingStats: protectedProcedure.query(() =>
      db.getApprovalTimingStats()
    ),

    monthlyReport: protectedProcedure
      .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
      .query(({ input }) => db.getMonthlyReport(input.year, input.month)),
    rankingByCostCenter: protectedProcedure
      .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
      .query(({ input }) => db.getRankingByCostCenter(input.year, input.month)),
    rankingByItem: protectedProcedure
      .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
      .query(({ input }) => db.getRankingByItem(input.year, input.month)),

    history: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(({ input }) => db.getApprovalHistory(input.requestId)),

    uploadBudget: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        fileUrl: z.string().url(),
      }))
      .mutation(({ ctx, input }) =>
        db.attachBudget(input.requestId, ctx.user.id, ctx.user.name ?? "Usuário", input.fileUrl)
      ),

    // Upload PDF as base64, store in S3, return public URL
    uploadFile: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        fileName: z.string(),
        base64: z.string(), // base64-encoded file content
        mimeType: z.string().default("application/pdf"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `budgets/${input.requestId}/${Date.now()}_${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Attach the budget URL to the request (passa fileName para rastreabilidade no histórico)
        await db.attachBudget(input.requestId, ctx.user.id, ctx.user.name ?? "Usuário", url, input.fileName);
        return { url };
      }),

    // Upload comprovante de pagamento (Financeiro)
    uploadPaymentProof: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        fileName: z.string(),
        base64: z.string(),
        mimeType: z.string().default("application/pdf"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `payment-proofs/${input.requestId}/${Date.now()}_${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.attachPaymentProof(input.requestId, url);
        return { url };
      }),

    // Upload nota fiscal (Compras - verificação final)
    uploadInvoice: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        fileName: z.string(),
        base64: z.string(),
        mimeType: z.string().default("application/pdf"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `invoices/${input.requestId}/${Date.now()}_${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.attachInvoice(input.requestId, url);
        return { url };
      }),

    uploadOCSiagri: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        fileName: z.string(),
        base64: z.string(),
        mimeType: z.string().default("application/pdf"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `oc-siagri/${input.requestId}/${Date.now()}_${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.attachOCSiagri(input.requestId, url);
        return { url };
      }),

    // Enviar orçamento (Orçamento - avança para Controladoria após anexar PDF)
    submitBudget: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(({ ctx, input }) => db.submitBudget(input.requestId, ctx.user)),

    // Finalizar OC (Compras - encerra o fluxo e habilita nos Malotes)
    finalizeOC: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(({ ctx, input }) => db.finalizeOC(input.requestId, ctx.user)),

    // Cancelar solicitação (somente solicitante ou master)
    cancel: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        reason: z.string().min(1, "O motivo do cancelamento é obrigatório."),
      }))
      .mutation(({ ctx, input }) => db.cancelRequest(input.requestId, ctx.user as any, input.reason)),

    reopen: protectedProcedure
      .input(z.object({
        requestId: z.number(),
      }))
      .mutation(({ ctx, input }) => {
        const user = ctx.user as any;
        if (user.approvalLevel !== "master") throw new Error("Apenas usuários master podem reabrir solicitações.");
        return db.reopenRequest(input.requestId, user.id, user.name);
      }),

    // Listar todas as solicitações (somente master)
    allForMaster: protectedProcedure.query(({ ctx }) => {
      const isMaster = (ctx.user as any).approvalLevel === "master";
      if (!isMaster) throw new Error("Acesso restrito a usuários master.");
      return db.getAllRequests();
    }),
  }),

  // ─── Approvals ─────────────────────────────────────────────────────────────
  approvals: router({
    approve: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        comment: z.string().optional(),
        purchaseOrderNumber: z.string().optional(),
        paymentInfo: z.string().optional(),
        paymentMethod: z.enum(["pix", "boleto", "cartao_avista", "cartao_parcelado"]).optional(),
        paymentObservations: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.approveRequest(input.requestId, ctx.user, input)
      ),

    reject: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        comment: z.string().min(1, "Justificativa obrigatória"),
      }))
      .mutation(({ ctx, input }) =>
        db.rejectRequest(input.requestId, ctx.user, input.comment)
      ),
  }),

  // ─── WhatsApp Configuration ────────────────────────────────────────────────
  whatsapp: router({
    status: protectedProcedure.query(async () => {
      const { getProviderInfo, isConfigured } = await import("./whatsapp");
      return getProviderInfo();
    }),

    testSend: protectedProcedure
      .input(z.object({
        phone: z.string().min(8),
        message: z.string().min(1).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sendSimpleWhatsApp } = await import("./whatsapp");
        const msg = input.message ?? `✅ Teste de notificação CGS Agrícola\n\nOlá, *${ctx.user.name ?? "Usuário"}*!\n\nSua integração com WhatsApp está funcionando corretamente.\n\n_Sistema de Compras CGS Agrícola_`;
        const ok = await sendSimpleWhatsApp(input.phone, msg);
        if (!ok) throw new Error("Falha ao enviar mensagem. Verifique as configurações do provedor.");
        return { success: true };
      }),

    notifyApproversNow: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Manually re-trigger notifications for a pending request
        const [req] = await (await db.getDb() as any)
          .select()
          .from((await import("../drizzle/schema")).purchaseRequests)
          .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).purchaseRequests.id, input.requestId))
          .limit(1);
        if (!req) throw new Error("Solicitação não encontrada");

        const { notifyApproverWithToken } = await import("./whatsapp");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");

        const roleMap: Record<string, string> = {
          aguardando_gerente: "gerente",
          aguardando_orcamento: "orcamento",
          aguardando_controladoria: "controladoria",
          aguardando_diretoria: "diretoria",
          aguardando_ordem_compra: "orcamento",           // Fluxo 06: Emissão de OC → Orçamento
          aguardando_comprovante_pagamento: "financeiro",  // Fluxo 07: Comprovante → Financeiro
          aguardando_verificacao_compras: "orcamento",    // Fluxo 08: Verificação Final → Orçamento
        };
        const role = roleMap[req.status];
        if (!role) throw new Error("Solicitação não está em etapa pendente de aprovação");

        const { or: orOp, and: andOp } = await import("drizzle-orm");
        const approversRaw = await dbConn.select().from(users).where(
          andOp(
            eq(users.active, true),
            orOp(
              eq(users.procurementRole, role as any),
              eq(users.approvalLevel, role as any),
            ),
          )
        );
        const approvers = [...new Map(approversRaw.map((a: any) => [a.id, a])).values()];
        let sent = 0;
        for (const approver of approvers) {
          if (approver.phone) {
            await notifyApproverWithToken({
              approverPhone: approver.phone,
              approverName: approver.name ?? "Aprovador",
              approverId: approver.id,
              requestNumber: req.requestNumber,
              requestId: req.id,
              requesterName: req.requesterName,
              application: req.application,
              urgencyLevel: req.urgencyLevel,
              department: req.department,
              stepLabel: role,
              step: role,
              totalValue: req.totalEstimatedValue ?? undefined,
            });
            sent++;
          }
        }
        return { sent, approversFound: approvers.length };
      }),
  }),


  // ─── Units / Unidades ─────────────────────────────────────────────────────────
  units: router({
    list: protectedProcedure.query(() => db.listUnits()),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
      }))
      .mutation(({ input }) => db.createUnit(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateUnit(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteUnit(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          responsibleName: z.string().optional(),
          responsiblePhone: z.string().optional(),
        }))
      }))
      .mutation(({ input }) => db.importUnitsBatch(input.rows)),
  }),
  //  // ─── Business Units / Unidades ────────────────────────────────────────────────
  businessUnits: router({
    list: protectedProcedure.query(() => db.listBusinessUnits()),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        type: z.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
      }))
      .mutation(({ input }) => db.createBusinessUnit(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        type: z.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        responsibleName: z.string().optional(),
        responsiblePhone: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateBusinessUnit(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteBusinessUnit(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          type: z.enum(["escritorio", "filial", "deposito", "outro"]).optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          responsibleName: z.string().optional(),
          responsiblePhone: z.string().optional(),
        }))
      }))
      .mutation(({ input }) => db.importBusinessUnitsBatch(input.rows)),
  }),

  // ─── Departments / Departamentos ───────────────────────────────────────────────────────────
  departments: router({
    list: protectedProcedure.query(() => db.listDepartments()),
    nextCode: protectedProcedure.query(() => db.getNextDepartmentCode()),
    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        responsible: z.string().optional(),
      }))
      .mutation(({ input }) => db.createDepartment(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().optional(),
        name: z.string().optional(),
        responsible: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return db.updateDepartment(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteDepartment(input.id)),
    importBatch: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          responsible: z.string().optional(),
        }))
      }))
      .mutation(({ input }) => db.importDepartmentsBatch(input.rows)),
  }),

  // ─── Malotes ──────────────────────────────────────────────────────────────
  malotes: router({
    list: protectedProcedure.query(() => db.listMalotes()),
    stats: protectedProcedure.query(() => db.getMaloteStats()),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getMaloteWithItems(input.id)),
    readyRequests: protectedProcedure.query(() => db.getRequestsReadyForMalote()),
    create: protectedProcedure
      .input(z.object({
        originUnit: z.string().min(1),
        destinationUnit: z.string().min(1),
        notes: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createMalote({
          originUnit: input.originUnit,
          destinationUnit: input.destinationUnit,
          notes: input.notes ?? null,
          createdById: ctx.user.id,
          createdByName: ctx.user.name ?? "Usuário",
        })
      ),
    addRequest: protectedProcedure
      .input(z.object({
        maloteId: z.number(),
        requestId: z.number(),
        requestCode: z.string(),
        requesterName: z.string(),
        application: z.string(),
      }))
      .mutation(({ ctx, input }) =>
        db.addRequestToMalote({
          maloteId: input.maloteId,
          requestId: input.requestId,
          requestCode: input.requestCode,
          requesterName: input.requesterName,
          application: input.application,
          addedById: ctx.user.id,
          addedByName: ctx.user.name ?? "Usuário",
        })
      ),
    removeRequest: protectedProcedure
      .input(z.object({ maloteItemId: z.number() }))
      .mutation(({ input }) => db.removeRequestFromMalote(input.maloteItemId)),
    send: protectedProcedure
      .input(z.object({ maloteId: z.number() }))
      .mutation(({ ctx, input }) =>
        db.sendMalote({
          maloteId: input.maloteId,
          sentById: ctx.user.id,
          sentByName: ctx.user.name ?? "Usuário",
        })
      ),
    receive: protectedProcedure
      .input(z.object({
        maloteId: z.number(),
        receiptNotes: z.string().default(""),
        signatureData: z.string().optional(),
        itemReceipts: z.array(z.object({
          itemId: z.number(),
          receiptStatus: z.enum(["recebido", "devolvido"]),
          receiptNotes: z.string().optional(),
        })),
      }))
      .mutation(({ ctx, input }) =>
        db.receiveMalote({
          maloteId: input.maloteId,
          receivedById: ctx.user.id,
          receivedByName: ctx.user.name ?? "Usuário",
          receiptNotes: input.receiptNotes,
          signatureData: input.signatureData,
          itemReceipts: input.itemReceipts,
        })
      ),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Malotes ────────────────────────────────────────────────────────────────
