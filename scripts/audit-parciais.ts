import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Buscar todas as parcialmente_concluida
  const [parciais] = await conn.execute<any[]>(
    "SELECT id, requestNumber FROM purchaseRequests WHERE status = 'parcialmente_concluida'"
  );
  console.log(`Total parcialmente_concluida: ${parciais.length}`);

  const toFix: any[] = [];

  for (const req of parciais) {
    const [items] = await conn.execute<any[]>(
      "SELECT id, itemStatus FROM requestItems WHERE requestId = ?",
      [req.id]
    );
    if (items.length === 0) continue;
    const allComprado = items.every((i: any) => i.itemStatus === "comprado");
    if (allComprado) {
      toFix.push({ ...req, itemCount: items.length });
    }
  }

  console.log(`\nSolicitações parciais com todos os itens comprados (devem ser concluida): ${toFix.length}`);
  for (const r of toFix) {
    console.log(`  → ${r.requestNumber} (${r.itemCount} itens)`);
    await conn.execute(
      "UPDATE purchaseRequests SET status = 'concluida' WHERE id = ?",
      [r.id]
    );
    console.log(`    ✅ Corrigido`);
  }

  if (toFix.length === 0) console.log("  Nenhuma correção necessária.");
  await conn.end();
}

main().catch(console.error);
