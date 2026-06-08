import { Pool } from "pg";

import { getServerConfig } from "./config.server";

let pool: Pool | undefined;

export function getDb(): Pool {
  if (!pool) {
    const { databaseUrl } = getServerConfig();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set — cannot connect to Postgres.");
    }
    pool = new Pool({ connectionString: databaseUrl, max: 5 });
  }
  return pool;
}
