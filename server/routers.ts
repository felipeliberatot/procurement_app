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
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin"]).optional(),
        department: z.string().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "diretoria", "financeiro", "master"]).optional(),
      }))
      .mutation(({ ctx, input }) => db.updateUserProfile(ctx.user.id, input)),
    upsertByAdmin: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin"]),
        department: z.string().optional(),
        phone: z.string().optional(),
        jobTitle: z.string().optional(),
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "diretoria", "financeiro", "master"]).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const callerIsMaster = (ctx.user as any)?.approvalLevel === "master";
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
        return db.upsertUserByAdmin(input);
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
          procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin"]),
        }))
      }))
      .mutation(({ input }) => db.importUsersBatch(input.users)),
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

    pendingForMe: protectedProcedure.query(({ ctx }) =>
      db.getPendingRequestsForUser(ctx.user.procurementRole)
    ),

    all: protectedProcedure.query(() => db.getAllRequests()),

    dashboardStats: protectedProcedure.query(({ ctx }) =>
      db.getDashboardStats(ctx.user.id, ctx.user.procurementRole)
    ),

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
  }),

  // ─── Approvals ─────────────────────────────────────────────────────────────
  approvals: router({
    approve: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        comment: z.string().optional(),
        purchaseOrderNumber: z.string().optional(),
        paymentInfo: z.string().optional(),
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
});

export type AppRouter = typeof appRouter;
