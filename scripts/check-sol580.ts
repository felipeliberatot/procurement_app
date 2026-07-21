import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL as string);
  
  // Status da solicitação
  const [reqs] = await connection.execute(
    "SELECT id, requestNumber, status FROM purchaseRequests WHERE id = 12720001"
  );
  console.log("Solicitação:", JSON.stringify(reqs, null, 2));
  
  // Itens
  const [rows] = await connection.execute(
    "SELECT id, description, itemStatus FROM requestItems WHERE requestId = 12720001"
  );
  console.log("Itens:", JSON.stringify(rows, null, 2));
  
  await connection.end();
}
main().catch(console.error);
