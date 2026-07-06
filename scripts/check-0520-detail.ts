import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { purchaseRequests, approvalHistory } from "../drizzle/schema";

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
    const history = await db.select().from(approvalHistory)
      .where(eq(approvalHistory.requestId, req.id));
    console.log("\nHistórico completo:");
    console.table(history.map(h => ({
      step: h.step,
      action: h.action,
      user: h.userName,
      date: h.createdAt?.toISOString?.() ?? h.createdAt
    })));
  }

  await pool.end();
}

main().catch(console.error);
