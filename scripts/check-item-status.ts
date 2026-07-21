import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL as string);
  const db = drizzle(connection, { schema, mode: "default" });
  
  // Verificar itens da solicitação 12720001
  const items = await db.select({
    id: schema.requestItems.id,
    requestId: schema.requestItems.requestId,
    description: schema.requestItems.description,
    itemStatus: schema.requestItems.itemStatus,
  }).from(schema.requestItems).where(eq(schema.requestItems.requestId, 12720001));
  
  console.log("Itens da SOL 12720001:");
  console.log(JSON.stringify(items, null, 2));
  
  // Verificar também se há outros itens com status 'comprado' em solicitações não finalizadas
  const allProblematic = await db.execute(
    `SELECT ri.id, ri.requestId, ri.description, ri.itemStatus, pr.status as reqStatus
     FROM request_items ri
     JOIN purchase_requests pr ON ri.requestId = pr.id
     WHERE ri.itemStatus = 'comprado'
     AND pr.status NOT IN ('concluida', 'parcialmente_concluida')
     LIMIT 20`
  );
  console.log("\nItens 'comprado' em solicitações não finalizadas:");
  console.log(JSON.stringify(allProblematic[0], null, 2));
  
  await connection.end();
}

main().catch(console.error);
