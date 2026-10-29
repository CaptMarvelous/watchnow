import type { MediaType, Status } from "./constants";

/** The user-editable part of a library entry. */
export type EntryFields = {
  mediaType: MediaType;
  status: Status;
  score: number | null;
  progress: number | null;
  totalEpisodes: number | null;
  finishedOn: string | null;
};

/**
 *  keep      Existing library data wins. Missing fields are filled in from the
 *            import, and a "plan to watch" entry is upgraded by any other status.
 *  overwrite The imported values win wherever the import provides one.
 */
export type ConflictPolicy = "keep" | "overwrite";

/** 0 / missing means "unrated". Otherwise clamp to 1–10 with one decimal. */
export function normalizeScore(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(Math.min(value, 10) * 10) / 10;
}

export function clampProgress(
  progress: number | null,
  total: number | null,
): number | null {
  if (progress == null) return null;
  const p = Math.max(0, Math.floor(progress));
  return total != null && total > 0 ? Math.min(p, total) : p;
}

/**
 * Status for several rows describing the same title in one import.
 *
 * Series: a mix of finished and unfinished entries (typically several MyAnimeList
 * seasons that map to one TMDB show) means the person is part-way through.
 * Movies: watching something at all beats "plan to watch" (a Letterboxd title
 * that is both on the watchlist and in the watched list is simply watched).
 */
export function mergeStatuses(statuses: Status[], series: boolean): Status {
  const set = new Set(statuses);
  if (set.size === 1) return statuses[0];

  if (!series) {
    for (const s of ["completed", "watching", "on_hold", "dropped", "plan"] as const) {
      if (set.has(s)) return s;
    }
  }
  if (set.has("watching")) return "watching";
  if (set.has("on_hold")) return "on_hold";
  if (set.has("dropped")) return "dropped";
  return "watching"; // completed + plan to watch
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/** Collapse rows for one title (e.g. MAL seasons, Letterboxd watched + ratings). */
export function combineDuplicateRows<T extends EntryFields>(rows: T[]): T {
  if (rows.length === 1) return rows[0];

  const series = rows.some((r) => r.mediaType !== "movie");
  const scores = rows
    .map((r) => r.score)
    .filter((s): s is number => s != null && s > 0);
  const dates = rows.map((r) => r.finishedOn).filter((d): d is string => !!d);
  const totalEpisodes = sum(rows.map((r) => r.totalEpisodes));

  return {
    ...rows[0],
    mediaType: rows.some((r) => r.mediaType === "anime")
      ? "anime"
      : rows[0].mediaType,
    status: mergeStatuses(
      rows.map((r) => r.status),
      series,
    ),
    score: scores.length
      ? normalizeScore(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 2) / 2)
      : null,
    totalEpisodes,
    progress: clampProgress(sum(rows.map((r) => r.progress)), totalEpisodes),
    finishedOn: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/** Result of applying an imported entry on top of one already in the library. */
export function applyImport(
  existing: EntryFields,
  incoming: EntryFields,
  policy: ConflictPolicy,
): EntryFields {
  if (policy === "overwrite") {
    return {
      mediaType: incoming.mediaType,
      status: incoming.status,
      score: incoming.score ?? existing.score,
      progress: incoming.progress ?? existing.progress,
      totalEpisodes: incoming.totalEpisodes ?? existing.totalEpisodes,
      finishedOn: incoming.finishedOn ?? existing.finishedOn,
    };
  }

  const upgrade = existing.status === "plan" && incoming.status !== "plan";
  return {
    mediaType: existing.mediaType,
    status: upgrade ? incoming.status : existing.status,
    score: existing.score ?? incoming.score,
    progress: upgrade
      ? (incoming.progress ?? existing.progress)
      : (existing.progress ?? incoming.progress),
    totalEpisodes: existing.totalEpisodes ?? incoming.totalEpisodes,
    finishedOn: existing.finishedOn ?? incoming.finishedOn,
  };
}

export function sameFields(a: EntryFields, b: EntryFields): boolean {
  return (
    a.mediaType === b.mediaType &&
    a.status === b.status &&
    a.score === b.score &&
    a.progress === b.progress &&
    a.totalEpisodes === b.totalEpisodes &&
    a.finishedOn === b.finishedOn
  );
}
