import { normalizeTitle } from "@/lib/library/keys";
import type { MediaKind, MediaSummary } from "@/lib/types";
import type { ParsedEntry } from "./types";

/** The two TMDB lookups matching needs. Injected so tests can use a fake catalogue. */
export type Lookup = {
  searchByKind(kind: MediaKind, query: string, year?: number): Promise<MediaSummary[]>;
  findByImdbId(imdbId: string): Promise<MediaSummary | null>;
};

/** How alike two titles must be before we trust a match. */
export const ACCEPT_THRESHOLD = 0.85;

/* ---------- title similarity ---------- */

function bigrams(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    out.set(pair, (out.get(pair) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice similarity of two already-normalised strings, 0 to 1. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const left = bigrams(a);
  const right = bigrams(b);
  let shared = 0;
  for (const [pair, n] of left) shared += Math.min(n, right.get(pair) ?? 0);
  return (2 * shared) / (a.length - 1 + (b.length - 1));
}

/* ---------- query variants ---------- */

const SUFFIXES: RegExp[] = [
  /\s*\((?:tv|ova|ona|movie|special|\d{4})\)\s*$/i,
  /\s+(?:the\s+)?final\s+season(?:\s+part\s*\d+)?\s*$/i,
  /\s+\d+(?:st|nd|rd|th)\s+season(?:\s+part\s*\d+)?\s*$/i,
  /\s+season\s*\d+(?:\s+part\s*\d+)?\s*$/i,
  /\s+part\s*\d+\s*$/i,
  /\s+(?:ii|iii|iv|v|vi)\s*$/i,
];

/**
 * Queries to try for a title, most specific first. Streaming catalogues keep
 * every season under one series, so "Show 2nd Season" is also tried as "Show".
 */
export function titleVariants(title: string): string[] {
  const full = title.trim();
  let base = full;
  for (const pattern of SUFFIXES) base = base.replace(pattern, "").trim();
  // A suffix like ": Final Season" leaves a dangling separator once removed.
  base = base.replace(/[:\-–—]\s*$/, "").trim();

  const variants = [full, base];
  for (const text of [full, base]) {
    const head = text.split(/\s*[:–—]\s+|\s+-\s+/)[0]?.trim();
    if (head && head.length >= 4) variants.push(head);
  }

  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = normalizeTitle(v);
    if (v.length < 2 || !key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---------- choosing a candidate ---------- */

const yearOf = (date: string): number | null =>
  /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;

/** Best candidate for a query, or null if none is similar enough (and in the right years). */
export function pickBest(
  entry: Pick<ParsedEntry, "year">,
  query: string,
  candidates: MediaSummary[],
): { candidate: MediaSummary; score: number } | null {
  const wanted = normalizeTitle(query);
  let best: { candidate: MediaSummary; score: number } | null = null;

  for (const candidate of candidates) {
    const names = [candidate.title, candidate.originalTitle].filter((n): n is string => !!n);
    const sim = Math.max(...names.map((name) => similarity(wanted, normalizeTitle(name))));
    if (sim < ACCEPT_THRESHOLD) continue;

    let bonus = 0;
    const candidateYear = yearOf(candidate.releaseDate);
    if (entry.year && candidateYear) {
      const gap = Math.abs(entry.year - candidateYear);
      // Series list the year they started, so allow a bigger gap than for films.
      if (gap > (candidate.kind === "movie" ? 1 : 3)) continue;
      if (gap === 0) bonus = 0.05;
    }

    const score = sim + bonus;
    if (!best || score > best.score) best = { candidate, score };
  }
  return best;
}

function otherKind(kind: MediaKind): MediaKind {
  return kind === "movie" ? "tv" : "movie";
}

/** Kinds worth searching, in order. A known kind is trusted, except for anime. */
function kindsFor(entry: ParsedEntry): MediaKind[] {
  if (entry.kindHint) {
    return entry.mediaType === "anime" ? [entry.kindHint, otherKind(entry.kindHint)] : [entry.kindHint];
  }
  return entry.source === "mdl" ? ["tv", "movie"] : ["movie", "tv"];
}

/* ---------- matching ---------- */

export type MatchOutcome = {
  match: MediaSummary | null;
  via: "imdb" | "title" | null;
  /** matched, unmatched (searched, nothing confident), failed (lookup error) or skipped (ran out of time) */
  status: "matched" | "unmatched" | "failed" | "skipped";
};

type Cache = Map<string, Promise<MediaSummary[]>>;

async function matchOne(entry: ParsedEntry, lookup: Lookup, cache: Cache): Promise<MatchOutcome> {
  if (entry.imdbId) {
    const hit = await lookup.findByImdbId(entry.imdbId);
    if (hit) return { match: hit, via: "imdb", status: "matched" };
  }

  const search = (kind: MediaKind, query: string, year?: number) => {
    const key = `${kind}|${normalizeTitle(query)}|${year ?? ""}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = lookup.searchByKind(kind, query, year);
      cache.set(key, pending);
    }
    return pending;
  };

  const kinds = kindsFor(entry);
  // Try with the year first (it sharpens the results), then without it.
  const years: (number | undefined)[] = entry.year ? [entry.year, undefined] : [undefined];

  for (const query of titleVariants(entry.title)) {
    for (const year of years) {
      let best: { candidate: MediaSummary; score: number } | null = null;
      for (const kind of kinds) {
        const hit = pickBest(entry, query, await search(kind, query, year));
        if (hit && (!best || hit.score > best.score)) best = hit;
        if (hit && entry.kindHint) break; // a known kind that matched is trusted
      }
      if (best) return { match: best.candidate, via: "title", status: "matched" };
    }
  }
  return { match: null, via: null, status: "unmatched" };
}

export type MatchRun = {
  outcomes: MatchOutcome[];
  /** complete, out of time budget, or TMDB looks unreachable */
  stopped: "complete" | "deadline" | "unavailable";
};

/**
 * Match every entry against TMDB with a few lookups in flight at once. Gives up
 * early (leaving the rest unmatched) when the time budget runs out or lookups
 * keep failing, so one bad moment at TMDB can't hang or fail the whole import.
 */
export async function matchEntries(
  entries: ParsedEntry[],
  lookup: Lookup,
  options: { concurrency?: number; budgetMs?: number; now?: () => number } = {},
): Promise<MatchRun> {
  const { concurrency = 6, budgetMs = 40_000, now = Date.now } = options;
  const outcomes: MatchOutcome[] = entries.map(() => ({
    match: null,
    via: null,
    status: "skipped",
  }));
  const cache: Cache = new Map();
  const started = now();

  let next = 0;
  let consecutiveFailures = 0;
  let stopped: MatchRun["stopped"] = "complete";

  async function worker() {
    while (stopped === "complete") {
      const index = next++;
      if (index >= entries.length) return;
      if (now() - started > budgetMs) {
        stopped = "deadline";
        return;
      }
      try {
        outcomes[index] = await matchOne(entries[index], lookup, cache);
        consecutiveFailures = 0;
      } catch {
        outcomes[index] = { match: null, via: null, status: "failed" };
        if (++consecutiveFailures >= 8) stopped = "unavailable";
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { outcomes, stopped };
}
