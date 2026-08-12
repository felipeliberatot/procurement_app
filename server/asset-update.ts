export type AssetUpdateInput = {
  id: number;
  code?: string;
  description?: string;
  category?: string;
  location?: string;
  active?: boolean;
  value?: string;
  hasChassi?: boolean;
  chassiNumber?: string;
  licensePlate?: string;
};

/**
 * Separa a chave primária dos campos que podem ser persistidos no SET.
 * O banco deve usar o id apenas na cláusula WHERE do UPDATE.
 */
export function splitAssetUpdateInput(input: AssetUpdateInput) {
  const { id, ...data } = input;
  return { id, data };
}
