import { sql } from "drizzle-orm";
import type { Db } from "./index";
import { schemaMigrations } from "./schema";

type Migration = { id: string; statements: string[] };

/**
 * Append-only list of migrations. Never edit one that has shipped; add a new
 * entry instead. Statements are kept as separate strings so the same code runs
 * on every driver (no multi-statement queries).
 */
const MIGRATIONS: Migration[] = [
  {
    id: "0001_init",
    statements: [
      `CREATE TABLE users (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         email text NOT NULL UNIQUE,
         password_hash text NOT NULL,
         display_name text NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE sessions (
         id text PRIMARY KEY,
         user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         expires_at timestamptz NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX sessions_user_idx ON sessions (user_id)`,
      `CREATE TABLE rate_limits (
         key text PRIMARY KEY,
         count integer NOT NULL,
         window_start timestamptz NOT NULL
       )`,
      `CREATE TABLE library_entries (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         dedupe_key text NOT NULL,
         source text NOT NULL,
         external_id text,
         title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
         year integer CHECK (year IS NULL OR year BETWEEN 1870 AND 2200),
         media_type text NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
         status text NOT NULL CHECK (status IN ('completed', 'watching', 'plan', 'on_hold', 'dropped')),
         score real CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
         progress integer CHECK (progress IS NULL OR progress >= 0),
         total_episodes integer CHECK (total_episodes IS NULL OR total_episodes >= 0),
         finished_on date,
         tmdb_kind text CHECK (tmdb_kind IS NULL OR tmdb_kind IN ('movie', 'tv')),
         tmdb_id integer,
         imdb_id text,
         poster_path text,
         notes text,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now(),
         CHECK ((tmdb_id IS NULL) = (tmdb_kind IS NULL))
       )`,
      `CREATE UNIQUE INDEX library_user_dedupe_idx ON library_entries (user_id, dedupe_key)`,
      `CREATE INDEX library_user_status_idx ON library_entries (user_id, status)`,
    ],
  },
];

/** Arbitrary constant: serialises concurrent migrators on a shared Postgres. */
const MIGRATION_LOCK_ID = 727_274;

export async function runMigrations(db: Db): Promise<void> {
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (
          id text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`,
  );

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`);

    const done = new Set(
      (await tx.select({ id: schemaMigrations.id }).from(schemaMigrations)).map(
        (row) => row.id,
      ),
    );

    for (const migration of MIGRATIONS) {
      if (done.has(migration.id)) continue;
      for (const statement of migration.statements) {
        await tx.execute(sql.raw(statement));
      }
      await tx.insert(schemaMigrations).values({ id: migration.id });
    }
  });
}

// Exposed so tests can assert on the applied set.
export const MIGRATION_IDS = MIGRATIONS.map((m) => m.id);
