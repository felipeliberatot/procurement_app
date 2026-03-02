import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Read .env manually
const envContent = readFileSync('/home/ubuntu/procurement_app/.env', 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}

const DATABASE_URL = envVars.DATABASE_URL;
console.log('Connecting to:', DATABASE_URL ? 'DB configured' : 'NO DB URL');

const conn = await createConnection(DATABASE_URL);

// Check request 180002
const [rows] = await conn.execute('SELECT id, status, urgencyLevel, budgetFileUrl FROM purchaseRequests WHERE id = 180002');
const request = rows[0];
console.log('Request 180002:', request);

if (request.status !== 'aguardando_orcamento') {
  console.log('ERRO: Solicitação não está aguardando orçamento');
} else if (!request.budgetFileUrl) {
  console.log('ERRO: Sem PDF de orçamento');
} else {
  console.log('OK: Solicitação pronta para submitBudget');
  console.log('Urgência:', request.urgencyLevel);
  
  // Simulate what submitBudget would do
  const STEP_FLOW_URGENT = {
    aguardando_orcamento: { step: 'orcamento', nextStatus: 'aguardando_controladoria', action: 'aprovada' },
  };
  const STEP_FLOW_NORMAL = {
    aguardando_orcamento: { step: 'orcamento', nextStatus: 'aguardando_controladoria', action: 'aprovada' },
  };
  
  const isUrgent = request.urgencyLevel === 'urgente' || request.urgencyLevel === 'emergencial';
  const flow = isUrgent ? STEP_FLOW_URGENT['aguardando_orcamento'] : STEP_FLOW_NORMAL['aguardando_orcamento'];
  console.log('Próximo status seria:', flow.nextStatus);
}

await conn.end();
