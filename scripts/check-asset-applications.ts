import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { purchaseRequests } from "../drizzle/schema";
import { like, or, inArray } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const pool = createPool({ uri: process.env.DATABASE_URL });
  const db = drizzle(pool);

  // Buscar solicitações cujo application tem o formato CÓDIGO — DESCRIÇÃO (contém " — ")
  const rows = await db
    .select({
      id: purchaseRequests.id,
      requestNumber: purchaseRequests.requestNumber,
      application: purchaseRequests.application,
      status: purchaseRequests.status,
      completedAt: purchaseRequests.completedAt,
      orderValue: purchaseRequests.orderValue,
      totalEstimatedValue: purchaseRequests.totalEstimatedValue,
    })
    .from(purchaseRequests)
    .where(like(purchaseRequests.application, "% — %"))
    .limit(20);

  console.log(`Solicitações com bem vinculado (formato CÓDIGO — DESCRIÇÃO): ${rows.length}`);
  rows.forEach(r => console.log(`  #${r.requestNumber} status=${r.status} application="${r.application}" completedAt=${r.completedAt} orderValue=${r.orderValue}`));

  // Verificar quantas estão concluídas
  const concluded = rows.filter(r => r.status === "concluida" || r.status === "parcialmente_concluida");
  console.log(`\nConcluídas: ${concluded.length}`);
  concluded.forEach(r => console.log(`  #${r.requestNumber} completedAt=${r.completedAt} orderValue=${r.orderValue}`));

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
