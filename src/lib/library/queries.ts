import "server-only";

import { and, asc, desc, eq, ilike, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MediaKind } from "@/lib/types";
import type { MediaType, Source, Status } from "./constants";
import { adoptableKeys, dedupeKeyFor } from "./keys";
import {
  applyImport,
  clampProgress,
  normalizeScore,
  sameFields,
  type ConflictPolicy,
  type EntryFields,
} from "./merge";

const t = schema.libraryEntries;

export type LibraryEntry = schema.LibraryEntryRow;

/** Everything needed to create or update one library entry. */
export type EntryInput = EntryFields & {
  title: string;
  year: number | null;
  tmdbKind: MediaKind | null;
  tmdbId: number | null;
  imdbId: string | null;
  posterPath: string | null;
  source: Source;
  externalId: string | null;
};

export type LibraryFilters = {
  status?: Status;
  mediaType?: MediaType;
  q?: string;
  sort?: "updated" | "title" | "score" | "year";
};

export const MAX_LIBRARY_ROWS = 3000;

function fieldsOf(row: LibraryEntry): EntryFields {
  return {
    mediaType: row.mediaType as MediaType,
    status: row.status as Status,
    score: row.score,
    progress: row.progress,
    totalEpisodes: row.totalEpisodes,
    finishedOn: row.finishedOn,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Make sure numeric fields are sane before they touch the database. */
function sanitize(input: EntryInput): EntryInput {
  const totalEpisodes =
    input.totalEpisodes != null && input.totalEpisodes > 0
      ? Math.floor(input.totalEpisodes)
      : null;
  return {
    ...input,
    title: input.title.trim().slice(0, 300),
    score: normalizeScore(input.score),
    totalEpisodes,
    progress: clampProgress(input.progress, totalEpisodes),
  };
}

/* ---------- reads ---------- */

export async function listEntries(
  userId: string,
  filters: LibraryFilters = {},
): Promise<LibraryEntry[]> {
  const db = await getDb();
  const conditions = [eq(t.userId, userId)];
  if (filters.status) conditions.push(eq(t.status, filters.status));
  if (filters.mediaType) conditions.push(eq(t.mediaType, filters.mediaType));
  if (filters.q?.trim()) {
    conditions.push(ilike(t.title, `%${escapeLike(filters.q.trim().slice(0, 100))}%`));
  }

  const order = {
    updated: [desc(t.updatedAt)],
    title: [asc(sql`lower(${t.title})`)],
    score: [sql`${t.score} DESC NULLS LAST`, asc(sql`lower(${t.title})`)],
    year: [sql`${t.year} DESC NULLS LAST`, asc(sql`lower(${t.title})`)],
  }[filters.sort ?? "updated"];

  return db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(MAX_LIBRARY_ROWS);
}

/** Compact "kind:id" -> status map the UI uses to badge cards. */
export async function libraryIndex(userId: string): Promise<Record<string, Status>> {
  const db = await getDb();
  const rows = await db
    .select({ kind: t.tmdbKind, id: t.tmdbId, status: t.status })
    .from(t)
    .where(and(eq(t.userId, userId), isNotNull(t.tmdbId)))
    .limit(MAX_LIBRARY_ROWS);

  const index: Record<string, Status> = {};
  for (const row of rows) index[`${row.kind}:${row.id}`] = row.status as Status;
  return index;
}

/**
 * The entry for a TMDB title, including an imported entry that has the same
 * title but hasn't been linked to TMDB yet.
 */
export async function getEntryForMedia(
  userId: string,
  media: { kind: MediaKind; id: number; title: string; year: number | null },
): Promise<LibraryEntry | null> {
  const db = await getDb();
  const exact = `tmdb:${media.kind}:${media.id}`;
  const rows = await db
    .select()
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        inArray(t.dedupeKey, [exact, ...adoptableKeys(media)]),
      ),
    );
  return rows.find((r) => r.dedupeKey === exact) ?? rows[0] ?? null;
}

export type LibraryStats = {
  total: number;
  byStatus: Record<Status, number>;
  meanScore: number | null;
  episodesWatched: number;
  /** Entries without a TMDB link (usually imported titles that didn't match). */
  unlinked: number;
};

