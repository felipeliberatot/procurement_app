/**
 * Script de correção pontual:
 * Reverte SOL-2026-0525, SOL-2026-0526 e SOL-2026-0527
 * do status 'concluida' para 'aguardando_aprovacao_compra'.
 *
 * Motivo: bug no updateItemFulfillment que pulava etapas de aprovação
 * ao marcar todos os itens como comprados na Emissão de OC.
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { inArray } from "drizzle-orm";
import { purchaseRequests } from "../drizzle/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida no ambiente.");
  }

  const pool = createPool(connectionString);
  const db = drizzle(pool);

  const targets = ["SOL-2026-0525", "SOL-2026-0526", "SOL-2026-0527"];

  // Verificar estado atual
  const before = await db
    .select({ requestNumber: purchaseRequests.requestNumber, status: purchaseRequests.status })
    .from(purchaseRequests)
    .where(inArray(purchaseRequests.requestNumber, targets));

  console.log("Estado ANTES da correção:");
  console.table(before);

  // Aplicar correção (atualiza independente do status atual)
  await db
    .update(purchaseRequests)
    .set({ status: "aguardando_aprovacao_compra" as any })
    .where(inArray(purchaseRequests.requestNumber, targets));

  console.log("\nAtualização executada.");

  // Verificar estado final
  const after = await db
    .select({ requestNumber: purchaseRequests.requestNumber, status: purchaseRequests.status })
    .from(purchaseRequests)
    .where(inArray(purchaseRequests.requestNumber, targets));

  console.log("\nEstado APÓS a correção:");
  console.table(after);

  await (await pool).end();
  console.log("\nConcluído com sucesso.");
}

main().catch((err) => {
  console.error("Erro ao executar script:", err);
  process.exit(1);
});
