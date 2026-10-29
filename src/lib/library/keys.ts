import type { MediaKind } from "@/lib/types";
import type { MediaType } from "./constants";

/**
 * Lower-case, accent-free, punctuation-free form of a title, used both to
 * de-duplicate library entries and to compare titles when matching imports.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type KeyInput = {
  tmdbKind?: MediaKind | null;
  tmdbId?: number | null;
  imdbId?: string | null;
  mediaType: MediaType;
  title: string;
  year?: number | null;
};

/** Anime entries are series underneath, so they share a namespace with "tv". */
function keyType(mediaType: MediaType): "movie" | "tv" {
  return mediaType === "movie" ? "movie" : "tv";
}

export function titleKey(input: Pick<KeyInput, "mediaType" | "title" | "year">): string {
  return `t:${keyType(input.mediaType)}:${normalizeTitle(input.title)}:${input.year ?? ""}`;
}

/**
 * Identity of a library entry. Prefers a TMDB id, then an IMDb id, and falls
 * back to the normalised title and year for titles that couldn't be matched.
 */
export function dedupeKeyFor(input: KeyInput): string {
  if (input.tmdbId && input.tmdbKind) return `tmdb:${input.tmdbKind}:${input.tmdbId}`;
  if (input.imdbId) return `imdb:${input.imdbId.toLowerCase()}`;
  return titleKey(input);
}

/**
 * Keys an un-matched entry for the same title might already be stored under.
 * Used so that tracking a title from its TMDB page adopts an imported entry
 * instead of creating a duplicate.
 */
export function adoptableKeys(input: {
  kind: MediaKind;
  title: string;
  year?: number | null;
  imdbId?: string | null;
}): string[] {
  const type: MediaType = input.kind;
  const keys = [titleKey({ mediaType: type, title: input.title, year: input.year })];
  if (input.year) keys.push(titleKey({ mediaType: type, title: input.title, year: null }));
  if (input.imdbId) keys.push(`imdb:${input.imdbId.toLowerCase()}`);
  return keys;
}
