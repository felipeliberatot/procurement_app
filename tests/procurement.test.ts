import { describe, expect, it } from "vitest";

// ─── Unit tests for procurement business logic ────────────────────────────────
// These tests validate the core business rules without requiring a database.

// Deadline calculation logic (mirrors server/db.ts)
function getDeadlineDays(urgencyLevel: string): number {
  return urgencyLevel === "emergencial" ? 1 : urgencyLevel === "urgente" ? 3 : 7;
}

function getDeadlineDate(urgencyLevel: string): Date {
  const days = getDeadlineDays(urgencyLevel);
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function getStepDeadlineHours(): number {
  return 48;
}

// ─── Fluxo NORMAL: Gerente → Orçamento → Controladoria → Diretoria → OC → Financeiro → Comprovante → Verificação
const STEP_FLOW_NORMAL: Record<string, { step: string; nextStatus: string; action: string }> = {
  aguardando_gerente:               { step: "gerente",           nextStatus: "aguardando_orcamento",              action: "aprovada" },
  aguardando_orcamento:             { step: "orcamento",         nextStatus: "aguardando_controladoria",          action: "aprovada" },
  aguardando_controladoria:         { step: "controladoria",     nextStatus: "aguardando_diretoria",              action: "aprovada" },
  aguardando_diretoria:             { step: "diretoria",         nextStatus: "aguardando_ordem_compra",           action: "aprovada" },
  aguardando_ordem_compra:          { step: "ordem_compra",      nextStatus: "aguardando_aprovacao_compra",       action: "ordem_emitida" },
  aguardando_aprovacao_compra:      { step: "aprovacao_compra",  nextStatus: "aguardando_comprovante_pagamento",  action: "compra_aprovada" },
  aguardando_comprovante_pagamento: { step: "financeiro",        nextStatus: "aguardando_verificacao_compras",    action: "comprovante_aprovado" },
  rejeitada:                        { step: "gerente",           nextStatus: "aguardando_gerente",                action: "reaberta" },
};

// ─── Fluxo URGENTE/EMERGENCIAL: Gerente → Diretoria → Orçamento → Controladoria → OC → Financeiro → Comprovante → Verificação
const STEP_FLOW_URGENT: Record<string, { step: string; nextStatus: string; action: string }> = {
  aguardando_gerente:               { step: "gerente",           nextStatus: "aguardando_diretoria",              action: "aprovada" },
  aguardando_diretoria:             { step: "diretoria",         nextStatus: "aguardando_orcamento",              action: "aprovada" },
  aguardando_orcamento:             { step: "orcamento",         nextStatus: "aguardando_controladoria",          action: "aprovada" },
  aguardando_controladoria:         { step: "controladoria",     nextStatus: "aguardando_ordem_compra",           action: "aprovada" },
  aguardando_ordem_compra:          { step: "ordem_compra",      nextStatus: "aguardando_aprovacao_compra",       action: "ordem_emitida" },
  aguardando_aprovacao_compra:      { step: "aprovacao_compra",  nextStatus: "aguardando_comprovante_pagamento",  action: "compra_aprovada" },
  aguardando_comprovante_pagamento: { step: "financeiro",        nextStatus: "aguardando_verificacao_compras",    action: "comprovante_aprovado" },
  rejeitada:                        { step: "gerente",           nextStatus: "aguardando_gerente",                action: "reaberta" },
};

function getStepFlow(urgencyLevel: string) {
  return (urgencyLevel === "urgente" || urgencyLevel === "emergencial")
    ? STEP_FLOW_URGENT
    : STEP_FLOW_NORMAL;
}

// ─── Fluxo de rejeição NORMAL
const REJECT_FLOW_NORMAL: Record<string, string> = {
  aguardando_gerente:               "aguardando_gerente",
  aguardando_orcamento:             "aguardando_orcamento",
  aguardando_controladoria:         "aguardando_orcamento",
  aguardando_diretoria:             "aguardando_controladoria",
  aguardando_ordem_compra:          "aguardando_diretoria",
  aguardando_aprovacao_compra:      "aguardando_ordem_compra",
  aguardando_comprovante_pagamento: "rejeitada",
};

// ─── Fluxo de rejeição URGENTE/EMERGENCIAL
const REJECT_FLOW_URGENT: Record<string, string> = {
  aguardando_gerente:               "aguardando_gerente",
  aguardando_diretoria:             "aguardando_gerente",
  aguardando_orcamento:             "aguardando_orcamento",
  aguardando_controladoria:         "aguardando_orcamento",
  aguardando_ordem_compra:          "aguardando_controladoria",
  aguardando_aprovacao_compra:      "aguardando_ordem_compra",
  aguardando_comprovante_pagamento: "rejeitada",
};

// ─── submitBudget validation logic (mirrors server/db.ts)
function validateSubmitBudget(request: { status: string; budgetFileUrl: string | null }): { valid: boolean; error?: string } {
  if (request.status !== "aguardando_orcamento") {
    return { valid: false, error: "Esta solicitação não está aguardando orçamento." };
  }
  if (!request.budgetFileUrl) {
    return { valid: false, error: "Anexe o PDF do orçamento antes de enviar." };
  }
  return { valid: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Procurement: Deadline Calculation", () => {
  it("Normal urgency should have 7 days deadline", () => {
    const days = getDeadlineDays("normal");
    expect(days).toBe(7);
  });

  it("Urgent urgency should have 3 days deadline", () => {
    const days = getDeadlineDays("urgente");
    expect(days).toBe(3);
  });

  it("Emergency urgency should have 1 day deadline", () => {
    const days = getDeadlineDays("emergencial");
    expect(days).toBe(1);
  });

  it("Step deadline should be 48 hours", () => {
    const hours = getStepDeadlineHours();
    expect(hours).toBe(48);
  });

  it("Deadline date for normal should be 7 days from now", () => {
    const deadline = getDeadlineDate("normal");
    const now = new Date();
    const diffDays = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("Deadline date for emergency should be 1 day from now", () => {
    const deadline = getDeadlineDate("emergencial");
    const now = new Date();
    const diffDays = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(1);
  });
});

describe("Procurement: Normal Approval Flow", () => {
  it("Initial status should be aguardando_gerente", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_gerente"];
    expect(flow).toBeDefined();
    expect(flow.step).toBe("gerente");
  });

  it("Normal: gerente → aguardando_orcamento", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_gerente"];
    expect(flow.nextStatus).toBe("aguardando_orcamento");
  });

  it("Normal: orcamento → aguardando_controladoria", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_orcamento"];
    expect(flow.nextStatus).toBe("aguardando_controladoria");
  });

  it("Normal: controladoria → aguardando_diretoria", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_controladoria"];
    expect(flow.nextStatus).toBe("aguardando_diretoria");
  });

  it("Normal: diretoria → aguardando_ordem_compra", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_diretoria"];
    expect(flow.nextStatus).toBe("aguardando_ordem_compra");
  });

  it("Normal: ordem_compra → aguardando_aprovacao_compra", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_ordem_compra"];
    expect(flow.nextStatus).toBe("aguardando_aprovacao_compra");
  });

  it("Normal: aprovacao_compra → aguardando_comprovante_pagamento", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_aprovacao_compra"];
    expect(flow.nextStatus).toBe("aguardando_comprovante_pagamento");
  });

  it("Normal: comprovante_pagamento → aguardando_verificacao_compras", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_comprovante_pagamento"];
    expect(flow.nextStatus).toBe("aguardando_verificacao_compras");
  });

  it("Normal rejection at controladoria should return to aguardando_orcamento", () => {
    const prevStatus = REJECT_FLOW_NORMAL["aguardando_controladoria"];
    expect(prevStatus).toBe("aguardando_orcamento");
  });

  it("Normal rejection at diretoria should return to aguardando_controladoria", () => {
    const prevStatus = REJECT_FLOW_NORMAL["aguardando_diretoria"];
    expect(prevStatus).toBe("aguardando_controladoria");
  });
});

