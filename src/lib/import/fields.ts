import type { MediaType, Status } from "@/lib/library/constants";
import type { KindHint } from "./types";

/* Small, forgiving parsers for the values found in list exports. */

const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const STATUS_WORDS: Record<string, Status | "skip"> = {
  completed: "completed",
  complete: "completed",
  finished: "completed",
  watched: "completed",
  done: "completed",
  seen: "completed",

  watching: "watching",
  currentlywatching: "watching",
  current: "watching",
  inprogress: "watching",
  ongoing: "watching",
  rewatching: "watching",

  plantowatch: "plan",
  plan: "plan",
  planned: "plan",
  ptw: "plan",
  watchlist: "plan",
  towatch: "plan",
  wanttowatch: "plan",
  backlog: "plan",
  queued: "plan",

  onhold: "on_hold",
  hold: "on_hold",
  paused: "on_hold",

  dropped: "dropped",
  drop: "dropped",
  abandoned: "dropped",

  notinterested: "skip",
};

/** MyAnimeList's numeric status codes, used by its import format. */
const MAL_CODES: Record<string, Status> = {
  "1": "watching",
  "2": "completed",
  "3": "on_hold",
  "4": "dropped",
  "6": "plan",
};

/**
 * null  = empty or not recognised
 * "skip" = a status that means "don't import this row" (e.g. Not Interested)
 */
export function parseStatus(raw: string | null | undefined): Status | "skip" | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  return MAL_CODES[value] ?? STATUS_WORDS[compact(value)] ?? null;
}

/**
 * A rating on a 1–10 scale, or null for "unrated".
 * Understands "8", "7.5", "8/10", "4/5" and (for 10-point lists) percentages.
 * Pass maxScale 5 for sources that rate out of five (Letterboxd).
 */
export function parseScore(raw: string | null | undefined, maxScale = 10): number | null {
  const value = (raw ?? "").trim().replace(",", ".");
  if (!value || value === "-") return null;

  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(value);
  const plain = /^\d+(?:\.\d+)?$/.test(value);
  if (!fraction && !plain) return null;

  const n = Number(fraction ? fraction[1] : value);
  const scale = fraction ? Number(fraction[2]) : maxScale;
  if (!Number.isFinite(n) || !Number.isFinite(scale) || n <= 0 || scale <= 0) return null;

  let score = (n / scale) * 10;
  // A bare number between 11 and 100 in a 10-point list is a percentage.
  if (!fraction && maxScale === 10 && n > 10 && n <= 100) score = n / 10;

  if (score > 10.0001) return null;
  return Math.round(Math.min(score, 10) * 10) / 10;
}

/** A whole number of episodes (0 allowed), or null. */
export function parseCount(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim();
  return /^\d{1,6}$/.test(value) ? Number(value) : null;
}

/** YYYY-MM-DD from a date or ISO timestamp. Unset dates like 0000-00-00 give null. */
export function parseIsoDate(raw: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((raw ?? "").trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1870 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** A plausible release year found anywhere in the text. */
export function parseYear(raw: string | null | undefined): number | null {
  const match = /\b(18[7-9]\d|19\d\d|20\d\d|21\d\d)\b/.exec(raw ?? "");
  return match ? Number(match[1]) : null;
}

/** "Goblin (2016)" -> { title: "Goblin", year: 2016 } */
export function splitTrailingYear(title: string): { title: string; year: number | null } {
  const match = /^(.*\S)\s*\((\d{4})\)\s*$/.exec(title.trim());
  if (!match) return { title: title.trim(), year: null };
  const year = parseYear(match[2]);
  return year ? { title: match[1].trim(), year } : { title: title.trim(), year: null };
}

/** What a "type" column says about an entry. Unknown values give nulls. */
export function classifyType(raw: string | null | undefined): {
  mediaType: MediaType | null;
  kindHint: KindHint;
} {
  const value = compact(raw ?? "");
  if (!value) return { mediaType: null, kindHint: null };

  const movie = value.includes("movie") || value.includes("film") || value === "short";
  if (value.includes("anime")) return { mediaType: "anime", kindHint: movie ? "movie" : "tv" };
  if (movie) return { mediaType: "movie", kindHint: "movie" };
  if (/(series|drama|show|tv|mini|web|season)/.test(value)) {
    return { mediaType: "tv", kindHint: "tv" };
  }
  return { mediaType: null, kindHint: null };
}
