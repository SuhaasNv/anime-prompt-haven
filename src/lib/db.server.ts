import { Pool, type PoolClient } from "pg";

import { getServerConfig } from "./config.server";

/** A pool or a checked-out client — anything you can call `.query()` on. */
export type DbClient = Pool | PoolClient;

let pool: Pool | undefined;

export function getDb(): Pool {
  if (!pool) {
    const { databaseUrl } = getServerConfig();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set — cannot connect to Postgres.");
    }
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}
