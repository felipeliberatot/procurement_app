/**
 * Endpoint REST público para integração com sistemas externos via API Key.
 * Usado pelo aplicativo CGS Manutenções para criar solicitações de compra.
 *
 * Autenticação: Header "X-API-Key: cgsk_..."
 *
 * Endpoints disponíveis:
 *   POST /api/integration/requests      — Criar nova solicitação de compra
 *   GET  /api/integration/requests/:id  — Consultar status de uma solicitação
 *   GET  /api/integration/requests      — Listar solicitações criadas por esta chave
 */

import type { Express, Request, Response } from "express";
import * as db from "./db";

// ─── Middleware de autenticação por API Key ────────────────────────────────────

async function requireApiKey(req: Request, res: Response): Promise<Omit<any, "keyHash"> | null> {
  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: "API Key não fornecida. Use o header X-API-Key." });
    return null;
  }
  const keyData = await db.validateApiKey(rawKey);
  if (!keyData) {
    res.status(401).json({ error: "API Key inválida, revogada ou expirada." });
    return null;
  }
  return keyData;
}

// ─── Registro das rotas ───────────────────────────────────────────────────────

export function registerApiIntegration(app: Express) {

  /**
   * POST /api/integration/requests
   * Cria uma nova solicitação de compra a partir de um sistema externo.
   *
   * Body (JSON):
   * {
   *   "requesterName": "João Silva",          // Nome do solicitante (obrigatório)
   *   "department": "Manutenção",             // Departamento (obrigatório)
   *   "costCenterCode": "CC-001",             // Código do centro de custo (obrigatório)
   *   "application": "Reparo trator X",       // Aplicação/finalidade (obrigatório)
   *   "urgencyLevel": "normal",               // "normal" | "urgente" | "emergencial" (padrão: "normal")
   *   "observations": "OS #1234 aberta",      // Observações (opcional)
   *   "osMaintenance": "OS-1234",             // Número da OS de Manutenção (opcional)
   *   "items": [                              // Itens da solicitação (obrigatório, mínimo 1)
   *     {
   *       "description": "Filtro de óleo",
   *       "quantity": "2",
   *       "unit": "un",
   *       "unitPrice": "45.90"
   *     }
   *   ]
   * }
   *
   * Resposta de sucesso (201):
   * {
   *   "success": true,
   *   "requestId": 123,
   *   "requestNumber": "SOL-2026-0001",
   *   "status": "aguardando_gerente"
   * }
   */
  app.post("/api/integration/requests", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;

    // Verificar permissão
    const permissions: string[] = keyData.permissions ? JSON.parse(keyData.permissions) : [];
    if (!permissions.includes("create_request")) {
      res.status(403).json({ error: "Esta chave de API não tem permissão para criar solicitações." });
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
      items,
    } = req.body;

    // Validações básicas
    if (!requesterName || typeof requesterName !== "string") {
      res.status(400).json({ error: "Campo obrigatório: requesterName" });
      return;
    }
    if (!department || typeof department !== "string") {
      res.status(400).json({ error: "Campo obrigatório: department" });
      return;
    }
    if (!costCenterCode || typeof costCenterCode !== "string") {
      res.status(400).json({ error: "Campo obrigatório: costCenterCode" });
      return;
    }
    if (!application || typeof application !== "string") {
      res.status(400).json({ error: "Campo obrigatório: application" });
      return;
    }
    if (!["normal", "urgente", "emergencial"].includes(urgencyLevel)) {
      res.status(400).json({ error: "urgencyLevel deve ser: normal, urgente ou emergencial" });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Campo obrigatório: items (array com pelo menos 1 item)" });
      return;
    }
    for (const item of items) {
      if (!item.description || typeof item.description !== "string") {
        res.status(400).json({ error: "Cada item deve ter um campo 'description'" });
        return;
      }
    }

    try {
      // Buscar um usuário "sistema" para criar a solicitação em nome da integração
      // Usa o primeiro usuário master/admin disponível como proxy
      const allUsers = await db.listUsers();
      const systemUser = allUsers.find((u: any) => u.approvalLevel === "master") ?? allUsers[0];
      if (!systemUser) {
        res.status(500).json({ error: "Nenhum usuário disponível para criar a solicitação." });
        return;
      }

      // createPurchaseRequest recebe (user, input) — montar um objeto user proxy com o nome do solicitante
      const proxyUser = { ...systemUser, name: requesterName.trim() };
      const insertId = await db.createPurchaseRequest(proxyUser as any, {
        department: department.trim(),
        costCenterCode: costCenterCode.trim(),
        application: application.trim(),
        urgencyLevel: urgencyLevel as "normal" | "urgente" | "emergencial",
        observations: observations?.trim() || undefined,
        osMyfarm: osMaintenance?.trim() || undefined,
        items: items.map((item: any) => ({
          description: String(item.description).trim(),
          quantity: String(item.quantity ?? "1"),
          unit: String(item.unit ?? "un"),
          unitPrice: item.unitPrice ? String(item.unitPrice) : undefined,
        })),
      });
      // Buscar o número da solicitação recém-criada
      const newReq = await db.getPurchaseRequestWithDetails(insertId);
      const result = { id: insertId, requestNumber: newReq?.requestNumber ?? `ID-${insertId}` };

      console.log(`[Integration] Solicitação criada via API Key "${keyData.name}": ${result.requestNumber}`);

      res.status(201).json({
        success: true,
        requestId: result.id,
        requestNumber: result.requestNumber,
        status: "aguardando_gerente",
      });
    } catch (err: any) {
      console.error("[Integration] Erro ao criar solicitação:", err);
      res.status(500).json({ error: err.message || "Erro interno ao criar solicitação." });
    }
  });

  /**
   * GET /api/integration/requests/:requestNumber
   * Consulta o status de uma solicitação pelo número (ex: SOL-2026-0001).
   */
  app.get("/api/integration/requests/:requestNumber", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;

    const { requestNumber } = req.params;
    try {
      const allReqs = await db.getAllRequests();
      const request = allReqs.find((r: any) => r.requestNumber === requestNumber);
      if (!request) {
        res.status(404).json({ error: `Solicitação ${requestNumber} não encontrada.` });
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
        updatedAt: request.updatedAt,
      });
    } catch (err: any) {
      console.error("[Integration] Erro ao consultar solicitação:", err);
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });

  /**
   * GET /api/integration/departments
   * Lista todos os departamentos ativos.
   */
  app.get("/api/integration/departments", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    try {
      const data = await db.listDepartments();
      res.json(data.map((d: any) => ({ id: d.id, code: d.code, name: d.name })));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });

  /**
   * GET /api/integration/farms
   * Lista todas as fazendas/unidades ativas.
   */
  app.get("/api/integration/farms", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    try {
      const data = await db.listUnits();
      res.json(data.map((u: any) => ({ id: u.id, code: u.code, name: u.name, city: u.city ?? null, state: u.state ?? null })));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });

  /**
   * GET /api/integration/harvests
   * Lista todas as safras cadastradas.
   */
  app.get("/api/integration/harvests", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    try {
      const data = await db.listHarvests();
      res.json(data.map((h: any) => ({ id: h.id, name: h.name, year: h.year, active: h.active ?? true })));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });

  /**
   * GET /api/integration/cost-centers
   * Lista todos os centros de custo ativos.
   */
  app.get("/api/integration/cost-centers", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;
    try {
      const data = await db.listAllCostCenters();
      const active = data.filter((c: any) => c.active !== false);
      res.json(active.map((c: any) => ({ id: c.id, code: c.code, name: c.name, responsible: c.responsible ?? null })));
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erro interno." });
    }
  });

  /**
   * GET /api/integration/health
   * Verifica se a API Key está válida e a integração está funcionando.
   */
  app.get("/api/integration/health", async (req: Request, res: Response) => {
    const keyData = await requireApiKey(req, res);
    if (!keyData) return;

    res.json({
      ok: true,
      keyName: keyData.name,
      permissions: keyData.permissions ? JSON.parse(keyData.permissions) : [],
      message: "Integração CGS Compras funcionando corretamente.",
    });
  });

  console.log("[Integration] Endpoints de integração registrados em /api/integration/*");
}
