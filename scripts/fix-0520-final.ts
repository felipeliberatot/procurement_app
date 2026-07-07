import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Buscar a solicitação
  // TiDB: tabelas criadas pelo Drizzle usam snake_case sem prefixo
  // Verificar o nome real das tabelas
  const [tables] = await conn.execute<any[]>("SHOW TABLES LIKE '%request%'");
  console.log("Tabelas:", tables.map((t: any) => Object.values(t)[0]));

  const [rows] = await conn.execute<any[]>(
    "SELECT id, requestNumber, status FROM purchaseRequests WHERE requestNumber = 'SOL-2026-0520' LIMIT 1"
  );
  if (!rows.length) { console.log("N\u00e3o encontrada"); await conn.end(); return; }
  const req = rows[0];
  console.log("Solicita\u00e7\u00e3o:", req);

  // Buscar itens
  const [items] = await conn.execute<any[]>(
    "SELECT id, description, quantity, fulfilledQty, itemStatus FROM requestItems WHERE requestId = ?",
    [req.id]
  );
  console.log("Itens:", items);

  const allComprado = items.every(i => i.itemStatus === "comprado");
  const anyComprado = items.some(i => i.itemStatus === "comprado");
  const anyPendente = items.some(i => i.itemStatus === "pendente" || i.itemStatus === "parcial");

  console.log("allComprado:", allComprado, "anyComprado:", anyComprado, "anyPendente:", anyPendente);

  if (req.status === "parcialmente_concluida" && allComprado) {
    console.log("→ Corrigindo para concluida...");
    await conn.execute(
      "UPDATE purchaseRequests SET status = 'concluida' WHERE id = ?",
      [req.id]
    );
    await conn.execute(
      `INSERT INTO approvalHistory (requestId, userId, userName, step, action, comment, createdAt)
       VALUES (?, 1, 'Sistema', 'verificacao_compras', 'oc_finalizada', 'Corre\u00e7\u00e3o autom\u00e1tica: todos os itens comprados \u2014 status atualizado para concluida.', NOW())`,
      [req.id]
    );
    console.log("✅ Corrigido para concluida");
  } else {
    console.log("Nenhuma correção necessária.");
  }

  await conn.end();
}

main().catch(console.error);
