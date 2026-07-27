import { describe, expect, it } from "vitest";

// ─── Testes para a lógica de filtro de período no Relatório Por C. Custo ──────
// Espelha a lógica de periodFilteredRequests em app/(tabs)/report.tsx
// A abordagem é: buscar TODOS os dados do CC sem filtro de data no servidor,
// e filtrar por período no cliente. Isso garante que "Todos" sempre funcione.

type MockCCRequest = {
  id: number;
  costCenterCode: string;
  status: string;
  fuelType?: string | null;
  maintenanceType?: string | null;
  orderValue?: string | null;
  totalEstimatedValue?: string | null;
  completedAt?: Date | null;
  createdAt: Date;
};

function periodFilteredRequests(
  requests: MockCCRequest[],
  selectedYear: number | null,
  selectedMonth: number | null
): MockCCRequest[] {
  return requests.filter((r) => {
    const baseDate = r.completedAt ?? r.createdAt;
    if (!baseDate) return false;
    const date = new Date(baseDate);
    if (selectedYear && date.getFullYear() !== selectedYear) return false;
    if (selectedMonth && date.getMonth() + 1 !== selectedMonth) return false;
    return true;
  });
}

function periodSummary(requests: MockCCRequest[]) {
  const totalGasto = requests.reduce(
    (sum, r) => sum + parseFloat(r.orderValue ?? r.totalEstimatedValue ?? "0"),
    0
  );
  return {
    totalSolicitacoes: requests.length,
    totalGasto: Math.round(totalGasto * 100) / 100,
  };
}

const SAMPLE_CC_REQUESTS: MockCCRequest[] = [
  { id: 1, costCenterCode: "OP-001", status: "concluida", fuelType: "diesel",    orderValue: "1500.00", completedAt: new Date(2024, 0, 15), createdAt: new Date(2024, 0, 10) },
  { id: 2, costCenterCode: "OP-001", status: "concluida", fuelType: "diesel_s10", orderValue: "2000.00", completedAt: new Date(2024, 5, 20), createdAt: new Date(2024, 5, 15) },
  { id: 3, costCenterCode: "OP-001", status: "concluida", fuelType: null,         orderValue: "800.00",  completedAt: new Date(2025, 2, 10), createdAt: new Date(2025, 2, 5) },
  { id: 4, costCenterCode: "OP-001", status: "concluida", fuelType: "diesel",    orderValue: "1200.00", completedAt: new Date(2025, 2, 25), createdAt: new Date(2025, 2, 20) },
  { id: 5, costCenterCode: "OP-001", status: "concluida", fuelType: "lubrificantes", orderValue: "500.00", completedAt: new Date(2025, 6, 5), createdAt: new Date(2025, 6, 1) },
  { id: 6, costCenterCode: "OP-001", status: "parcialmente_concluida", fuelType: null, orderValue: "300.00", completedAt: new Date(2025, 11, 1), createdAt: new Date(2025, 10, 28) },
];

describe("Relatório Por C. Custo: filtro de período no cliente", () => {
  it("Retorna todos os registros quando year=null e month=null (Todos)", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, null);
    expect(result).toHaveLength(6);
  });

  it("Filtra corretamente por ano específico", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2025, null);
    expect(result).toHaveLength(4);
    expect(result.every(r => new Date(r.completedAt ?? r.createdAt).getFullYear() === 2025)).toBe(true);
  });

  it("Filtra corretamente por mês específico dentro de um ano", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2025, 3);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id).sort()).toEqual([3, 4]);
  });

  it("Filtra corretamente por mês sem especificar ano (todos os anos)", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("Retorna array vazio para período sem registros", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2023, null);
    expect(result).toHaveLength(0);
  });

  it("Filtra corretamente por ano 2024", () => {
    const result = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2024, null);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id).sort()).toEqual([1, 2]);
  });

  it("Usa completedAt como data base quando disponível", () => {
    // Registro com completedAt em março/2025 mas createdAt em fevereiro/2025
    const requests: MockCCRequest[] = [
      { id: 99, costCenterCode: "OP-001", status: "concluida", completedAt: new Date(2025, 2, 10), createdAt: new Date(2025, 1, 5) },
    ];
    const result = periodFilteredRequests(requests, 2025, 3);
    expect(result).toHaveLength(1);
    const resultFev = periodFilteredRequests(requests, 2025, 2);
    expect(resultFev).toHaveLength(0);
  });

  it("Usa createdAt quando completedAt é null", () => {
    const requests: MockCCRequest[] = [
      { id: 100, costCenterCode: "OP-001", status: "concluida", completedAt: null, createdAt: new Date(2025, 3, 15) },
    ];
    const result = periodFilteredRequests(requests, 2025, 4);
    expect(result).toHaveLength(1);
  });
});

describe("Relatório Por C. Custo: cálculo de resumo de período", () => {
  it("Calcula corretamente o total gasto para Todos", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, null);
    const summary = periodSummary(reqs);
    expect(summary.totalSolicitacoes).toBe(6);
    expect(summary.totalGasto).toBe(6300.00);
  });

  it("Calcula corretamente o total gasto para 2025", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2025, null);
    const summary = periodSummary(reqs);
    expect(summary.totalSolicitacoes).toBe(4);
    expect(summary.totalGasto).toBe(2800.00);
  });

  it("Calcula corretamente o total gasto para março/2025", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2025, 3);
    const summary = periodSummary(reqs);
    expect(summary.totalSolicitacoes).toBe(2);
    expect(summary.totalGasto).toBe(2000.00);
  });

  it("Retorna zeros para período sem registros", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, 2023, null);
    const summary = periodSummary(reqs);
    expect(summary.totalSolicitacoes).toBe(0);
    expect(summary.totalGasto).toBe(0);
  });
});

describe("Relatório Por C. Custo: filtro de subtipo (combustível)", () => {
  it("Filtra corretamente por tipo de combustível diesel", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, null);
    const diesel = reqs.filter(r => r.fuelType === "diesel");
    expect(diesel).toHaveLength(2);
  });

  it("Inclui registros sem fuelType quando nenhum filtro ativo", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, null);
    const noFuel = reqs.filter(r => !r.fuelType);
    expect(noFuel).toHaveLength(2);
  });

  it("Filtra corretamente por múltiplos tipos de combustível", () => {
    const reqs = periodFilteredRequests(SAMPLE_CC_REQUESTS, null, null);
    const activeFuelFilters = ["diesel", "diesel_s10"];
    const filtered = reqs.filter(r => activeFuelFilters.includes(r.fuelType ?? ""));
    expect(filtered).toHaveLength(3);
  });
});
