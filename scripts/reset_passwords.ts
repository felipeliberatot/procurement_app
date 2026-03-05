import { getDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq, isNotNull } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); return; }
  
  // Gerar novo hash para cgs@2026
  const newHash = await bcrypt.hash("cgs@2026", 10);
  console.log("New hash:", newHash);
  
  // Verificar que o hash funciona
  const valid = await bcrypt.compare("cgs@2026", newHash);
  console.log("Hash valid:", valid);
  
  // Atualizar TODOS os usuários com passwordHash para usar cgs@2026
  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash }).from(users);
  
  let updated = 0;
  for (const user of allUsers) {
    if (user.passwordHash) {
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
      console.log(`Updated: ${user.email}`);
      updated++;
    }
  }
  console.log(`Total updated: ${updated}`);
}
main().catch(console.error);
