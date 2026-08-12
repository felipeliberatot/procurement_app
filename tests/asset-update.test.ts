import { describe, expect, it } from "vitest";

import { splitAssetUpdateInput } from "../server/asset-update";

describe("Atualização de bens patrimoniais", () => {
  it("mantém o id somente para o WHERE e não nos campos editáveis", () => {
    const result = splitAssetUpdateInput({
      id: 810001,
      code: "MQ-186",
      description: "TRATOR VALMET 85",
      category: "TRATORES",
      value: "100.000,00",
      hasChassi: false,
    });

    expect(result.id).toBe(810001);
    expect(result.data).toEqual({
      code: "MQ-186",
      description: "TRATOR VALMET 85",
      category: "TRATORES",
      value: "100.000,00",
      hasChassi: false,
    });
    expect(result.data).not.toHaveProperty("id");
  });

  it("preserva os campos opcionais de chassi e placa para atualização", () => {
    const result = splitAssetUpdateInput({
      id: 42,
      hasChassi: true,
      chassiNumber: "9BD123456789",
      licensePlate: "ABC1D23",
    });

    expect(result).toEqual({
      id: 42,
      data: {
        hasChassi: true,
        chassiNumber: "9BD123456789",
        licensePlate: "ABC1D23",
      },
    });
  });
});
