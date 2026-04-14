import * as mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL || "";

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  
  // Buscar o usuário
  const [rows] = await conn.execute(
    "SELECT id, name, email, procurementRole, extraRoles FROM users WHERE email = ?",
    ["wellington.pires@cgs.agr.br"]
  ) as any;

  if (!rows.length) {
    console.log("Usuário não encontrado!");
    await conn.end();
    return;
  }

  const user = rows[0];
  console.log("Usuário encontrado:", user);

  // Parsear extraRoles atual
  let extraRoles: string[] = [];
  if (user.extraRoles) {
    try {
      extraRoles = JSON.parse(user.extraRoles);
    } catch {
      extraRoles = [];
    }
  }

  // Adicionar 'assets_admin' se ainda não tiver
  if (!extraRoles.includes("assets_admin")) {
    extraRoles.push("assets_admin");
  }

  const newExtraRoles = JSON.stringify(extraRoles);
  await conn.execute(
    "UPDATE users SET extraRoles = ? WHERE id = ?",
    [newExtraRoles, user.id]
  );

  console.log(`✅ extraRoles atualizado para: ${newExtraRoles}`);
  await conn.end();
}

main().catch(console.error);
