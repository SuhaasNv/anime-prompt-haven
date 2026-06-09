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

  // Create tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Fetch already-applied migrations
  const { rows } = await pool.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  let skipped = 0;
  for (const file of files) {
    if (applied.has(file)) {
      skipped++;
      continue;
    }
    const sql = await readFile(new URL(file, `file://${migrationsDir}`), "utf8");
    console.log(`  → ${file}`);
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
  }

  if (skipped > 0) {
    console.log(`  (${skipped} already-applied migration(s) skipped)`);
  }
  console.log("Migrations applied successfully — schema is up to date.");
} catch (error) {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
