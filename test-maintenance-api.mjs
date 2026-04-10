// Test: validate CGS_MAINTENANCE_API_KEY against CGS Manutenções API
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
try {
  const envFile = readFileSync(resolve('.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}

const apiKey = process.env.CGS_MAINTENANCE_API_KEY;
if (!apiKey) {
  console.error('❌ CGS_MAINTENANCE_API_KEY not set');
  process.exit(1);
}

const res = await fetch('https://cgsmaintain-yb3cdfwd.manus.space/api/integration/health', {
  headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' }
});

const body = await res.json();
if (res.ok && body.status === 'ok') {
  console.log('✅ CGS_MAINTENANCE_API_KEY válida. Autenticado como:', body.authenticatedAs);
  process.exit(0);
} else {
  console.error('❌ Falha na validação:', body);
  process.exit(1);
}
