import { describe, expect, it } from "vitest";
import { resolveCardFinancialValue } from "../lib/request-card-value";

describe("resolveCardFinancialValue", () => {
  it("uses the selected quotation value before OC when the estimate is zero", () => {
    expect(resolveCardFinancialValue({
      status: "aguardando_diretoria",
      totalEstimatedValue: "0.00",
      orderValue: "281.62",
    })).toEqual({
      value: "281.62",
      label: "Valor da Cotação",
      afterOC: false,
    });
  });

  it("keeps the estimated value as the priority before OC when present", () => {
    expect(resolveCardFinancialValue({
      status: "aguardando_diretoria",
      totalEstimatedValue: "325.90",
      orderValue: "281.62",
    })).toMatchObject({ value: "325.90", label: "Valor Estimado", afterOC: false });
  });

  it("uses the actual order value in later stages", () => {
    expect(resolveCardFinancialValue({
      status: "aguardando_aprovacao_ceo",
      totalEstimatedValue: "325.90",
      orderValue: "281.62",
    })).toMatchObject({ value: "281.62", label: "Valor da OC", afterOC: true });
  });
});
