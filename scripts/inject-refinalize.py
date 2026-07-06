#!/usr/bin/env python3
"""Insere a função refinalizeOC no db.ts antes da seção Cancel Request."""

REFINALIZE_CODE = '''
// ─── Refinalize OC (Recompra de itens pendentes) ─────────────────────────────
/**
 * Refinaliza uma solicitação parcialmente concluída após recompra dos itens pendentes.
 * Verifica os itens: se todos foram comprados → concluida; se ainda há pendentes → parcialmente_concluida.
 */
export async function refinalizeOC(requestId: number, user: User): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [request] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Solicitação não encontrada");
  if (request.status !== "parcialmente_concluida") throw new Error("Apenas solicitações parcialmente concluídas podem ser refinalizadas");
  // Determinar status final com base nos itens atualizados
  const allItems = await db.select().from(requestItems).where(eq(requestItems.requestId, requestId));
  const hasComprado = allItems.some(i => i.itemStatus === "comprado");
  const hasPendingItems = allItems.some(i => i.itemStatus === "pendente" || i.itemStatus === "parcial");
  const finalStatus = (hasComprado && hasPendingItems) ? "parcialmente_concluida" : "concluida";
  await db.update(purchaseRequests).set({
    status: finalStatus as any,
    stepDeadlineAt: null,
  }).where(eq(purchaseRequests.id, requestId));
  await db.insert(approvalHistory).values({
    requestId,
    userId: user.id,
    userName: user.name ?? "Usuário",
    step: "verificacao_compras" as any,
    action: "oc_finalizada" as any,
    comment: finalStatus === "concluida"
      ? "Recompra concluída. Todos os itens foram adquiridos."
      : "Recompra parcial registrada. Itens pendentes mantidos.",
  });
  // Notificar solicitante
  try {
    const [req] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, requestId)).limit(1);
    if (req) {
      const [requester] = await db.select().from(users).where(eq(users.id, req.requesterId)).limit(1);
      if (requester?.phone) {
        await WA.notifyApproval({
          requesterPhone: requester.phone,
          requesterName: requester.name ?? "Solicitante",
          requestNumber: req.requestNumber,
          requestId,
          approverName: user.name ?? "Compras",
          stepLabel: finalStatus === "concluida" ? "Recompra Concluída" : "Recompra Parcial",
        });
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Failed to send refinalization notification:", e);
  }
}

'''

with open('server/db.ts', 'r', encoding='utf-8') as f:
    content = f.read()

marker = '// ─── Cancel Request'
idx = content.find(marker)
if idx == -1:
    print("ERROR: marker not found")
    exit(1)

# Check if already inserted
if 'refinalizeOC' in content:
    print("refinalizeOC already exists in db.ts — skipping insertion")
    exit(0)

new_content = content[:idx] + REFINALIZE_CODE + content[idx:]
with open('server/db.ts', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: refinalizeOC inserted before Cancel Request section")
