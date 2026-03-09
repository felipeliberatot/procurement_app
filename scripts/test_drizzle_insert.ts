import { getDb } from '../server/db.js';
import { purchaseRequests } from '../drizzle/schema.js';

async function main() {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  
  try {
    const result = await db.insert(purchaseRequests).values({
      requestNumber: 'SOL-TEST-DRIZZLE',
      requesterId: 1,
      requesterName: 'Teste Drizzle',
      department: 'TI',
      costCenterId: null,
      costCenterCode: null,
      application: 'Teste de inserção via Drizzle',
      urgencyLevel: 'normal',
      observations: null,
      osMyfarm: null,
      totalEstimatedValue: '100.00',
      status: 'aguardando_gerente',
      deadlineAt: new Date(),
      stepDeadlineAt: new Date(),
    });
    console.log('Drizzle INSERT: OK', result);
    
    // Limpar
    const { eq } = await import('drizzle-orm');
    await db.delete(purchaseRequests).where(eq(purchaseRequests.requestNumber, 'SOL-TEST-DRIZZLE'));
    console.log('Cleanup: OK');
  } catch (err: any) {
    console.error('Erro no Drizzle INSERT:');
    console.error('Message:', err.message);
    console.error('SQL:', err.sql);
    console.error('sqlMessage:', err.sqlMessage);
  }
  
  process.exit(0);
}

main().catch(console.error);
