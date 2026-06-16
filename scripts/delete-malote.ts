import '../scripts/load-env.js';
import { getDb } from '../server/db';
import { malotes, maloteItems, maloteTagLinks } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function deleteMalote() {
  const db = await getDb();
  if (!db) { console.error('DB not available'); process.exit(1); }

  const found = await db.select().from(malotes).where(eq(malotes.maloteCode, 'MAL-2026-0026'));
  console.log('Found malote:', JSON.stringify(found, null, 2));
  
  if (found.length > 0) {
    const id = found[0].id;
    
    // Delete related records first
    await db.delete(maloteTagLinks).where(eq(maloteTagLinks.maloteId, id));
    await db.delete(maloteItems).where(eq(maloteItems.maloteId, id));
    // Delete the malote
    await db.delete(malotes).where(eq(malotes.id, id));
    console.log('Deleted malote MAL-2026-0026 (id:', id, ')');
  } else {
    console.log('Malote MAL-2026-0026 not found');
  }
  process.exit(0);
}

deleteMalote().catch(e => { console.error(e); process.exit(1); });
