/**
 * Script de auditoria e correção:
 * 1. Reverte SOL-2026-0555 (id=12000001) para aguardando_verificacao_compras
 * 2. Audita outras solicitações "concluida" com itens "pendente" (conclusão incorreta)
 */
import { createPool } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const pool = createPool({ uri: process.env.DATABASE_URL!, waitForConnections: true, connectionLimit: 5 });
  const conn = await pool.getConnection();

  try {
    // 1. Verificar SOL-2026-0555
    const [sol555] = await conn.query(
      `SELECT id, request_number, status FROM purchaseRequests WHERE request_number = 'SOL-2026-0555' LIMIT 1`
    ) as any[];
    console.log("SOL-2026-0555:", sol555[0]);

    const sol555Id = sol555[0]?.id;
    if (sol555Id) {
      const [items555] = await conn.query(
        `SELECT id, item_name, item_status FROM requestItems WHERE request_id = ?`, [sol555Id]
      ) as any[];
      console.log("Itens da SOL-2026-0555:", items555);

      // Reverter para aguardando_verificacao_compras
      await conn.query(
        `UPDATE purchaseRequests SET status = 'aguardando_verificacao_compras', completed_at = NULL WHERE id = ?`, [sol555Id]
      );
      // Reverter itens: "comprado" → "aprovado", "pendente" → "aprovado"
      await conn.query(
        `UPDATE requestItems SET item_status = 'aprovado' WHERE request_id = ?`, [sol555Id]
      );
      console.log("✅ SOL-2026-0555 revertida para aguardando_verificacao_compras. Itens resetados para 'aprovado'.");
    }

    // 2. Auditoria: solicitações "concluida" com itens "pendente" (conclusão incorreta)
    const [concluidas] = await conn.query(
      `SELECT pr.id, pr.request_number, pr.status,
        COUNT(ri.id) as total_items,
        SUM(CASE WHEN ri.item_status = 'comprado' THEN 1 ELSE 0 END) as comprados,
        SUM(CASE WHEN ri.item_status = 'pendente' THEN 1 ELSE 0 END) as pendentes
       FROM purchaseRequests pr
       JOIN requestItems ri ON ri.request_id = pr.id
       WHERE pr.status = 'concluida'
       GROUP BY pr.id, pr.request_number, pr.status
       HAVING pendentes > 0`
    ) as any[];

    console.log("\n=== AUDITORIA: Solicitações 'concluida' com itens 'pendente' ===");
    if ((concluidas as any[]).length === 0) {
      console.log("✅ Nenhuma solicitação com problema encontrada.");
    } else {
      for (const r of concluidas as any[]) {
        console.log(`⚠️  ${r.request_number} (id=${r.id}): ${r.comprados} comprados, ${r.pendentes} pendentes de ${r.total_items} total`);
      }
      console.log(`\nTotal com problema: ${(concluidas as any[]).length} solicitações`);
    }

    // 3. Auditoria: solicitações "concluida" com NENHUM item "comprado" (todos pendentes — conclusão errada)
    const [semComprado] = await conn.query(
      `SELECT pr.id, pr.request_number, pr.status,
        COUNT(ri.id) as total_items,
        SUM(CASE WHEN ri.item_status = 'comprado' THEN 1 ELSE 0 END) as comprados
       FROM purchaseRequests pr
       JOIN requestItems ri ON ri.request_id = pr.id
       WHERE pr.status IN ('concluida', 'parcialmente_concluida')
       GROUP BY pr.id, pr.request_number, pr.status
       HAVING comprados = 0`
    ) as any[];

    console.log("\n=== AUDITORIA: Solicitações concluídas SEM nenhum item 'comprado' ===");
    if ((semComprado as any[]).length === 0) {
      console.log("✅ Nenhuma encontrada.");
    } else {
      for (const r of semComprado as any[]) {
        console.log(`⚠️  ${r.request_number} (id=${r.id}): status=${r.status}, 0 comprados de ${r.total_items} total`);
      }
    }

  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(console.error);
