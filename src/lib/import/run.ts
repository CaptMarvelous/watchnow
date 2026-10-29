import "server-only";

import type { MediaType, Source, Status } from "@/lib/library/constants";
import { dedupeKeyFor } from "@/lib/library/keys";
import { combineDuplicateRows, type ConflictPolicy } from "@/lib/library/merge";
import { importEntries, type EntryInput } from "@/lib/library/queries";
import { findByImdbId, hasTmdbKey, searchByKind } from "@/lib/tmdb";
import type { MediaSummary } from "@/lib/types";
import { matchEntries, type MatchOutcome } from "./match";
import { parseImportFile } from "./parse";
import type { ImportReport } from "./report";
import type { ParsedEntry } from "./types";

export type RunOptions = {
  source: Source | "auto";
  defaultStatus: Status;
  policy: ConflictPolicy;
};

const yearOf = (date: string | undefined): number | null =>
  date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;

/** Combine a parsed row with its TMDB match (if any) into what gets stored. */
export function toEntryInput(entry: ParsedEntry, match: MediaSummary | null): EntryInput {
  const mediaType: MediaType =
    entry.mediaType ?? match?.kind ?? (entry.source === "mdl" ? "tv" : "movie");

  return {
    title: match?.title ?? entry.title,
    year: yearOf(match?.releaseDate) ?? entry.year,
    mediaType,
    status: entry.status,
    score: entry.score,
    progress: entry.progress,
    totalEpisodes: entry.totalEpisodes,
    finishedOn: entry.finishedOn,
    tmdbKind: match?.kind ?? null,
    tmdbId: match?.id ?? null,
    imdbId: entry.imdbId,
    posterPath: match?.posterPath ?? null,
    source: entry.source,
    externalId: entry.externalId,
  };
}

/**
 * Several rows can describe one title (a Letterboxd film that is in both
 * "watched" and "ratings", or several MyAnimeList seasons of one series).
 * Collapse them into one entry per title.
 */
export function collapseDuplicates(inputs: EntryInput[]): EntryInput[] {
  const groups = new Map<string, EntryInput[]>();
  for (const input of inputs) {
    const key = dedupeKeyFor(input);
    const group = groups.get(key);
    if (group) group.push(input);
    else groups.set(key, [input]);
  }
  return [...groups.values()].map((rows) => combineDuplicateRows(rows));
}

export async function runImport(
  userId: string,
  bytes: Uint8Array,
  filename: string,
  options: RunOptions,
): Promise<ImportReport> {
  const parsed = parseImportFile(bytes, filename, options);

  let outcomes: MatchOutcome[];
  let matching: ImportReport["matching"];
  if (hasTmdbKey) {
    const run = await matchEntries(parsed.entries, { searchByKind, findByImdbId });
    outcomes = run.outcomes;
    matching = run.stopped;
  } else {
    outcomes = parsed.entries.map(() => ({ match: null, via: null, status: "unmatched" }));
    matching = "no-key";
  }

  const inputs = parsed.entries.map((entry, i) => toEntryInput(entry, outcomes[i].match));
  const combined = collapseDuplicates(inputs);
  const counts = await importEntries(userId, combined, options.policy);

  const unlinked = combined.filter((e) => e.tmdbId == null);
  return {
    format: parsed.format,
    titles: parsed.entries.length,
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    merged: inputs.length - combined.length,
    linked: combined.length - unlinked.length,
    unlinked: unlinked.length,
    skipped: Object.entries(parsed.skipped).map(([reason, count]) => ({ reason, count })),
    matching,
    unlinkedExamples: unlinked.slice(0, 8).map((e) => e.title),
  };
}
