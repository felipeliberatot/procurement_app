import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM, type Message } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
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
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento", "compras", "ceo", "master", "assets_admin"]).optional(),
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
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento", "compras", "ceo", "master", "assets_admin"]),
        extraRoles: z.array(z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento", "compras", "ceo", "master", "assets_admin"])).optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
        extraApprovalLevels: z.array(z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"])).optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).optional(),
        registerPermissions: z.record(z.string(), z.object({
          create: z.boolean(),
          edit: z.boolean(),
          delete: z.boolean(),
        })).optional(),
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
        const result = await db.upsertUserByAdmin({
          ...input,
          registerPermissions: input.registerPermissions
            ? JSON.stringify(input.registerPermissions)
            : undefined,
        });
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
          procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin", "orcamento", "compras", "ceo", "master", "assets_admin"]),
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
    listAll: protectedProcedure.query(() => db.listAllCostCenters()),
    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(({ input }) => db.toggleCostCenterActive(input.id, input.active)),
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
        value: z.string().optional(),
        hasChassi: z.boolean().optional(),
        chassiNumber: z.string().optional(),
        licensePlate: z.string().optional(),
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
        value: z.string().optional(),
        hasChassi: z.boolean().optional(),
        chassiNumber: z.string().optional(),
        licensePlate: z.string().optional(),
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
          value: z.string().optional(),
          hasChassi: z.boolean().optional(),
          chassiNumber: z.string().optional(),
          licensePlate: z.string().optional(),
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
        costCenterCode: z.string().min(1, "Centro de Custo é obrigatório"),
        application: z.string().min(1),
        urgencyLevel: z.enum(["normal", "urgente", "emergencial"]),
        observations: z.string().optional(),
        osMyfarm: z.string().optional(),
        farmId: z.number().optional(),
        farmName: z.string().optional(),
        harvestId: z.number().optional(),
        harvestName: z.string().optional(),
        items: z.array(z.object({
          description: z.string().min(1),
          quantity: z.string(),
          unit: z.string().default("un"),
          unitPrice: z.string().optional(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await db.createPurchaseRequest(ctx.user, input);
          return result;
        } catch (err: any) {
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
    rankingByUser: protectedProcedure
      .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
      .query(({ input }) => db.getRankingByUser(input.year, input.month)),
    purchaseTrend: protectedProcedure
      .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
      .query(({ input }) => db.getPurchaseTrend(input.year, input.month)),
    partialFulfillmentStats: protectedProcedure.query(() => db.getPartialFulfillmentStats()),
    requestsByAsset: protectedProcedure
      .input(z.object({ application: z.string().min(1), year: z.number().optional(), month: z.number().optional() }))
      .query(({ input }) => db.getRequestsByAsset(input.application, input.year, input.month)),
    updateItemFulfillment: protectedProcedure
      .input(z.object({ itemId: z.number(), fulfilledQty: z.number().min(0) }))
      .mutation(({ input, ctx }) => db.updateItemFulfillment(input.itemId, input.fulfilledQty, ctx.user.id)),

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
      .input(z.object({ requestId: z.number(), estimatedValue: z.number().positive().optional() }))
      .mutation(({ ctx, input }) => db.submitBudget(input.requestId, ctx.user, input.estimatedValue)),

    // Finalizar OC (Compras - encerra o fluxo e habilita nos Malotes)
    // orderValue é obrigatório: Valor da Ordem de Compra definido pelo Compras na Emissão de OC
    finalizeOC: protectedProcedure
      .input(z.object({ requestId: z.number(), orderValue: z.number() }))
      .mutation(({ ctx, input }) => db.finalizeOC(input.requestId, ctx.user, input.orderValue)),

    // Refinalizar OC para solicitações parcialmente concluídas (recompra de itens pendentes)
    refinalizeOC: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(({ ctx, input }) => db.refinalizeOC(input.requestId, ctx.user)),

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

    // Editar solicitação aberta (qualquer usuário autenticado, status editável)
    update: protectedProcedure
      .input(z.object({
        requestId: z.number(),
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
      .mutation(async ({ ctx, input }) => {
        const { requestId, ...data } = input;
        const result = await db.updatePurchaseRequest(
          requestId,
          ctx.user.id,
          ctx.user.name ?? "Usuário",
          data
        );
        if (!result.success) throw new Error(result.error ?? "Erro ao editar solicitação");
        return result;
      }),

    // Edição pela Controladoria (sem reiniciar fluxo)
    updateByControladoria: protectedProcedure
      .input(z.object({
        requestId: z.number(),
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
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user as any;
        const allRoles = [user.procurementRole, ...(user.extraRoles ? JSON.parse(user.extraRoles) : [])];
        const isControladoria = allRoles.includes("controladoria") || user.approvalLevel === "controladoria" || user.approvalLevel === "master";
        if (!isControladoria) throw new Error("Apenas usuários da Controladoria podem usar esta edição.");
        const { requestId, ...data } = input;
        const result = await db.updateByControladoria(
          requestId,
          ctx.user.id,
          ctx.user.name ?? "Usuário",
          data
        );
        if (!result.success) throw new Error(result.error ?? "Erro ao editar solicitação");
        return result;
      }),

    // Excluir solicitação cancelada (somente solicitante ou admin/master)
    delete: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(({ ctx, input }) => {
        const user = ctx.user as any;
        const isAdmin = user.role === "admin" || user.approvalLevel === "master";
        return db.deletePurchaseRequest(input.requestId, user.id, isAdmin);
      }),

    // ── Prioridades (apenas Willian Camilo e Rafael) ──
    setPriority: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        isPriority: z.boolean(),
      }))
      .mutation(({ ctx, input }) => {
        const user = ctx.user as any;
        if (!db.canSetPriority(user.name ?? "")) {
          throw new Error("Apenas Willian Camilo e Rafael podem definir prioridades.");
        }
        return db.setPriorityRequest(input.requestId, input.isPriority, user.name ?? "Usuário");
      }),

    reorderPriority: protectedProcedure
      .input(z.object({
        orderedIds: z.array(z.number()).min(1),
      }))
      .mutation(({ ctx, input }) => {
        const user = ctx.user as any;
        if (!db.canSetPriority(user.name ?? "")) {
          throw new Error("Apenas Willian Camilo e Rafael podem reordenar prioridades.");
        }
        return db.reorderPriorityRequests(input.orderedIds);
      }),

    listPriority: protectedProcedure
      .query(() => db.listPriorityRequests()),
  }),

  // ─── Approvals ─────────────────────────────────────────────────────────────
  approvals: router({
    approve: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        comment: z.string().optional(),
        purchaseOrderNumber: z.string().optional(),
        orderValue: z.number().positive().optional(),
        paymentInfo: z.string().optional(),
        paymentMethod: z.enum(["pix", "boleto", "cartao_avista", "cartao_parcelado"]).optional(),
        paymentObservations: z.string().optional(),
        paymentInstallments: z.number().int().min(1).max(48).optional(),
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

        // Buscar itens da solicitação para incluir na mensagem
        const { requestItems } = await import("../drizzle/schema");
        const items = await dbConn.select().from(requestItems).where(eq(requestItems.requestId, req.id));
        const itemsForMsg = items.map((it: any) => ({ description: it.description, quantity: String(it.quantity), unit: it.unit }));

        // Caso especial: aguardando_orcamento → notificar o SOLICITANTE para anexar o PDF
        if (req.status === "aguardando_orcamento") {
          const { notifyBudgetRequired } = await import("./whatsapp");
          const [requester] = await dbConn.select().from(users).where(eq(users.id, req.requesterId)).limit(1);
          if (!requester?.phone) throw new Error("Solicitante não tem telefone cadastrado");
          await notifyBudgetRequired({
            requesterPhone: requester.phone,
            requesterName: requester.name ?? "Solicitante",
            requestNumber: req.requestNumber,
            requestId: req.id,
            application: req.application,
            urgencyLevel: req.urgencyLevel,
            department: req.department,
            items: itemsForMsg,
            totalValue: req.totalEstimatedValue ?? undefined,
          });
          return { sent: 1, approversFound: 1 };
        }

        const roleMap: Record<string, string> = {
          aguardando_gerente: "gerente",
          aguardando_controladoria: "controladoria",
          aguardando_diretoria: "diretoria",
          aguardando_ordem_compra: "orcamento",
          aguardando_comprovante_pagamento: "financeiro",
          aguardando_verificacao_compras: "orcamento",
        };
        const STEP_LABELS: Record<string, string> = {
          aguardando_gerente: "Aprovação Gerente",
          aguardando_controladoria: "Aprovação Controladoria",
          aguardando_diretoria: "Aprovação Diretoria",
          aguardando_ordem_compra: "Emissão de Ordem de Compra",
          aguardando_comprovante_pagamento: "Comprovante de Pagamento",
          aguardando_verificacao_compras: "Verificação Final",
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
          if ((approver as any).phone) {
            await notifyApproverWithToken({
              approverPhone: (approver as any).phone,
              approverName: (approver as any).name ?? "Aprovador",
              approverId: (approver as any).id,
              requestNumber: req.requestNumber,
              requestId: req.id,
              requesterName: req.requesterName,
              application: req.application,
              urgencyLevel: req.urgencyLevel,
              department: req.department,
              stepLabel: STEP_LABELS[req.status] ?? role,
              step: role,
              items: itemsForMsg,
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
  ai: router({
    analyzeBudget: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        budgetFileUrl: z.string().url(),
        requestDescription: z.string(),
        requestItems: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          unitPrice: z.number().nullable(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        // Fase 1: Extrair itens do PDF via LLM
        const extractionPrompt = "Você é um assistente especializado em leitura de documentos.\nLeia o PDF do orçamento em anexo e extraia TODOS os itens listados.\nRetorne APENAS um JSON: {\"items\":[{\"name\":\"nome\",\"quantity\":1,\"unitPrice\":100.00,\"totalPrice\":100.00}],\"supplier\":\"fornecedor\",\"totalBudget\":1000.00}\nSe algum campo não estiver visível, use null.";

        const extractionContent: Message["content"] = [
          { type: "text", text: `Extraia os itens do orçamento para: "${input.requestDescription}"` },
          { type: "file_url", file_url: { url: input.budgetFileUrl, mime_type: "application/pdf" } },
        ];

        const extractionResponse = await invokeLLM({
          messages: [
            { role: "system", content: extractionPrompt },
            { role: "user", content: extractionContent },
          ],
          response_format: { type: "json_object" },
        });

        const extractedRaw = extractionResponse.choices[0].message.content;
        const extractedStr = typeof extractedRaw === "string" ? extractedRaw : JSON.stringify(extractedRaw);
        type ExtractedItem = { name: string; quantity: number; unitPrice: number | null; totalPrice: number | null };
        type Extracted = { items: ExtractedItem[]; supplier?: string; totalBudget?: number };
        let extracted: Extracted;
        try {
          extracted = JSON.parse(extractedStr) as Extracted;
        } catch {
          extracted = { items: input.requestItems?.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.unitPrice ? i.unitPrice * i.quantity : null })) ?? [] };
        }

        // Fase 2: Buscar preços reais no Google Shopping via Serper API
        const serperKey = ENV.serperApiKey;
        type WebPriceEntry = { min: number; max: number; avg: number; sources: Array<{ title: string; price: number; link: string; source: string }> };
        const webPrices: Record<string, WebPriceEntry> = {};

        if (serperKey && extracted.items.length > 0) {
          const searchPromises = extracted.items.slice(0, 8).map(async (item) => {
            try {
              const resp = await fetch("https://google.serper.dev/shopping", {
                method: "POST",
                headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
                body: JSON.stringify({ q: `${item.name} preço Sinop MT Mato Grosso`, gl: "br", hl: "pt-br", num: 8 }),
              });
              if (!resp.ok) return;
              const data = await resp.json() as { shopping?: Array<{ title: string; price: string; link: string; source: string }> };
              const prices = (data.shopping ?? [])
                .map(r => ({ title: r.title, price: parseFloat((r.price ?? "").replace(/[R$\s.]/g, "").replace(",", ".")), link: r.link, source: r.source }))
                .filter(r => !isNaN(r.price) && r.price > 0);
              if (prices.length > 0) {
                const vals = prices.map(p => p.price);
                webPrices[item.name] = {
                  min: Math.min(...vals),
                  max: Math.max(...vals),
                  avg: vals.reduce((a, b) => a + b, 0) / vals.length,
                  sources: prices.slice(0, 3),
                };
              }
            } catch { /* ignore */ }
          });
          await Promise.all(searchPromises);
        }

        // Fase 3: Gerar parecer com LLM usando preços reais do Google Shopping
        const hasWebPrices = Object.keys(webPrices).length > 0;
        const webPricesLines = hasWebPrices
          ? Object.entries(webPrices).map(([name, data]) =>
              `- ${name}: min R$ ${data.min.toFixed(2)}, max R$ ${data.max.toFixed(2)}, média R$ ${data.avg.toFixed(2)} | ${data.sources.map(s => `${s.source} R$${s.price.toFixed(2)}`).join(", ")}`
            ).join("\n")
          : "";
        const webPricesContext = hasWebPrices
          ? `\n\nPREÇOS REAIS DO GOOGLE SHOPPING (referência principal):\n${webPricesLines}`
          : "";

        const refSource = hasWebPrices
          ? "Use os PREÇOS REAIS DO GOOGLE SHOPPING fornecidos como referência principal. Esses preços foram buscados com foco em Sinop-MT e região (Mato Grosso)."
          : "Use seu conhecimento de preços do mercado de Sinop-MT e região (Mato Grosso) para 2024-2025. Considere que Sinop é um polo agrícola do Centro-Oeste com preços influenciados pela logística regional.";
        const sourcesInstruction = hasWebPrices
          ? "5. Inclua as fontes de preço no campo 'sources' de cada item."
          : "";

        const systemPrompt = `Você é um especialista em compras e análise de orçamentos para o setor agrícola, com profundo conhecimento do mercado de Sinop-MT e região (Mato Grosso).\n${refSource}\n\nPara cada item do orçamento:\n1. Compare o preço cotado com os preços praticados em Sinop-MT e região\n2. Classifique: ADEQUADO (±15%), ACIMA_DO_MERCADO (15-30% acima), MUITO_ACIMA (>30% acima), ABAIXO_DO_MERCADO (>15% abaixo)\n3. Calcule a variação percentual em relação ao preço médio regional\n4. Forneça uma justificativa técnica considerando fatores regionais (frete, disponibilidade local, sazonalidade agrícola do MT)\n5. No campo 'justification', mencione explicitamente se o preço está compatível com o mercado de Sinop-MT\n${sourcesInstruction}\n\nNo campo 'summary', inclua obrigatoriamente:\n- Um parágrafo de comparativo regional: como os preços deste orçamento se comparam ao mercado de Sinop-MT e região\n- Observações sobre disponibilidade local vs. necessidade de compra fora da região\n- Recomendação de fornecedores locais quando aplicável\n\nRetorne JSON:\n{"items":[{"name":"","quantity":1,"unitPrice":0,"totalPrice":0,"marketPriceMin":0,"marketPriceMax":0,"variation":0,"status":"ADEQUADO","justification":"","sources":[{"title":"","price":0,"link":"","source":""}]}],"totalBudget":0,"totalMarketMin":0,"totalMarketMax":0,"overallVariation":0,"recommendation":"APROVADO","summary":"","regionalComparison":"","alerts":[],"usedWebSearch":${hasWebPrices}}`;

        const itemsText = extracted.items.map(i => `- ${i.name}: ${i.quantity}x R$${(i.unitPrice ?? 0).toFixed(2)} = R$${(i.totalPrice ?? 0).toFixed(2)}`).join("\n");
        const userText = `Orçamento: "${input.requestDescription}" | Fornecedor: ${extracted.supplier ?? "N/A"} | Total: R$ ${(extracted.totalBudget ?? 0).toFixed(2)}\n\nItens:\n${itemsText}${webPricesContext}\n\nEmita o parecer completo.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0].message.content;
        const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const analysis = JSON.parse(contentStr);
        analysis.usedWebSearch = hasWebPrices;

        await db.saveBudgetAnalysis(input.requestId, JSON.stringify(analysis));
        return analysis;
      }),

    getBudgetAnalysis: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ input }) => {
        const result = await db.getBudgetAnalysis(input.requestId);
        if (!result) return null;
        try {
          return JSON.parse(result);
        } catch {
          return null;
        }
      }),

    analyzePurchasesByCategory: protectedProcedure
      .mutation(async () => {
        // Buscar todas as solicitações concluídas com seus itens
        const completed = await db.getCompletedRequestsWithItems();

        if (!completed || completed.length === 0) {
          return { categories: [], generatedAt: new Date().toISOString(), summary: "Nenhuma compra concluída encontrada." };
        }

        // Agrupar por aplicação/categoria
        const categoryMap = new Map<string, { totalPaid: number; items: string[]; count: number }>();
        for (const req of completed) {
          const cat = req.application || "Outros";
          if (!categoryMap.has(cat)) categoryMap.set(cat, { totalPaid: 0, items: [], count: 0 });
          const entry = categoryMap.get(cat)!;
          entry.totalPaid += Number(req.totalValue ?? 0);
          entry.count += 1;
          for (const item of req.items) {
            entry.items.push(`${item.description} (${item.quantity}x R$${Number(item.unitPrice ?? 0).toFixed(2)})`);
          }
        }

        const categorySummary = Array.from(categoryMap.entries())
          .sort((a, b) => b[1].totalPaid - a[1].totalPaid)
          .slice(0, 10) // top 10 categorias
          .map(([name, data]) => ({
            name,
            totalPaid: data.totalPaid,
            count: data.count,
            sampleItems: data.items.slice(0, 5),
          }));

        const systemPrompt = `Você é um especialista em compras e análise de mercado para o setor agrícola brasileiro.
Analise os dados de compras concluídas agrupadas por categoria e compare com os preços de mercado.

Para cada categoria, estime:
1. O valor de mercado esperado (min e max) para os itens comprados
2. A variação percentual entre o valor pago e o mercado
3. Uma avaliação: OTIMO (>10% abaixo do mercado), BOM (até 10% abaixo), ADEQUADO (±10%), ATENCAO (até 20% acima), CRITICO (>20% acima)
4. Uma observação curta sobre a categoria

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
      "observation": "Preços dentro do esperado para insumos agrícolas"
    }
  ],
  "overallEfficiency": -3.5,
  "summary": "Resumo geral da eficiência de compras...",
  "topOpportunity": "Categoria com maior potencial de economia..."
}`;

        const userText = `Analise as seguintes categorias de compras concluídas:\n\n${categorySummary.map(c =>
          `Categoria: "${c.name}"\nTotal pago: R$ ${c.totalPaid.toFixed(2)}\nNúmero de compras: ${c.count}\nItens de exemplo: ${c.sampleItems.join("; ")}`
        ).join("\n\n")}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
          response_format: { type: "json_object" },
        });

        const rawContent = response.choices[0].message.content;
        const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const analysis = JSON.parse(contentStr);

        return {
          ...analysis,
          generatedAt: new Date().toISOString(),
        };
      }),
  }),

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
    sendPartial: protectedProcedure
      .input(z.object({
        maloteId: z.number(),
        itemIds: z.array(z.number()).min(1, "Selecione ao menos um item para enviar."),
      }))
      .mutation(({ ctx, input }) =>
        db.sendMalotePartial({
          maloteId: input.maloteId,
          itemIds: input.itemIds,
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
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        originUnit: z.string().min(1).optional(),
        destinationUnit: z.string().min(1).optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(({ input }) => db.updateMalote(input)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteMalote(input.id)),
  }),

  // ─── Safras (Harvests) ────────────────────────────────────────────────────────────────────────────────
  harvests: router({
    list: protectedProcedure.query(() => db.listHarvests()),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        year: z.string().min(1),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const callerRole = (ctx.user as any).procurementRole;
        const callerLevel = (ctx.user as any).approvalLevel;
        const regPerms = (() => { try { return JSON.parse((ctx.user as any).registerPermissions || "{}"); } catch { return {}; } })();
        const canManage = callerRole === "master" || callerRole === "admin" || callerLevel === "master" || regPerms?.harvests?.create === true;
        if (!canManage) throw new Error("Sem permissão para criar safras.");
        return db.createHarvest(input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        year: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const callerRole = (ctx.user as any).procurementRole;
        const callerLevel = (ctx.user as any).approvalLevel;
        const regPerms = (() => { try { return JSON.parse((ctx.user as any).registerPermissions || "{}"); } catch { return {}; } })();
        const canManage = callerRole === "master" || callerRole === "admin" || callerLevel === "master" || regPerms?.harvests?.edit === true;
        if (!canManage) throw new Error("Sem permissão para editar safras.");
        const { id, ...data } = input;
        return db.updateHarvest(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => {
        const callerRole = (ctx.user as any).procurementRole;
        const callerLevel = (ctx.user as any).approvalLevel;
        const regPerms = (() => { try { return JSON.parse((ctx.user as any).registerPermissions || "{}"); } catch { return {}; } })();
        const canManage = callerRole === "master" || callerRole === "admin" || callerLevel === "master" || regPerms?.harvests?.delete === true;
        if (!canManage) throw new Error("Sem permissão para excluir safras.");
        return db.deleteHarvest(input.id);
      }),
  }),

  // ─── Orçamentos (Budgets) ─────────────────────────────────────────────────────────────────────────────
  budgets: router({
    list: protectedProcedure
      .input(z.object({ harvestId: z.number().optional() }))
      .query(({ input }) => db.listBudgets(input.harvestId)),
    summary: protectedProcedure.query(() => db.getBudgetSummary()),
    create: protectedProcedure
      .input(z.object({
        harvestId: z.number(),
        costCenterId: z.number().optional(),
        costCenterCode: z.string().optional(),
        costCenterName: z.string().optional(),
        category: z.string().optional(),
        totalValue: z.string().min(1),
        notes: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.name !== "Oscar" && (ctx.user as any).procurementRole !== "master") {
          throw new Error("Apenas o usuário Oscar pode criar orçamentos.");
        }
        return db.createBudget({ ...input, createdBy: ctx.user.name ?? "Oscar" });
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        harvestId: z.number().optional(),
        costCenterId: z.number().optional(),
        costCenterCode: z.string().optional(),
        costCenterName: z.string().optional(),
        category: z.string().optional(),
        totalValue: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.name !== "Oscar" && (ctx.user as any).procurementRole !== "master") {
          throw new Error("Apenas o usuário Oscar pode editar orçamentos.");
        }
        const { id, ...data } = input;
        return db.updateBudget(id, data as any);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.name !== "Oscar" && (ctx.user as any).procurementRole !== "master") {
          throw new Error("Apenas o usuário Oscar pode excluir orçamentos.");
        }
        return db.deleteBudget(input.id);
      }),
  }),

  // ─── API Keys ───────────────────────────────────────────────────────────────────────────────────
  apiKeys: router({
    list: protectedProcedure.query(({ ctx }) => {
      const isMaster = (ctx.user as any)?.approvalLevel === "master";
      if (!isMaster) throw new Error("Apenas usuários master podem gerenciar chaves de API.");
      return db.listApiKeys();
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        permissions: z.array(z.string()).optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => {
        const isMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!isMaster) throw new Error("Apenas usuários master podem criar chaves de API.");
        return db.createApiKey({
          name: input.name,
          description: input.description,
          permissions: input.permissions ?? ["create_request"],
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          createdById: ctx.user.id,
          createdByName: ctx.user.name ?? "",
        });
      }),
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => {
        const isMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!isMaster) throw new Error("Apenas usuários master podem revogar chaves de API.");
        return db.revokeApiKey(input.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => {
        const isMaster = (ctx.user as any)?.approvalLevel === "master";
        if (!isMaster) throw new Error("Apenas usuários master podem excluir chaves de API.");
        return db.deleteApiKey(input.id);
      }),
  }),
  // ─── Cotações / Orçamentos de Fornecedores (integrado ao fluxo de solicitação) ──────────
  quotations: router({
    // Buscar cotações vinculadas a uma solicitação
    getByRequestId: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(({ input }) => db.getQuotationGroupByRequestId(input.requestId)),
    // Salvar/substituir cotações para uma solicitação (papel: orçamento)
    saveForRequest: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        suppliers: z.array(z.object({
          supplierName: z.string().min(1),
          supplierContact: z.string().optional(),
          paymentTerms: z.string().optional(),
          deliveryDays: z.number().optional(),
          observations: z.string().optional(),
          items: z.array(z.object({
            description: z.string().min(1),
            quantity: z.string(),
            unit: z.string().default("un"),
            unitPrice: z.string(),
            totalPrice: z.string(),
          })),
          totalValue: z.string(),
          position: z.number().min(1).max(3),
        })).min(1).max(3),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Salvar as cotações no banco
        const result = await db.saveQuotationsForRequest({
          requestId: input.requestId,
          suppliers: input.suppliers,
          createdById: ctx.user.id,
          createdByName: (ctx.user as any).name ?? "Usuário",
        });
        // 2. Notificar aprovadores de orçamento via WhatsApp com comparativo de cotações
        try {
          const { notifyQuotationApprover } = await import("./whatsapp");
          const { getDb } = await import("./db");
          const { users: usersTable, purchaseRequests } = await import("../drizzle/schema");
          const { eq: eqDrizzle, or: orDrizzle, and: andDrizzle } = await import("drizzle-orm");
          const dbConn = await getDb();
          if (dbConn) {
            // Buscar dados da solicitação
            const [req] = await dbConn.select().from(purchaseRequests)
              .where(eqDrizzle(purchaseRequests.id, input.requestId)).limit(1);
            // Buscar aprovadores ativos com papel de orçamento
            const approversRaw = await dbConn.select().from(usersTable)
              .where(andDrizzle(
                eqDrizzle(usersTable.active, true),
                orDrizzle(
                  eqDrizzle(usersTable.procurementRole, "orcamento" as any),
                  eqDrizzle(usersTable.approvalLevel, "orcamento" as any),
                ),
              ));
            const approvers = [...new Map(approversRaw.map((a: any) => [a.id, a])).values()] as any[];
            // Buscar os suppliers recém-salvos para obter os IDs reais do banco
            const savedGroup = await db.getQuotationGroupByRequestId(input.requestId);
            const savedSuppliers = savedGroup?.suppliers ?? [];
            for (const approver of approvers) {
              if (approver.phone && req) {
                await notifyQuotationApprover({
                  approverPhone: approver.phone,
                  approverName: approver.name ?? "Aprovador",
                  approverId: approver.id,
                  requestId: input.requestId,
                  requestNumber: req.requestNumber,
                  requesterName: req.requesterName,
                  department: req.department,
                  urgencyLevel: req.urgencyLevel,
                  suppliers: savedSuppliers.map((s: any) => ({
                    id: s.id,
                    supplierName: s.supplierName,
                    totalValue: s.totalValue,
                    paymentTerms: s.paymentTerms,
                    deliveryDays: s.deliveryDays,
                    observations: s.observations,
                  })),
                });
              }
            }
          }
        } catch (e) {
          console.warn("[WhatsApp] Falha ao notificar aprovadores de cotação:", e);
        }
        return result;
      }),
    // Aprovador seleciona o fornecedor vencedor e avança o fluxo
    approveWithSupplier: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        supplierId: z.number(),
        estimatedValue: z.number().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.approveQuotationAndAdvance(input.requestId, input.supplierId, ctx.user, input.estimatedValue)
      ),
    // Upload de arquivo (PDF ou imagem) vinculado a um fornecedor específico da cotação
    uploadSupplierFile: protectedProcedure
      .input(z.object({
        supplierId: z.number(),
        fileName: z.string(),
        base64: z.string(),
        mimeType: z.string().default("application/pdf"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.base64, "base64");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `quotations/${input.supplierId}/${Date.now()}_${safeName}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Atualizar o fileUrl do fornecedor no banco
        const { getDb } = await import("./db");
        const { quotationSuppliers } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const dbConn = await getDb();
        if (dbConn) {
          await dbConn.update(quotationSuppliers)
            .set({ fileUrl: url })
            .where(eq(quotationSuppliers.id, input.supplierId));
        }
        return { url };
      }),
  }),

  // ─── Integração CGS Manutenções ──────────────────────────────────────────────
  maintenance: router({
    listWorkOrders: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const apiKey = ENV.cgsMaintainApiKey;
        if (!apiKey) throw new Error("CGS_MAINTENANCE_API_KEY não configurada.");

        const baseUrl = "https://cgsmaintain-yb3cdfwd.manus.space";
        const url = new URL(`${baseUrl}/api/integration/work-orders`);
        if (input?.search) url.searchParams.set("search", input.search);
        if (input?.status) url.searchParams.set("status", input.status);

        const res = await fetch(url.toString(), {
          headers: {
            "X-API-Key": apiKey,
            "Accept": "application/json",
          },
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Erro ao buscar OS: ${res.status} ${err}`);
        }

        const data = await res.json() as {
          success: boolean;
          count: number;
          data: Array<{
            id: number;
            orderNumber: string;
            description: string | null;
            status: string;
            maintenanceType: string;
            priority: string;
            equipment: {
              id: number;
              code: string;
              name: string;
              type: string;
              manufacturer: string;
              model: string;
            };
            requesterName: string;
            openedAt: string;
            startDate: string;
            endDate: string;
            totalCost: number;
          }>;
        };

        return data.data ?? [];
      }),
  }),
});

export type AppRouter = typeof appRouter;


// ─── Malotes ────────────────────────────────────────────────────────────────────────────────