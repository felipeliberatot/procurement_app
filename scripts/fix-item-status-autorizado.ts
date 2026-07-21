/**
 * Script para corrigir status de itens históricos:
 * - Itens com status 'comprado' em solicitações que ainda estão em etapas
 *   ANTES da verificação final devem ser 'autorizado'
 * - Itens com status 'comprado' em solicitações que estão em
 *   aguardando_comprovante_pagamento ou aguardando_aprovacao_compra devem ser 'aprovado'
 *   (pois o financeiro já aprovou ou está prestes a aprovar)
 *
 * Regra:
 *   aguardando_ordem_compra → itens devem ser 'autorizado'
 *   aguardando_aprovacao_ceo → itens devem ser 'autorizado'
 *   aguardando_aprovacao_compra → itens devem ser 'aprovado' (financeiro aprovou)
 *   aguardando_comprovante_pagamento → itens devem ser 'aprovado'
 *   aguardando_verificacao_compras → itens podem ser 'aprovado' (serão marcados como 'comprado' ao finalizar)
 *   concluida / parcialmente_concluida → itens devem ser 'comprado' (já finalizados)
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import * as schema from "../drizzle/schema";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: "default" });

  console.log("=== Corrigindo status de itens históricos ===\n");

  // 1. Buscar todas as solicitações com itens 'comprado' que não estão concluídas
  const requestsWithComprado = await db
    .select({
      requestId: schema.purchaseRequests.id,
      requestStatus: schema.purchaseRequests.status,
    })
    .from(schema.purchaseRequests)
    .innerJoin(
      schema.requestItems,
      eq(schema.requestItems.requestId, schema.purchaseRequests.id)
    )
    .where(
      and(
        eq(schema.requestItems.itemStatus, "comprado"),
        notInArray(schema.purchaseRequests.status, ["concluida", "parcialmente_concluida"])
      )
    );

  // Deduplicar por requestId
  const uniqueRequests = Array.from(
    new Map(requestsWithComprado.map(r => [r.requestId, r])).values()
  );

  console.log(`Encontradas ${uniqueRequests.length} solicitações com itens 'comprado' fora das etapas finais:\n`);

  // Etapas onde itens devem ser 'autorizado' (OC emitida mas financeiro ainda não aprovou)
  const etapasAutorizado = [
    "aguardando_ordem_compra",
    "aguardando_aprovacao_ceo",
  ];

  // Etapas onde itens devem ser 'aprovado' (financeiro aprovou, aguardando pagamento/verificação)
  const etapasAprovado = [
    "aguardando_aprovacao_compra",
    "aguardando_comprovante_pagamento",
    "aguardando_verificacao_compras",
  ];

  let countAutorizado = 0;
  let countAprovado = 0;

  for (const req of uniqueRequests) {
    const status = req.requestStatus as string;
    console.log(`  SOL ID ${req.requestId} — status: ${status}`);

    if (etapasAutorizado.includes(status)) {
      // Converter 'comprado' → 'autorizado'
      const result = await db
        .update(schema.requestItems)
        .set({ itemStatus: "autorizado" })
        .where(
          and(
            eq(schema.requestItems.requestId, req.requestId),
            eq(schema.requestItems.itemStatus, "comprado")
          )
        );
      console.log(`    → Convertido para 'autorizado'`);
      countAutorizado++;
    } else if (etapasAprovado.includes(status)) {
      // Converter 'comprado' → 'aprovado'
      const result = await db
        .update(schema.requestItems)
        .set({ itemStatus: "aprovado" })
        .where(
          and(
            eq(schema.requestItems.requestId, req.requestId),
            eq(schema.requestItems.itemStatus, "comprado")
          )
        );
      console.log(`    → Convertido para 'aprovado'`);
      countAprovado++;
    } else {
      console.log(`    → Status não mapeado, ignorado`);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`Solicitações convertidas para 'autorizado': ${countAutorizado}`);
  console.log(`Solicitações convertidas para 'aprovado': ${countAprovado}`);

  await connection.end();
}

main().catch(console.error);
