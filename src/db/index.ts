import "server-only";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { runMigrations } from "./migrations";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/*
 * One connection promise per server process, cached on globalThis so Next's
 * dev-mode module reloads don't open a second connection.
 *
 *  - DATABASE_URL set    -> real Postgres (Neon, Supabase, RDS, ...)  [production]
 *  - DATABASE_URL absent -> PGlite, a Postgres build that runs in-process and
 *                           stores data under .data/pglite              [local dev]
 */
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  let db: Db;

  if (url) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    // prepare:false keeps this compatible with transaction-pooling proxies.
    const client = postgres(url, { max: 5, prepare: false });
    db = drizzle(client, { schema }) as unknown as Db;
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[db] DATABASE_URL is not set: using the local PGlite file database. " +
          "Data will not survive on serverless hosts. Set DATABASE_URL to a Postgres instance.",
      );
    }
    const [{ PGlite }, { drizzle }] = await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);
    // Use PGLITE_DIR=memory:// for throwaway databases (tests).
    const dir = process.env.PGLITE_DIR?.trim() || ".data/pglite";
    if (!dir.includes("://")) {
      // PGlite's Node filesystem driver doesn't create missing parent
      // directories, so a fresh clone (.data/ is gitignored) fails on the
      // very first write unless we create the path ourselves first.
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
    }
    const client = new PGlite(dir);
    await client.waitReady;
    db = drizzle(client, { schema }) as unknown as Db;
  }

  await runMigrations(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__db) {
    globalForDb.__db = connect().catch((error) => {
      globalForDb.__db = undefined; // allow a retry on the next request
      throw error;
    });
  }
  return globalForDb.__db;
}

export { schema };
