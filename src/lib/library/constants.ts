/** Client-safe constants shared by the UI, the importer and the database layer. */

export const STATUSES = ["watching", "completed", "plan", "on_hold", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  watching: "Watching",
  completed: "Completed",
  plan: "Plan to watch",
  on_hold: "On hold",
  dropped: "Dropped",
};

/** Full class strings (not built dynamically) so Tailwind can see them. */
export const STATUS_CLASS: Record<Status, string> = {
  watching: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  completed: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
  plan: "bg-marquee/15 text-marquee ring-marquee/30",
  on_hold: "bg-violet-500/20 text-violet-300 ring-violet-400/30",
  dropped: "bg-rose-500/20 text-rose-300 ring-rose-400/30",
};

/** "anime" is a user-facing category; it is always a TMDB movie or series underneath. */
export const MEDIA_TYPES = ["movie", "tv", "anime"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  movie: "Movie",
  tv: "Series",
  anime: "Anime",
};

export const SOURCES = [
  "manual",
  "mal",
  "mdl",
  "letterboxd",
  "imdb",
  "csv",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  manual: "Added in WatchNow",
  mal: "MyAnimeList",
  mdl: "MyDramaList",
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  csv: "CSV file",
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as readonly string[]).includes(value);
}

export function isSource(value: unknown): value is Source {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value);
}
