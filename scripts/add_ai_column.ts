import "./load-env.js";
import mysql2 from "mysql2/promise";

async function main() {
  const conn = await mysql2.createConnection(process.env.DATABASE_URL!);
  try {
    await conn.execute(
      "ALTER TABLE purchaseRequests ADD COLUMN IF NOT EXISTS aiAnalysis LONGTEXT NULL"
    );
    console.log("✅ Column aiAnalysis added successfully");
  } catch (err: any) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️  Column aiAnalysis already exists");
    } else {
      throw err;
    }
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
