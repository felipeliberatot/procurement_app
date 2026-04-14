import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [rows] = await conn.execute(
    "SELECT id, name, email, role, approvalLevel, extraRoles, extraApprovalLevels, jobTitle, active FROM users WHERE name LIKE '%oscar%' OR name LIKE '%Oscar%'"
  );
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
}

main().catch(console.error);
