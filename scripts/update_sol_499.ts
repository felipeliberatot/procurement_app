import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({
    host: "gateway04.us-east-1.prod.aws.tidbcloud.com",
    port: 4000,
    user: "483N2BayUgwNYYf.root",
    password: process.env.DB_PASS!,
    database: "3hNVqVCmDUEc2A2TYJw5pS",
    ssl: { rejectUnauthorized: true },
  });

  const [rows] = await conn.execute(
    "SELECT id, request_number, total_estimated_value, status FROM purchase_requests WHERE request_number = 'SOL-2026-0499'"
  ) as any;

  console.log("Valor atual:", JSON.stringify(rows));

  if (rows.length > 0) {
    await conn.execute(
      "UPDATE purchase_requests SET total_estimated_value = 1660.00 WHERE request_number = 'SOL-2026-0499'"
    );
    const [updated] = await conn.execute(
      "SELECT id, request_number, total_estimated_value FROM purchase_requests WHERE request_number = 'SOL-2026-0499'"
    ) as any;
    console.log("Atualizado para R$ 1.660,00:", JSON.stringify(updated));
  } else {
    console.log("SOL-2026-0499 nao encontrada");
  }

  await conn.end();
}

main().catch(console.error);
