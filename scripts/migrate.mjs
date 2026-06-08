import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_PUBLIC_URL or DATABASE_URL (e.g. in your .env file) before running this.");
  process.exit(1);
}

const migrationsDir = fileURLToPath(new URL("../db/migrations/", import.meta.url));
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

const pool = new Pool({ connectionString, connectionTimeoutMillis: 15000 });

try {
  console.log(`Running migrations against ${new URL(connectionString).host} ...`);
  for (const file of files) {
    const sql = await readFile(new URL(file, `file://${migrationsDir}`), "utf8");
    console.log(`  → ${file}`);
    await pool.query(sql);
  }
  console.log("Migrations applied successfully — schema is up to date.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
