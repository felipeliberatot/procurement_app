import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const sqls = [
  // Users - add new columns
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`procurementRole\` ENUM('solicitante','gerente','controladoria','diretoria','financeiro','admin') NOT NULL DEFAULT 'solicitante'`,
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`department\` VARCHAR(128)`,
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`phone\` VARCHAR(32)`,
  `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`active\` BOOLEAN NOT NULL DEFAULT TRUE`,

  // costCenters
  `CREATE TABLE IF NOT EXISTS costCenters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    responsible VARCHAR(128),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // assets
  `CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(64),
    location VARCHAR(128),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // purchaseRequests
  `CREATE TABLE IF NOT EXISTS purchaseRequests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestNumber VARCHAR(32) NOT NULL UNIQUE,
    requesterId INT NOT NULL,
    requesterName VARCHAR(128) NOT NULL,
    department VARCHAR(128) NOT NULL,
    costCenterId INT,
    costCenterCode VARCHAR(32),
    application VARCHAR(255) NOT NULL,
    urgencyLevel ENUM('normal','urgente','emergencial') NOT NULL DEFAULT 'normal',
    observations TEXT,
    totalEstimatedValue DECIMAL(14,2),
    status ENUM('rascunho','aguardando_gerente','aguardando_orcamento','aguardando_controladoria','aguardando_diretoria','aguardando_ordem_compra','aguardando_financeiro','concluida','rejeitada','cancelada') NOT NULL DEFAULT 'aguardando_gerente',
    budgetFileUrl TEXT,
    purchaseOrderNumber VARCHAR(64),
    paymentInfo TEXT,
    deadlineAt TIMESTAMP NULL,
    stepDeadlineAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // requestItems
  `CREATE TABLE IF NOT EXISTS requestItems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(32) NOT NULL DEFAULT 'un',
    unitPrice DECIMAL(12,2),
    totalPrice DECIMAL(14,2),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // approvalHistory
  `CREATE TABLE IF NOT EXISTS approvalHistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requestId INT NOT NULL,
    userId INT NOT NULL,
    userName VARCHAR(128),
    step ENUM('criacao','gerente','orcamento','controladoria','diretoria','ordem_compra','financeiro') NOT NULL,
    action ENUM('criada','aprovada','rejeitada','orcamento_anexado','ordem_emitida','pagamento_realizado','cancelada','reaberta') NOT NULL,
    comment TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    const name = sql.trim().split(/\s+/).slice(0, 5).join(" ");
    console.log("✓", name.substring(0, 70));
  } catch (e) {
    console.log("⚠ Skip:", e.message.substring(0, 100));
  }
}

await conn.end();
console.log("Migration complete!");
