import type { MediaType, Source, Status } from "@/lib/library/constants";

/** A problem with the uploaded file that is safe to show to the person who uploaded it. */
export class ImportError extends Error {
  override name = "ImportError";
}

/** Which TMDB kind to search first. null = the file doesn't say. */
export type KindHint = "movie" | "tv" | null;

/** One row of an uploaded list, normalised but not yet matched to TMDB. */
export type ParsedEntry = {
  title: string;
  year: number | null;
  /** null = the file doesn't say; decided from the TMDB match (or the source) later. */
  mediaType: MediaType | null;
  kindHint: KindHint;
  status: Status;
  /** 1–10, or null when unrated */
  score: number | null;
  progress: number | null;
  totalEpisodes: number | null;
  /** YYYY-MM-DD */
  finishedOn: string | null;
  imdbId: string | null;
  externalId: string | null;
  source: Source;
};

export type ParseResult = {
  format: "mal" | "letterboxd" | "imdb" | "csv";
  entries: ParsedEntry[];
  /** reason -> number of rows left out */
  skipped: Record<string, number>;
};

export function countSkip(skipped: Record<string, number>, reason: string): void {
  skipped[reason] = (skipped[reason] ?? 0) + 1;
}

export const MAX_ROWS = 3000;
