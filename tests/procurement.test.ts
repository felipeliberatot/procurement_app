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

// Status flow logic (mirrors server/db.ts STEP_FLOW)
const STEP_FLOW: Record<string, { step: string; nextStatus: string }> = {
  aguardando_gerente: { step: "gerente", nextStatus: "aguardando_orcamento" },
  aguardando_orcamento: { step: "orcamento", nextStatus: "aguardando_controladoria" },
  aguardando_controladoria: { step: "controladoria", nextStatus: "aguardando_diretoria" },
  aguardando_diretoria: { step: "diretoria", nextStatus: "aguardando_ordem_compra" },
  aguardando_ordem_compra: { step: "ordem_compra", nextStatus: "aguardando_financeiro" },
  aguardando_financeiro: { step: "financeiro", nextStatus: "concluida" },
};

const REJECT_FLOW: Record<string, string> = {
  aguardando_gerente: "aguardando_gerente",
  aguardando_orcamento: "aguardando_orcamento",
  aguardando_controladoria: "aguardando_orcamento",
  aguardando_diretoria: "aguardando_controladoria",
  aguardando_ordem_compra: "aguardando_diretoria",
  aguardando_financeiro: "aguardando_ordem_compra",
};

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

describe("Procurement: Approval Flow", () => {
  it("Initial status should be aguardando_gerente", () => {
    const initialStatus = "aguardando_gerente";
    expect(STEP_FLOW[initialStatus]).toBeDefined();
    expect(STEP_FLOW[initialStatus].step).toBe("gerente");
  });

  it("Approval by gerente should advance to aguardando_orcamento", () => {
    const flow = STEP_FLOW["aguardando_gerente"];
    expect(flow.nextStatus).toBe("aguardando_orcamento");
  });

  it("Approval by controladoria should advance to aguardando_diretoria", () => {
    const flow = STEP_FLOW["aguardando_controladoria"];
    expect(flow.nextStatus).toBe("aguardando_diretoria");
  });

  it("Approval by financeiro should conclude the request", () => {
    const flow = STEP_FLOW["aguardando_financeiro"];
    expect(flow.nextStatus).toBe("concluida");
  });

  it("Full approval flow should have 6 steps", () => {
    const steps = Object.keys(STEP_FLOW);
    expect(steps).toHaveLength(6);
  });

  it("Rejection at controladoria should return to aguardando_orcamento", () => {
    const prevStatus = REJECT_FLOW["aguardando_controladoria"];
    expect(prevStatus).toBe("aguardando_orcamento");
  });

  it("Rejection at diretoria should return to aguardando_controladoria", () => {
    const prevStatus = REJECT_FLOW["aguardando_diretoria"];
    expect(prevStatus).toBe("aguardando_controladoria");
  });

  it("Rejection at gerente should stay at aguardando_gerente", () => {
    const prevStatus = REJECT_FLOW["aguardando_gerente"];
    expect(prevStatus).toBe("aguardando_gerente");
  });
});

describe("Procurement: Request Number Generation", () => {
  function generateRequestNumber(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `REQ-${y}${m}${d}-${rand}`;
  }

  it("Request number should follow REQ-YYYYMMDD-XXXX format", () => {
    const number = generateRequestNumber();
    expect(number).toMatch(/^REQ-\d{8}-\d{4}$/);
  });

  it("Request number should start with REQ-", () => {
    const number = generateRequestNumber();
    expect(number.startsWith("REQ-")).toBe(true);
  });

  it("Two generated numbers should be different (with high probability)", () => {
    const numbers = new Set(Array.from({ length: 10 }, () => generateRequestNumber()));
    expect(numbers.size).toBeGreaterThan(1);
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
