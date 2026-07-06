import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { purchaseRequests, approvalHistory, requestItems } from "../drizzle/schema";

async function main() {
  const pool = createPool(process.env.DATABASE_URL as string);
  const db = drizzle(pool);

  const rows = await db.select().from(purchaseRequests)
    .where(eq(purchaseRequests.requestNumber, "SOL-2026-0520"))
    .limit(1);
  const req = rows[0];

  console.log("=== SOL-2026-0520 ===");
  console.log("Status:", req?.status);
  console.log("urgencyLevel:", req?.urgencyLevel);
  console.log("orcamentoFeitoUrgente:", req?.orcamentoFeitoUrgente);
  console.log("id:", req?.id);

  if (req) {
    // Histórico completo
    const history = await db.select().from(approvalHistory)
      .where(eq(approvalHistory.requestId, req.id));
    console.log("\nHistórico completo (todos os registros):");
    console.table(history.map(h => ({
      id: h.id,
      step: h.step,
      action: h.action,
      user: h.userName,
      comment: h.comment?.substring(0, 50),
      date: h.createdAt?.toISOString?.() ?? h.createdAt
    })));

    // Itens da solicitação
    const items = await db.select().from(requestItems)
      .where(eq(requestItems.requestId, req.id));
    console.log("\nItens da solicitação:");
    console.table(items.map(i => ({
      id: i.id,
      description: (i as any).description?.substring(0, 30),
      quantity: i.quantity,
      itemStatus: i.itemStatus,
      fulfilledQty: i.fulfilledQty,
    })));
  }

  await pool.end();
}

main().catch(console.error);