export async function libraryStats(userId: string): Promise<LibraryStats> {
  const db = await getDb();
  const grouped = await db
    .select({ status: t.status, n: sql<number>`count(*)`.mapWith(Number) })
    .from(t)
    .where(eq(t.userId, userId))
    .groupBy(t.status);

  const [agg] = await db
    .select({
      mean: sql<number | null>`avg(${t.score}::float8) filter (where ${t.score} > 0)`.mapWith(
        Number,
      ),
      episodes: sql<number>`coalesce(sum(${t.progress}) filter (where ${t.mediaType} <> 'movie'), 0)`.mapWith(
        Number,
      ),
      unlinked: sql<number>`count(*) filter (where ${t.tmdbId} is null)`.mapWith(Number),
    })
    .from(t)
    .where(eq(t.userId, userId));

  const byStatus: Record<Status, number> = {
    watching: 0,
    completed: 0,
    plan: 0,
    on_hold: 0,
    dropped: 0,
  };
  let total = 0;
  for (const row of grouped) {
    byStatus[row.status as Status] = row.n;
    total += row.n;
  }
  return {
    total,
    byStatus,
    meanScore: agg?.mean ?? null,
    episodesWatched: agg?.episodes ?? 0,
    unlinked: agg?.unlinked ?? 0,
  };
}

/* ---------- writes ---------- */

/**
 * Create or update one entry from the track panel. The user is editing it
 * directly, so their values replace what was stored. A title that was imported
 * without a TMDB link is adopted rather than duplicated.
 */
export async function saveTrackedEntry(
  userId: string,
  rawInput: EntryInput,
): Promise<LibraryEntry> {
  const input = sanitize(rawInput);
  const key = dedupeKeyFor(input);
  const candidates = input.tmdbKind
    ? [
        key,
        ...adoptableKeys({
          kind: input.tmdbKind,
          title: input.title,
          year: input.year,
          imdbId: input.imdbId,
        }),
      ]
    : [key];

  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(t)
      .where(and(eq(t.userId, userId), inArray(t.dedupeKey, candidates)));
    const exact = rows.find((r) => r.dedupeKey === key);
    const target = exact ?? rows[0];

    const values = {
      title: input.title,
      year: input.year,
      mediaType: input.mediaType,
      status: input.status,
      score: input.score,
      progress: input.progress,
      totalEpisodes: input.totalEpisodes,
      finishedOn: input.finishedOn,
      tmdbKind: input.tmdbKind,
      tmdbId: input.tmdbId,
      imdbId: input.imdbId,
      posterPath: input.posterPath,
      updatedAt: new Date(),
    };

    if (target) {
      const [row] = await tx
        .update(t)
        .set({ ...values, dedupeKey: exact ? target.dedupeKey : key })
        .where(and(eq(t.id, target.id), eq(t.userId, userId)))
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(t)
      .values({
        ...values,
        userId,
        dedupeKey: key,
        source: input.source,
        externalId: input.externalId,
      })
      .returning();
    return row;
  });
}

/**
 * Point an entry that has no TMDB link (e.g. an import that didn't match) at a
 * TMDB title. When the user already tracks that title, the two entries are
 * merged and the one being linked is removed.
 */
export async function linkEntryToMedia(
  userId: string,
  entryId: string,
  media: {
    kind: MediaKind;
    id: number;
    title: string;
    year: number | null;
    posterPath: string | null;
    totalEpisodes: number | null;
  },
): Promise<"linked" | "merged" | "missing"> {
  const db = await getDb();
  const key = `tmdb:${media.kind}:${media.id}`;

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(t)
      .where(and(eq(t.id, entryId), eq(t.userId, userId)))
      .limit(1);
    if (!entry) return "missing";

    const [other] = await tx
      .select()
      .from(t)
      .where(and(eq(t.userId, userId), eq(t.dedupeKey, key)))
      .limit(1);

    if (other && other.id !== entry.id) {
      const merged = applyImport(fieldsOf(other), fieldsOf(entry), "keep");
      await tx
        .update(t)
        .set({ ...merged, updatedAt: new Date() })
        .where(and(eq(t.id, other.id), eq(t.userId, userId)));
      await tx.delete(t).where(and(eq(t.id, entry.id), eq(t.userId, userId)));
      return "merged";
    }

    await tx
      .update(t)
      .set({
        dedupeKey: key,
        tmdbKind: media.kind,
        tmdbId: media.id,
        title: media.title,
        year: media.year ?? entry.year,
        posterPath: media.posterPath,
        totalEpisodes: entry.totalEpisodes ?? media.totalEpisodes,
        // "anime" is a category the user chose or imported; keep it.
        mediaType: entry.mediaType === "anime" ? "anime" : media.kind,
        updatedAt: new Date(),
      })
      .where(and(eq(t.id, entry.id), eq(t.userId, userId)));
    return "linked";
  });
}

