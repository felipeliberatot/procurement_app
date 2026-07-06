/**
 * Correção da SOL-2026-0520:
 * 1. Reverte o status para 'aguardando_ordem_compra' (próxima etapa após Controladoria no fluxo urgente)
 * 2. Limpa os itemStatus e fulfilledQty dos itens (foram marcados prematuramente)
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { purchaseRequests, requestItems } from "../drizzle/schema";

async function main() {
  const pool = createPool(process.env.DATABASE_URL as string);
  const db = drizzle(pool);

  const rows = await db.select().from(purchaseRequests)
    .where(eq(purchaseRequests.requestNumber, "SOL-2026-0520"))
    .limit(1);
  const req = rows[0];

  if (!req) {
    console.error("SOL-2026-0520 não encontrada!");
    await pool.end();
    return;
  }

  console.log("Status atual:", req.status, "| id:", req.id);

  // 1. Reverter status para aguardando_ordem_compra
  await db.update(purchaseRequests)
    .set({ status: "aguardando_ordem_compra" as any })
    .where(eq(purchaseRequests.id, req.id));

  // 2. Limpar itemStatus e fulfilledQty dos itens (foram marcados antes da hora)
  await db.update(requestItems)
    .set({ itemStatus: "pendente" as any, fulfilledQty: "0" })
    .where(eq(requestItems.requestId, req.id));

  // Verificar resultado
  const [updated] = await db.select({ status: purchaseRequests.status })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, req.id))
    .limit(1);

  const items = await db.select().from(requestItems)
    .where(eq(requestItems.requestId, req.id));

  console.log("\nStatus após correção:", updated?.status);
  console.log("Itens após limpeza:");
  console.table(items.map(i => ({
    id: i.id,
    description: (i as any).description?.substring(0, 30),
    itemStatus: i.itemStatus,
    fulfilledQty: i.fulfilledQty,
  })));

  await pool.end();
  console.log("\nConcluído.");
}

main().catch(console.error);
