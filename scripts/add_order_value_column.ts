import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const conn = await mysql.createConnection(url);
  try {
    // Check if column already exists
    const [rows] = await conn.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'purchaseRequests' 
      AND COLUMN_NAME = 'orderValue'
    `) as any;
    
    if (rows.length > 0) {
      console.log("✅ Column orderValue already exists");
    } else {
      await conn.execute(`
        ALTER TABLE purchaseRequests 
        ADD COLUMN orderValue DECIMAL(14,2) NULL 
        AFTER ocSiagriUrl
      `);
      console.log("✅ Column orderValue added successfully");
    }
  } catch (e: any) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
