/**
 * Script para corrigir solicitações existentes que estão em etapas pós-OC
 * sem orderValue preenchido. Usa totalEstimatedValue como fallback.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { purchaseRequests } from "../drizzle/schema";
import { and, isNull, inArray } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const POST_OC_STATUSES = [
  "aguardando_aprovacao_ceo",
  "aguardando_aprovacao_compra",
  "aguardando_comprovante_pagamento",
  "aguardando_verificacao_compras",
  "parcialmente_concluida",
  "concluida",
];

async function main() {
  const pool = createPool({ uri: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Buscar solicitações pós-OC sem orderValue mas com totalEstimatedValue
  const rows = await db
    .select({
      id: purchaseRequests.id,
      requestNumber: purchaseRequests.requestNumber,
      status: purchaseRequests.status,
      orderValue: purchaseRequests.orderValue,
      totalEstimatedValue: purchaseRequests.totalEstimatedValue,
    })
    .from(purchaseRequests)
    .where(
      and(
        inArray(purchaseRequests.status, POST_OC_STATUSES as any[]),
        isNull(purchaseRequests.orderValue)
      )
    );

  const toFix = rows.filter((r: any) => r.totalEstimatedValue && parseFloat(r.totalEstimatedValue) > 0);
  console.log(`Total sem orderValue em etapas pós-OC: ${rows.length}`);
  console.log(`Com totalEstimatedValue para usar como fallback: ${toFix.length}`);

  let updated = 0;
  for (const row of toFix) {
    await db
      .update(purchaseRequests)
      .set({ orderValue: (row as any).totalEstimatedValue })
      .where(inArray(purchaseRequests.id, [(row as any).id]));
    console.log(`  ✅ ${(row as any).requestNumber} (${(row as any).status}): orderValue = ${(row as any).totalEstimatedValue}`);
    updated++;
  }

  console.log(`\n✅ ${updated} solicitações atualizadas com orderValue.`);
  await pool.end();
}

main().catch(e => {
  console.error("Erro:", e);
  process.exit(1);
});
