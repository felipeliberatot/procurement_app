import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL!);
  
  try {
    // Simular o INSERT que o Drizzle faria
    await conn.execute(`
      INSERT INTO purchaseRequests 
      (requestNumber, requesterId, requesterName, department, costCenterId, costCenterCode, 
       application, urgencyLevel, observations, osMyfarm, totalEstimatedValue, status, 
       deadlineAt, stepDeadlineAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'SOL-TEST-9999', 1, 'Teste', 'TI', null, null,
      'Teste de inserção', 'normal', null, null, '100.00', 'aguardando_gerente',
      new Date(), new Date()
    ]);
    console.log('INSERT básico: OK');
    
    // Limpar
    await conn.execute("DELETE FROM purchaseRequests WHERE requestNumber = 'SOL-TEST-9999'");
    console.log('Cleanup: OK');
  } catch (err: any) {
    console.error('Erro no INSERT básico:', err.message);
    console.error('SQL:', err.sql);
  }
  
  // Verificar se há algum trigger na tabela
  try {
    const [triggers] = await conn.execute("SHOW TRIGGERS LIKE 'purchaseRequests'") as any[];
    console.log('Triggers:', triggers.length > 0 ? JSON.stringify(triggers) : 'Nenhum');
  } catch (err: any) {
    console.error('Erro ao verificar triggers:', err.message);
  }
  
  await conn.end();
}

main().catch(console.error);
