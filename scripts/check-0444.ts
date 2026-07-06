import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { purchaseRequests, requestItems, approvalHistory } from "../drizzle/schema";

async function main() {
  const pool = createPool(process.env.DATABASE_URL as string);
  const db = drizzle(pool);

  const [req] = await db.select().from(purchaseRequests)
    .where(eq(purchaseRequests.requestNumber, "SOL-2026-0444"))
    .limit(1);

  if (!req) { console.error("Não encontrada"); await pool.end(); return; }

  console.log("=== SOLICITAÇÃO ===");
  console.log("ID:", req.id);
  console.log("Status:", req.status);
  console.log("Urgência:", (req as any).urgency);
  console.log("Tipo:", (req as any).requestType ?? "normal");
  console.log("orcamentoFeitoUrgente:", (req as any).orcamentoFeitoUrgente);

  console.log("\n=== ITENS ===");
  const items = await db.select().from(requestItems).where(eq(requestItems.requestId, req.id));
  console.table(items.map(i => ({
    id: i.id,
    description: String((i as any).description ?? "").substring(0, 30),
    qty: i.quantity,
    itemStatus: i.itemStatus,
    fulfilledQty: i.fulfilledQty,
  })));

  console.log("\n=== HISTÓRICO ===");
  const hist = await db.select().from(approvalHistory)
    .where(eq(approvalHistory.requestId, req.id));
  console.table(hist.map(h => ({
    step: h.step,
    action: h.action,
    user: h.userName,
    comment: String(h.comment ?? "").substring(0, 50),
    at: h.createdAt,
  })));

  await pool.end();
}

main().catch(console.error);
