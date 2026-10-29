import {
  date,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * Keep this file in sync with the SQL in ./migrations.ts. The migrations are
 * the source of truth for the real database; this describes the same tables to
 * Drizzle so queries are fully typed.
 */

export const schemaMigrations = pgTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export const libraryEntries = pgTable(
  "library_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Identity of the title for de-duplication across imports and manual adds. */
    dedupeKey: text("dedupe_key").notNull(),
    /** Where the entry came from: manual, mal, mdl, letterboxd, imdb or csv. */
    source: text("source").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    year: integer("year"),
    /** movie | tv | anime. Anime is a category; it is a TMDB movie or series underneath. */
    mediaType: text("media_type").notNull(),
    status: text("status").notNull(),
    /** 0–10 scale; null means unrated. */
    score: real("score"),
    progress: integer("progress"),
    totalEpisodes: integer("total_episodes"),
    finishedOn: date("finished_on", { mode: "string" }),
    /** TMDB link; both columns are set together or not at all. */
    tmdbKind: text("tmdb_kind"),
    tmdbId: integer("tmdb_id"),
    imdbId: text("imdb_id"),
    posterPath: text("poster_path"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("library_user_dedupe_idx").on(t.userId, t.dedupeKey),
    index("library_user_status_idx").on(t.userId, t.status),
  ],
);

export type User = typeof users.$inferSelect;
export type LibraryEntryRow = typeof libraryEntries.$inferSelect;
export type NewLibraryEntry = typeof libraryEntries.$inferInsert;
