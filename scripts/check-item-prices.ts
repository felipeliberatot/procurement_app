import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { purchaseRequests, requestItems } from "../drizzle/schema";
import { and, isNull, inArray, like, eq, sql } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const pool = createPool({ uri: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Buscar solicitações concluídas com bem vinculado sem orderValue
  const rows = await db
    .select({
      id: purchaseRequests.id,
      requestNumber: purchaseRequests.requestNumber,
      application: purchaseRequests.application,
      orderValue: purchaseRequests.orderValue,
      totalEstimatedValue: purchaseRequests.totalEstimatedValue,
    })
    .from(purchaseRequests)
    .where(
      and(
        inArray(purchaseRequests.status, ["concluida", "parcialmente_concluida"] as any[]),
        isNull(purchaseRequests.orderValue),
        like(purchaseRequests.application, "% — %")
      )
    )
    .limit(5);

  console.log(`Amostra de solicitações sem orderValue:`);
  for (const row of rows) {
    // Buscar itens da solicitação
    const items = await db
      .select({
        description: requestItems.description,
        totalPrice: requestItems.totalPrice,
        unitPrice: requestItems.unitPrice,
        quantity: requestItems.quantity,
      })
      .from(requestItems)
      .where(eq(requestItems.requestId, row.id));

    const itemsTotal = items.reduce((sum, i) => sum + parseFloat(i.totalPrice ?? i.unitPrice ?? "0"), 0);
    console.log(`  #${row.requestNumber} [${row.application?.split(" — ")[0]}] orderValue=${row.orderValue} totalEstimated=${row.totalEstimatedValue}`);
    console.log(`    Items (${items.length}): total=${itemsTotal.toFixed(2)}`);
    items.forEach(i => console.log(`      - "${i.description}" qty=${i.quantity} unitPrice=${i.unitPrice} totalPrice=${i.totalPrice}`));
  }

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
