import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  // Verificar se a coluna existe
  const [rows] = await conn.execute("SHOW COLUMNS FROM purchaseRequests LIKE 'aiAnalysis'") as any[];
  console.log('aiAnalysis column exists:', rows.length > 0);
  
  if (rows.length === 0) {
    console.log('Adding aiAnalysis column...');
    await conn.execute("ALTER TABLE purchaseRequests ADD COLUMN aiAnalysis TEXT NULL DEFAULT NULL");
    console.log('Column added successfully!');
  } else {
    console.log('Column already exists:', JSON.stringify(rows[0]));
  }
  
  // Verificar todas as colunas
  const [allCols] = await conn.execute("SHOW COLUMNS FROM purchaseRequests") as any[];
  console.log('All columns:', (allCols as any[]).map((r: any) => r.Field).join(', '));
  
  await conn.end();
}

main().catch(console.error);
