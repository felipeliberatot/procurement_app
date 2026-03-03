import { describe, expect, it } from "vitest";

// ─── Testes para a lógica de agrupamento do Relatório Mensal ─────────────────
// Espelha a lógica de getMonthlyReport em server/db.ts

type MockRequest = {
  id: number;
  status: string;
  department: string;
  urgencyLevel: string;
  createdAt: Date;
};

function buildMonthlySummary(requests: MockRequest[]) {
  return {
    total: requests.length,
    concluidas: requests.filter(r => r.status === "concluida").length,
    pendentes: requests.filter(r => r.status.startsWith("aguardando")).length,
    rejeitadas: requests.filter(r => r.status === "rejeitada").length,
    canceladas: requests.filter(r => r.status === "cancelada").length,
  };
}

function buildByDepartment(requests: MockRequest[]) {
  const map = new Map<string, { department: string; total: number; concluidas: number; pendentes: number; rejeitadas: number }>();
  for (const r of requests) {
    const dept = r.department || "Não informado";
    if (!map.has(dept)) map.set(dept, { department: dept, total: 0, concluidas: 0, pendentes: 0, rejeitadas: 0 });
    const entry = map.get(dept)!;
    entry.total++;
    if (r.status === "concluida") entry.concluidas++;
    else if (r.status.startsWith("aguardando")) entry.pendentes++;
    else if (r.status === "rejeitada" || r.status === "cancelada") entry.rejeitadas++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function buildByStatus(requests: MockRequest[]) {
  const map = new Map<string, number>();
  for (const r of requests) {
    map.set(r.status, (map.get(r.status) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

function filterByMonth(requests: MockRequest[], year: number, month: number) {
  return requests.filter(r => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

const SAMPLE_REQUESTS: MockRequest[] = [
  { id: 1, status: "concluida",              department: "TI",      urgencyLevel: "normal",      createdAt: new Date(2025, 2, 5) },
  { id: 2, status: "aguardando_gerente",     department: "TI",      urgencyLevel: "urgente",     createdAt: new Date(2025, 2, 10) },
  { id: 3, status: "rejeitada",              department: "Compras", urgencyLevel: "normal",      createdAt: new Date(2025, 2, 15) },
  { id: 4, status: "cancelada",              department: "Compras", urgencyLevel: "emergencial", createdAt: new Date(2025, 2, 20) },
  { id: 5, status: "concluida",              department: "TI",      urgencyLevel: "normal",      createdAt: new Date(2025, 2, 25) },
  { id: 6, status: "aguardando_diretoria",   department: "RH",      urgencyLevel: "normal",      createdAt: new Date(2025, 3, 1) },
];

describe("Relatório Mensal: filtro por mês/ano", () => {
  it("Filtra apenas solicitações do mês/ano correto", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    expect(filtered).toHaveLength(5);
    expect(filtered.every(r => new Date(r.createdAt).getMonth() + 1 === 3)).toBe(true);
  });

  it("Não inclui solicitações de outros meses", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    expect(filtered.some(r => r.id === 6)).toBe(false);
  });

  it("Retorna array vazio para mês sem solicitações", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 2);
    expect(filtered).toHaveLength(0);
  });

  it("Filtra corretamente para abril/2025", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 4);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(6);
  });
});

describe("Relatório Mensal: resumo geral", () => {
  it("Calcula resumo correto para março/2025", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const summary = buildMonthlySummary(filtered);
    expect(summary.total).toBe(5);
    expect(summary.concluidas).toBe(2);
    expect(summary.pendentes).toBe(1);
    expect(summary.rejeitadas).toBe(1);
    expect(summary.canceladas).toBe(1);
  });

  it("Retorna zeros para mês sem solicitações", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 2);
    const summary = buildMonthlySummary(filtered);
    expect(summary.total).toBe(0);
    expect(summary.concluidas).toBe(0);
    expect(summary.pendentes).toBe(0);
    expect(summary.rejeitadas).toBe(0);
    expect(summary.canceladas).toBe(0);
  });

  it("Conta corretamente status aguardando como pendentes", () => {
    const requests: MockRequest[] = [
      { id: 1, status: "aguardando_gerente",       department: "TI", urgencyLevel: "normal", createdAt: new Date(2025, 2, 1) },
      { id: 2, status: "aguardando_controladoria", department: "TI", urgencyLevel: "normal", createdAt: new Date(2025, 2, 2) },
      { id: 3, status: "aguardando_diretoria",     department: "TI", urgencyLevel: "normal", createdAt: new Date(2025, 2, 3) },
    ];
    const summary = buildMonthlySummary(requests);
    expect(summary.pendentes).toBe(3);
    expect(summary.concluidas).toBe(0);
  });
});

describe("Relatório Mensal: agrupamento por departamento", () => {
  it("Agrupa corretamente por departamento", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byDept = buildByDepartment(filtered);
    const ti = byDept.find(d => d.department === "TI");
    expect(ti).toBeDefined();
    expect(ti!.total).toBe(3);
    expect(ti!.concluidas).toBe(2);
    expect(ti!.pendentes).toBe(1);
  });

  it("Ordena departamentos por total decrescente", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byDept = buildByDepartment(filtered);
    expect(byDept[0].department).toBe("TI");
    for (let i = 1; i < byDept.length; i++) {
      expect(byDept[i].total).toBeLessThanOrEqual(byDept[i - 1].total);
    }
  });

  it("Conta rejeitadas e canceladas no campo rejeitadas", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byDept = buildByDepartment(filtered);
    const compras = byDept.find(d => d.department === "Compras");
    expect(compras!.rejeitadas).toBe(2);
  });

  it("Usa 'Não informado' para departamento vazio", () => {
    const withEmpty: MockRequest[] = [
      { id: 99, status: "concluida", department: "", urgencyLevel: "normal", createdAt: new Date(2025, 2, 1) },
    ];
    const byDept = buildByDepartment(withEmpty);
    expect(byDept[0].department).toBe("Não informado");
  });

  it("Cada departamento tem contagens consistentes (total = concluidas + pendentes + rejeitadas)", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byDept = buildByDepartment(filtered);
    for (const dept of byDept) {
      expect(dept.concluidas + dept.pendentes + dept.rejeitadas).toBe(dept.total);
    }
  });
});

describe("Relatório Mensal: agrupamento por status", () => {
  it("Agrupa corretamente por status", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byStatus = buildByStatus(filtered);
    const concluida = byStatus.find(s => s.status === "concluida");
    expect(concluida).toBeDefined();
    expect(concluida!.count).toBe(2);
  });

  it("Ordena por contagem decrescente", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byStatus = buildByStatus(filtered);
    for (let i = 1; i < byStatus.length; i++) {
      expect(byStatus[i].count).toBeLessThanOrEqual(byStatus[i - 1].count);
    }
  });

  it("Soma de todos os status = total de solicitações", () => {
    const filtered = filterByMonth(SAMPLE_REQUESTS, 2025, 3);
    const byStatus = buildByStatus(filtered);
    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(filtered.length);
  });
});