export type ImportCounts = { created: number; updated: number; unchanged: number };

/** Apply a batch of imported entries on top of the user's library. */
export async function importEntries(
  userId: string,
  entries: EntryInput[],
  policy: ConflictPolicy,
): Promise<ImportCounts> {
  const counts: ImportCounts = { created: 0, updated: 0, unchanged: 0 };
  if (entries.length === 0) return counts;

  const prepared = entries.map((raw) => {
    const input = sanitize(raw);
    const key = dedupeKeyFor(input);
    const adopt = input.tmdbKind
      ? adoptableKeys({
          kind: input.tmdbKind,
          title: input.title,
          year: input.year,
          imdbId: input.imdbId,
        })
      : [];
    return { input, key, adopt };
  });

  const allKeys = [...new Set(prepared.flatMap((p) => [p.key, ...p.adopt]))];
  const db = await getDb();

  await db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(t)
      .where(and(eq(t.userId, userId), inArray(t.dedupeKey, allKeys)));
    const byKey = new Map(existingRows.map((r) => [r.dedupeKey, r]));

    for (const { input, key, adopt } of prepared) {
      let existing = byKey.get(key);
      let adopted = false;
      if (!existing) {
        const hit = adopt.map((k) => byKey.get(k)).find(Boolean);
        if (hit) {
          existing = hit;
          adopted = true;
        }
      }

      if (!existing) {
        const [row] = await tx
          .insert(t)
          .values({
            userId,
            dedupeKey: key,
            source: input.source,
            externalId: input.externalId,
            title: input.title,
            year: input.year,
            mediaType: input.mediaType,
            status: input.status,
            score: input.score,
            progress: input.progress,
            totalEpisodes: input.totalEpisodes,
            finishedOn: input.finishedOn,
            tmdbKind: input.tmdbKind,
            tmdbId: input.tmdbId,
            imdbId: input.imdbId,
            posterPath: input.posterPath,
          })
          .returning();
        byKey.set(key, row);
        counts.created++;
        continue;
      }

      const merged = applyImport(fieldsOf(existing), input, policy);
      const needsLink = adopted && input.tmdbId != null;
      if (sameFields(fieldsOf(existing), merged) && !needsLink) {
        counts.unchanged++;
        continue;
      }

      const next = {
        ...merged,
        // Adopting an un-linked entry gives it the TMDB identity and artwork.
        ...(needsLink
          ? {
              dedupeKey: byKey.has(key) ? existing.dedupeKey : key,
              tmdbKind: input.tmdbKind,
              tmdbId: input.tmdbId,
              imdbId: input.imdbId ?? existing.imdbId,
              posterPath: input.posterPath ?? existing.posterPath,
              title: input.title,
              year: input.year ?? existing.year,
            }
          : {}),
        updatedAt: new Date(),
      };
      const [row] = await tx
        .update(t)
        .set(next)
        .where(and(eq(t.id, existing.id), eq(t.userId, userId)))
        .returning();
      byKey.delete(existing.dedupeKey);
      byKey.set(row.dedupeKey, row);
      counts.updated++;
    }
  });

  return counts;
}

export async function removeEntry(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(t)
    .where(and(eq(t.id, id), eq(t.userId, userId)))
    .returning({ id: t.id });
  return rows.length > 0;
}

export async function removeEntryForMedia(
  userId: string,
  media: { kind: MediaKind; id: number; title: string; year: number | null },
): Promise<boolean> {
  const entry = await getEntryForMedia(userId, media);
  return entry ? removeEntry(userId, entry.id) : false;
}

/** Everything the user owns, for the "download my data" export. */
export async function exportLibrary(userId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t)
    .where(eq(t.userId, userId))
    .orderBy(asc(sql`lower(${t.title})`));
  return rows.map((r) => ({
    title: r.title,
    year: r.year,
    type: r.mediaType,
    status: r.status,
    score: r.score,
    episodes_watched: r.progress,
    total_episodes: r.totalEpisodes,
    finished_on: r.finishedOn,
    tmdb_kind: r.tmdbKind,
    tmdb_id: r.tmdbId,
    imdb_id: r.imdbId,
    source: r.source,
    added_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  }));
}
