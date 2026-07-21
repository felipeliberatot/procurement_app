import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL as string);
  
  // Verificar ENUM da coluna itemStatus
  const [cols] = await connection.execute(
    "SHOW COLUMNS FROM requestItems WHERE Field = 'itemStatus'"
  );
  console.log("ENUM atual:", JSON.stringify(cols, null, 2));
  
  // Verificar os itens da SOL 12720001
  const [rows] = await connection.execute(
    "SELECT id, description, itemStatus FROM requestItems WHERE requestId = 12720001"
  );
  console.log("Itens SOL 12720001:", JSON.stringify(rows, null, 2));
  
  await connection.end();
}
main().catch(console.error);