describe("Procurement: Urgent/Emergency Approval Flow", () => {
  it("Urgent: gerente → aguardando_diretoria (different from normal)", () => {
    const flow = STEP_FLOW_URGENT["aguardando_gerente"];
    expect(flow.nextStatus).toBe("aguardando_diretoria");
  });

  it("Urgent: diretoria → aguardando_orcamento (different from normal)", () => {
    const flow = STEP_FLOW_URGENT["aguardando_diretoria"];
    expect(flow.nextStatus).toBe("aguardando_orcamento");
  });

  it("Urgent: orcamento → aguardando_controladoria", () => {
    const flow = STEP_FLOW_URGENT["aguardando_orcamento"];
    expect(flow.nextStatus).toBe("aguardando_controladoria");
  });

  it("Urgent: controladoria → aguardando_ordem_compra (skips diretoria)", () => {
    const flow = STEP_FLOW_URGENT["aguardando_controladoria"];
    expect(flow.nextStatus).toBe("aguardando_ordem_compra");
  });

  it("Urgent rejection at diretoria should return to aguardando_gerente", () => {
    const prevStatus = REJECT_FLOW_URGENT["aguardando_diretoria"];
    expect(prevStatus).toBe("aguardando_gerente");
  });

  it("Urgent rejection at controladoria should return to aguardando_orcamento", () => {
    const prevStatus = REJECT_FLOW_URGENT["aguardando_controladoria"];
    expect(prevStatus).toBe("aguardando_orcamento");
  });

  it("getStepFlow returns urgent flow for 'urgente'", () => {
    const flow = getStepFlow("urgente");
    expect(flow["aguardando_gerente"].nextStatus).toBe("aguardando_diretoria");
  });

  it("getStepFlow returns urgent flow for 'emergencial'", () => {
    const flow = getStepFlow("emergencial");
    expect(flow["aguardando_gerente"].nextStatus).toBe("aguardando_diretoria");
  });

  it("getStepFlow returns normal flow for 'normal'", () => {
    const flow = getStepFlow("normal");
    expect(flow["aguardando_gerente"].nextStatus).toBe("aguardando_orcamento");
  });
});

