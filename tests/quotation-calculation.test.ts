import { describe, it, expect } from "vitest";

// Tipos de teste para o cálculo de totais nas cotações
type SupplierItem = { description: string; quantity: string; unit: string; unitPrice: string };

/**
 * Função auxiliar para calcular o total de uma cotação
 * Replica a lógica do useEffect que sincroniza os totais
 */
function calculateSupplierTotal(items: SupplierItem[]): string {
  const total = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
    const price = parseFloat(item.unitPrice.replace(/\./g, "").replace(",", ".")) || 0;
    return sum + qty * price;
  }, 0);
  return total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

describe("Quotation Total Calculation", () => {
  it("should calculate total for a single item with quantity 1", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "1", unit: "un", unitPrice: "100,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("100,00");
  });

  it("should calculate total for a single item with quantity > 1", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "5", unit: "un", unitPrice: "100,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("500,00");
  });

  it("should calculate total for multiple items", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "2", unit: "un", unitPrice: "100,00" },
      { description: "Item 2", quantity: "3", unit: "un", unitPrice: "50,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("350,00");
  });

  it("should handle decimal quantities", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "2,5", unit: "kg", unitPrice: "100,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("250,00");
  });

  it("should handle prices with thousands separator (dot)", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "1", unit: "un", unitPrice: "1.000,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("1.000,00");
  });

  it("should handle complex prices with thousands and decimals", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "2", unit: "un", unitPrice: "1.500,50" },
      { description: "Item 2", quantity: "3", unit: "un", unitPrice: "2.000,75" },
    ];
    const total = calculateSupplierTotal(items);
    // 2 * 1500.50 + 3 * 2000.75 = 3001 + 6002.25 = 9003.25
    expect(total).toBe("9.003,25");
  });

  it("should return 0,00 for empty items", () => {
    const items: SupplierItem[] = [];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("0,00");
  });

  it("should return 0,00 for items with empty prices", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "5", unit: "un", unitPrice: "" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("0,00");
  });

  it("should return 0,00 for items with empty quantities", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "", unit: "un", unitPrice: "100,00" },
    ];
    const total = calculateSupplierTotal(items);
    expect(total).toBe("0,00");
  });

  it("should handle mixed valid and invalid inputs", () => {
    const items: SupplierItem[] = [
      { description: "Item 1", quantity: "2", unit: "un", unitPrice: "100,00" },
      { description: "Item 2", quantity: "", unit: "un", unitPrice: "50,00" },
      { description: "Item 3", quantity: "1", unit: "un", unitPrice: "" },
    ];
    const total = calculateSupplierTotal(items);
    // Only Item 1 is valid: 2 * 100 = 200
    expect(total).toBe("200,00");
  });
});
