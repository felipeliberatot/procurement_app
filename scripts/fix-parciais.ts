/**
 * Verifica e corrige SOL-2026-0444 e SOL-2026-0394:
 * - Se todos os itens estão pendentes → reverte para 'concluida'
 * - Se há mistura de comprados/pendentes → mantém 'parcialmente_concluida' (correto)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq, inArray } from "drizzle-orm";
import { purchaseRequests, requestItems } from "../drizzle/schema";

async function main() {
  const pool = createPool(process.env.DATABASE_URL as string);
  const db = drizzle(pool);

  const numbers = ["SOL-2026-0444", "SOL-2026-0394"];

  for (const num of numbers) {
    const [req] = await db.select().from(purchaseRequests)
      .where(eq(purchaseRequests.requestNumber, num))
      .limit(1);

    if (!req) { console.log(`${num}: NÃO ENCONTRADA`); continue; }

    const items = await db.select().from(requestItems)
      .where(eq(requestItems.requestId, req.id));

    const allPending = items.every(i => i.itemStatus === "pendente");
    const anyComprado = items.some(i => i.itemStatus === "comprado");

    console.log(`\n${num} | status: ${req.status}`);
    console.log(`  Itens: ${items.length} | Todos pendentes: ${allPending} | Algum comprado: ${anyComprado}`);
    console.table(items.map(i => ({
      id: i.id,
      desc: String((i as any).description ?? "").substring(0, 25),
      itemStatus: i.itemStatus,
      fulfilledQty: i.fulfilledQty,
    })));

    if (req.status === "parcialmente_concluida" && allPending) {
      // Todos pendentes → não deveria ser parcialmente_concluida → corrigir para concluida
      await db.update(purchaseRequests)
        .set({ status: "concluida" as any })
        .where(eq(purchaseRequests.id, req.id));
      console.log(`  ✅ CORRIGIDO: ${num} → concluida`);
    } else {
      console.log(`  ℹ️  Sem correção necessária (status=${req.status}, allPending=${allPending})`);
    }
  }

  await pool.end();
  console.log("\nConcluído.");
}

main().catch(console.error);
