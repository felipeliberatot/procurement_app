import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);

  // Primeiro, verificar o estado atual
  const [rows] = await conn.execute(
    "SELECT id, name, role, procurementRole, extraRoles, approvalLevel FROM users WHERE name LIKE '%oscar%' OR name LIKE '%Oscar%'"
  ) as any[];

  console.log("Estado atual:", JSON.stringify(rows, null, 2));

  if (rows.length === 0) {
    console.log("Usuário Oscar não encontrado!");
    await conn.end();
    return;
  }

  const oscar = rows[0];
  
  // Adicionar 'admin' nos extraRoles
  let extraRoles: string[] = [];
  try {
    if (oscar.extraRoles) {
      extraRoles = JSON.parse(oscar.extraRoles);
    }
  } catch {}

  if (!extraRoles.includes('admin')) {
    extraRoles.push('admin');
  }

  await conn.execute(
    "UPDATE users SET extraRoles = ? WHERE id = ?",
    [JSON.stringify(extraRoles), oscar.id]
  );

  // Verificar resultado
  const [updated] = await conn.execute(
    "SELECT id, name, role, procurementRole, extraRoles, approvalLevel FROM users WHERE id = ?",
    [oscar.id]
  ) as any[];

  console.log("Estado atualizado:", JSON.stringify(updated, null, 2));
  await conn.end();
}

main().catch(console.error);
