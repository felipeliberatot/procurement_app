import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";

const outputPath = resolve(process.cwd(), process.argv[2] ?? "database/backup.sql");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL é obrigatório para gerar o backup.");
}

const connection = new URL(databaseUrl);
if (connection.protocol !== "mysql:") {
  throw new Error("DATABASE_URL deve usar o protocolo mysql://.");
}

const databaseName = decodeURIComponent(connection.pathname.replace(/^\//, ""));
if (!databaseName) {
  throw new Error("DATABASE_URL deve informar o nome do banco.");
}

const workDir = await mkdtemp(resolve(tmpdir(), "compras-cgs-backup-"));
const defaultsFile = resolve(workDir, "mysqldump.cnf");
const temporaryOutput = `${outputPath}.tmp`;

const defaults = [
  "[client]",
  `host=${connection.hostname}`,
  `port=${connection.port || "3306"}`,
  `user=${decodeURIComponent(connection.username)}`,
  `password=${decodeURIComponent(connection.password)}`,
  "",
].join("\n");

try {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(defaultsFile, defaults, { mode: 0o600 });

  const dump = spawn(
    "mysqldump",
    [
      `--defaults-extra-file=${defaultsFile}`,
      "--quick",
      // TiDB gerenciado não suporta os SAVEPOINTs emitidos pelo modo
      // --single-transaction do mysqldump. O dump é curto e feito sem locks.
      "--skip-lock-tables",
      "--skip-add-locks",
      "--skip-tz-utc",
      "--no-tablespaces",
      "--routines",
      "--events",
      "--triggers",
      "--add-drop-database",
      "--databases",
      "--set-charset",
      "--skip-comments",
      databaseName,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const outputStream = createWriteStream(temporaryOutput, { mode: 0o600 });
  const errorChunks = [];
  dump.stderr.on("data", (chunk) => errorChunks.push(chunk));
  dump.stdout.pipe(outputStream);

  const [exitCode] = await Promise.all([
    new Promise((resolveExit, rejectExit) => {
    dump.once("error", rejectExit);
      outputStream.once("error", rejectExit);
    dump.once("close", resolveExit);
    }),
    finished(outputStream),
  ]);

  const output = Buffer.concat(errorChunks).toString("utf8");

  if (exitCode !== 0) {
    throw new Error(`mysqldump falhou (código ${exitCode}): ${output.trim()}`);
  }

  const info = await stat(temporaryOutput);
  if (info.size === 0) {
    throw new Error("Backup gerado vazio; a operação foi interrompida.");
  }

  await rename(temporaryOutput, outputPath);
  await chmod(outputPath, 0o600);
  console.log(`Backup completo gerado em ${outputPath} (${info.size} bytes).`);
} finally {
  await rm(workDir, { recursive: true, force: true });
  await rm(temporaryOutput, { force: true });
}