describe("Procurement: submitBudget Validation", () => {
  it("Should fail if status is not aguardando_orcamento", () => {
    const result = validateSubmitBudget({ status: "aguardando_gerente", budgetFileUrl: "http://example.com/file.pdf" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("aguardando orçamento");
  });

  it("Should fail if budgetFileUrl is null", () => {
    const result = validateSubmitBudget({ status: "aguardando_orcamento", budgetFileUrl: null });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("PDF do orçamento");
  });

  it("Should succeed when status is correct and file is attached", () => {
    const result = validateSubmitBudget({ status: "aguardando_orcamento", budgetFileUrl: "http://example.com/budget.pdf" });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("Normal flow: submitBudget advances to aguardando_controladoria", () => {
    const flow = STEP_FLOW_NORMAL["aguardando_orcamento"];
    expect(flow.nextStatus).toBe("aguardando_controladoria");
    expect(flow.step).toBe("orcamento");
    expect(flow.action).toBe("aprovada");
  });

  it("Urgent flow: submitBudget also advances to aguardando_controladoria", () => {
    const flow = STEP_FLOW_URGENT["aguardando_orcamento"];
    expect(flow.nextStatus).toBe("aguardando_controladoria");
    expect(flow.step).toBe("orcamento");
    expect(flow.action).toBe("aprovada");
  });
});

describe("Procurement: Request Number Generation", () => {
  function generateRequestNumber(year: number, sequence: number): string {
    const seq = String(sequence).padStart(4, "0");
    return `SOL-${year}-${seq}`;
  }

  it("Request number should follow SOL-YYYY-NNNN format", () => {
    const number = generateRequestNumber(2026, 1);
    expect(number).toMatch(/^SOL-\d{4}-\d{4}$/);
  });

  it("Request number should start with SOL-", () => {
    const number = generateRequestNumber(2026, 1);
    expect(number.startsWith("SOL-")).toBe(true);
  });

  it("Sequence should be zero-padded to 4 digits", () => {
    expect(generateRequestNumber(2026, 1)).toBe("SOL-2026-0001");
    expect(generateRequestNumber(2026, 42)).toBe("SOL-2026-0042");
    expect(generateRequestNumber(2026, 1000)).toBe("SOL-2026-1000");
  });
});

describe("Procurement: Total Value Calculation", () => {
  function calculateTotal(items: Array<{ quantity: string; unitPrice?: string }>): number {
    let total = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice ?? "0") || 0;
      total += qty * price;
    }
    return total;
  }

  it("Should calculate total for single item", () => {
    const items = [{ quantity: "5", unitPrice: "100.00" }];
    expect(calculateTotal(items)).toBe(500);
  });

  it("Should calculate total for multiple items", () => {
    const items = [
      { quantity: "2", unitPrice: "50.00" },
      { quantity: "3", unitPrice: "30.00" },
    ];
    expect(calculateTotal(items)).toBe(190);
  });

  it("Should return 0 for items without price", () => {
    const items = [{ quantity: "5" }];
    expect(calculateTotal(items)).toBe(0);
  });

  it("Should handle decimal quantities", () => {
    const items = [{ quantity: "1.5", unitPrice: "100.00" }];
    expect(calculateTotal(items)).toBe(150);
  });
});

// ─── Testes para múltiplos papéis e níveis de aprovação ──────────────────────

// Simula a lógica de getPendingRequestsForUser com múltiplos papéis
function getPendingStatusesForUser(role: string, extraRoles?: string[]): string[] {
  const allRoles = [role, ...(extraRoles ?? [])].filter(Boolean);
  const pendingStatuses = new Set<string>();

  for (const r of allRoles) {
    if (r === "orcamento") {
      pendingStatuses.add("aguardando_orcamento");
      pendingStatuses.add("aguardando_ordem_compra");
      pendingStatuses.add("aguardando_verificacao_compras");
    } else {
      const singleStatusMap: Record<string, string> = {
        gerente: "aguardando_gerente",
        controladoria: "aguardando_controladoria",
        diretoria: "aguardando_diretoria",
        financeiro: "aguardando_comprovante_pagamento",
      };
      const s = singleStatusMap[r];
      if (s) pendingStatuses.add(s);
    }
  }

  return [...pendingStatuses];
}

// Simula a lógica de canAct com múltiplos papéis
const ROLE_CAN_ACT_TEST: Record<string, string[]> = {
  aguardando_gerente: ["gerente"],
  aguardando_orcamento: ["orcamento"],
  aguardando_controladoria: ["controladoria"],
  aguardando_diretoria: ["diretoria"],
  aguardando_ordem_compra: ["orcamento"],
  aguardando_aprovacao_compra: ["orcamento"],
  aguardando_comprovante_pagamento: ["financeiro"],
  aguardando_verificacao_compras: ["orcamento"],
};

function canActWithMultipleRoles(currentStatus: string, userRole: string, extraRoles?: string[]): boolean {
  const allRoles = [userRole, ...(extraRoles ?? [])].filter(Boolean);
  return allRoles.some(r => ROLE_CAN_ACT_TEST[currentStatus]?.includes(r)) ?? false;
}

describe("Multi-Role: getPendingStatusesForUser", () => {
  it("Usuário com papel único gerente vê apenas aguardando_gerente", () => {
    const statuses = getPendingStatusesForUser("gerente");
    expect(statuses).toContain("aguardando_gerente");
    expect(statuses).not.toContain("aguardando_orcamento");
  });

  it("Usuário com papel único orcamento vê 3 etapas", () => {
    const statuses = getPendingStatusesForUser("orcamento");
    expect(statuses).toContain("aguardando_orcamento");
    expect(statuses).toContain("aguardando_ordem_compra");
    expect(statuses).toContain("aguardando_verificacao_compras");
  });

  it("Usuário com papéis gerente + orcamento vê etapas de ambos", () => {
    const statuses = getPendingStatusesForUser("gerente", ["orcamento"]);
    expect(statuses).toContain("aguardando_gerente");
    expect(statuses).toContain("aguardando_orcamento");
    expect(statuses).toContain("aguardando_ordem_compra");
    expect(statuses).toContain("aguardando_verificacao_compras");
  });

  it("Usuário com papéis diretoria + controladoria vê etapas de ambos", () => {
    const statuses = getPendingStatusesForUser("diretoria", ["controladoria"]);
    expect(statuses).toContain("aguardando_diretoria");
    expect(statuses).toContain("aguardando_controladoria");
    expect(statuses).not.toContain("aguardando_gerente");
  });

  it("Usuário com papel solicitante não vê nenhuma etapa pendente", () => {
    const statuses = getPendingStatusesForUser("solicitante");
    expect(statuses).toHaveLength(0);
  });

  it("Usuário com 3 papéis vê todas as etapas correspondentes", () => {
    const statuses = getPendingStatusesForUser("gerente", ["diretoria", "financeiro"]);
    expect(statuses).toContain("aguardando_gerente");
    expect(statuses).toContain("aguardando_diretoria");
    expect(statuses).toContain("aguardando_comprovante_pagamento");
  });
});

describe("Multi-Role: canAct com múltiplos papéis", () => {
  it("Usuário gerente pode agir em aguardando_gerente", () => {
    expect(canActWithMultipleRoles("aguardando_gerente", "gerente")).toBe(true);
  });

  it("Usuário gerente não pode agir em aguardando_orcamento", () => {
    expect(canActWithMultipleRoles("aguardando_orcamento", "gerente")).toBe(false);
  });

  it("Usuário gerente + orcamento pode agir em aguardando_orcamento", () => {
    expect(canActWithMultipleRoles("aguardando_orcamento", "gerente", ["orcamento"])).toBe(true);
  });

  it("Usuário diretoria + controladoria pode agir em aguardando_controladoria", () => {
    expect(canActWithMultipleRoles("aguardando_controladoria", "diretoria", ["controladoria"])).toBe(true);
  });

  it("Usuário diretoria + controladoria pode agir em aguardando_diretoria", () => {
    expect(canActWithMultipleRoles("aguardando_diretoria", "diretoria", ["controladoria"])).toBe(true);
  });

  it("Usuário solicitante com extra financeiro pode agir em aguardando_comprovante_pagamento", () => {
    expect(canActWithMultipleRoles("aguardando_comprovante_pagamento", "solicitante", ["financeiro"])).toBe(true);
  });

  it("Usuário com papel único não pode agir em etapa de outro papel", () => {
    expect(canActWithMultipleRoles("aguardando_diretoria", "gerente")).toBe(false);
    expect(canActWithMultipleRoles("aguardando_controladoria", "orcamento")).toBe(false);
  });
});
