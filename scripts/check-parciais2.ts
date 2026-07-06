import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { purchaseRequests, requestItems } from "../drizzle/schema";

async function main() {
  const pool = createPool(process.env.DATABASE_URL as string);
  const db = drizzle(pool);

  for (const num of ["SOL-2026-0508", "SOL-2026-0520"]) {
    const [req] = await db.select().from(purchaseRequests)
      .where(eq(purchaseRequests.requestNumber, num)).limit(1);
    if (!req) { console.log(`${num}: NÃO ENCONTRADA`); continue; }
    const items = await db.select().from(requestItems).where(eq(requestItems.requestId, req.id));
    console.log(`\n${num} | status: ${req.status} | id: ${req.id}`);
    console.table(items.map(i => ({
      id: i.id,
      desc: String((i as any).description ?? "").substring(0, 30),
      qty: i.quantity,
      itemStatus: i.itemStatus,
      fulfilledQty: i.fulfilledQty,
    })));
  }

  await pool.end();
}
main().catch(console.error);
