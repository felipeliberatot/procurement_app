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
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
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
        approvalLevel: z.enum(["nenhum", "gerente", "controladoria", "orcamento", "diretoria", "financeiro", "master"]).optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).optional(),
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
          procurementRole: z.enum(["solicitante", "gerente", "controladoria", "diretoria", "financeiro", "admin"]),
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
        // Attach the budget URL to the request
        await db.attachBudget(input.requestId, ctx.user.id, ctx.user.name ?? "Usuário", url);
        return { url };
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
  }),
  // ─── Malotes ─────────────────────────────────────────────────────────────────
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
      }))
      .mutation(({ ctx, input }) =>
        db.createMalote({
          originUnit: input.originUnit,
          destinationUnit: input.destinationUnit,
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
