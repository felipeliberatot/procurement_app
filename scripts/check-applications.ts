import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { purchaseRequests } from "../drizzle/schema";
import { inArray } from "drizzle-orm";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const pool = createPool({ uri: process.env.DATABASE_URL });
  const db = drizzle(pool);
  const rows = await db
    .select({ id: purchaseRequests.id, application: purchaseRequests.application, status: purchaseRequests.status, completedAt: purchaseRequests.completedAt })
    .from(purchaseRequests)
    .where(inArray(purchaseRequests.status, ["concluida", "parcialmente_concluida"] as any[]))
    .limit(10);
  console.log("Sample concluded requests:");
  rows.forEach(r => console.log(`  id=${r.id} status=${r.status} application="${r.application}" completedAt=${r.completedAt}`));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
