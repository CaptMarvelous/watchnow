import Papa from "papaparse";
import type { Status } from "@/lib/library/constants";
import {
  classifyType,
  parseCount,
  parseIsoDate,
  parseScore,
  parseStatus,
  parseYear,
  splitTrailingYear,
} from "./fields";
import {
  countSkip,
  ImportError,
  MAX_ROWS,
  type KindHint,
  type ParsedEntry,
  type ParseResult,
} from "./types";
import type { MediaType, Source } from "@/lib/library/constants";

/*
 * Reads CSV/TSV lists. Two layouts are recognised exactly (Letterboxd and IMDb
 * exports); anything else is read by looking for columns by name, so exports
 * from MyDramaList tools and hand-made spreadsheets work as long as they have a
 * title column. Column names are matched ignoring case and punctuation.
 */

const norm = (header: string) => header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ALIASES = {
  title: [
    "title", "name", "drama", "drama title", "movie", "movie title", "series",
    "series title", "show", "show title", "primary title",
  ],
  year: ["year", "release year", "year released", "released", "release date", "first aired"],
  status: ["status", "my status", "watch status", "list", "list name", "category", "state"],
  score: ["score", "rating", "your rating", "my rating", "my score", "user rating"],
  progress: [
    "progress", "episodes watched", "watched episodes", "eps watched",
    "my watched episodes", "episode progress", "current episode",
  ],
  total: ["episodes", "total episodes", "total eps", "series episodes", "number of episodes", "eps"],
  type: ["type", "title type", "media type", "kind", "format", "series type"],
  imdb: ["const", "imdb", "imdb id", "imdb const"],
  finished: [
    "finished", "date finished", "finish date", "end date", "completed date",
    "date completed", "watched date", "date watched", "finished on", "my finish date",
  ],
  external: ["id", "mdl id", "mal id", "series animedb id"],
} as const;

type Field = keyof typeof ALIASES;
type Columns = Partial<Record<Field, string>>;

function findColumns(headers: string[]): Columns {
  const byNorm = new Map<string, string>();
  for (const h of headers) if (!byNorm.has(norm(h))) byNorm.set(norm(h), h);

  const columns: Columns = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) {
      const hit = byNorm.get(alias);
      if (hit) {
        columns[field] = hit;
        break;
      }
    }
  }
  return columns;
}

/** IMDb "Title Type" values -> how we treat them. */
function imdbType(raw: string): { mediaType: MediaType; kindHint: KindHint } | "episode" | "other" {
  const v = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "tvepisode") return "episode";
  if (v === "tvseries" || v === "tvminiseries") return { mediaType: "tv", kindHint: "tv" };
  if (["movie", "tvmovie", "short", "tvshort", "video", "tvspecial"].includes(v)) {
    return { mediaType: "movie", kindHint: "movie" };
  }
  return "other";
}

export type CsvOptions = { source: Source | "auto"; defaultStatus: Status };

export function parseCsv(text: string, fileName: string, options: CsvOptions): ParseResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^﻿/, "").trim(),
  });

  const headers = (result.meta.fields ?? []).filter(Boolean);
  if (headers.length === 0) {
    throw new ImportError("That file doesn't look like a CSV or TSV list (no header row found).");
  }
  if (result.data.length > MAX_ROWS) {
    throw new ImportError(
      `That file has ${result.data.length} rows. The limit is ${MAX_ROWS} per import, so split it into parts.`,
    );
  }

  const normalized = new Set(headers.map(norm));
  const letterboxd = normalized.has("letterboxd uri") && normalized.has("name");
  const imdb = !letterboxd && normalized.has("const") && normalized.has("title");
  const columns = findColumns(headers);

  if (!columns.title) {
    const shown = headers.slice(0, 12).map((h) => `“${h.slice(0, 40)}”`).join(", ");
    throw new ImportError(
      `We couldn't find a title column. The columns in that file are: ${shown}. ` +
        "Rename the one with the titles to “Title” and try again.",
    );
  }

  // A file called "watchlist" holds things to watch, whatever site it came from.
  const planned = /watch\s*-?\s*list|to[\s_-]?watch|plan/i.test(fileName);
  const fallbackStatus: Status = planned ? "plan" : options.defaultStatus;
  const hasRatingColumn = Boolean(columns.score);

  const source: Source = letterboxd
    ? "letterboxd"
    : imdb
      ? "imdb"
      : options.source === "mdl"
        ? "mdl"
        : "csv";

  const entries: ParsedEntry[] = [];
  const skipped: Record<string, number> = {};
  const get = (row: Record<string, string>, column?: string) =>
    column ? String(row[column] ?? "").trim() : "";

  for (const row of result.data) {
    let title = get(row, columns.title);
    if (!title && imdb) title = get(row, headers.find((h) => norm(h) === "original title"));
    if (!title) {
      countSkip(skipped, "Row without a title");
      continue;
    }

    let year = parseYear(get(row, columns.year));
    const split = splitTrailingYear(title);
    if (split.year) {
      title = split.title;
      year ??= split.year;
    }

    let { mediaType, kindHint } = classifyType(get(row, columns.type));
    if (letterboxd) ({ mediaType, kindHint } = { mediaType: "movie", kindHint: "movie" });

    if (imdb) {
      const type = imdbType(get(row, columns.type));
      if (type === "episode") {
        countSkip(skipped, "TV episodes (rate the series instead)");
        continue;
      }
      if (type === "other") {
        countSkip(skipped, "Not a movie or series");
        continue;
      }
      ({ mediaType, kindHint } = type);
    }

    // Status: an explicit column wins, then what the layout implies, then the form's default.
    const statusText = get(row, columns.status);
    let status: Status;
    if (statusText) {
      const parsed = parseStatus(statusText);
      if (parsed === "skip") {
        countSkip(skipped, "Marked not interested");
        continue;
      }
      if (!parsed) {
        countSkip(skipped, "Row with an unrecognised status");
        continue;
      }
      status = parsed;
    } else if (letterboxd) {
      status = planned ? "plan" : "completed";
    } else if (imdb && hasRatingColumn && get(row, columns.score)) {
      status = "completed"; // a rating means it was watched
    } else {
      status = fallbackStatus;
    }

    const imdbId = get(row, columns.imdb).toLowerCase();
    const total = parseCount(get(row, columns.total));
    const external = get(row, columns.external).slice(0, 100);

    entries.push({
      title: title.slice(0, 300),
      year,
      mediaType,
      kindHint,
      status,
      score: parseScore(get(row, columns.score), letterboxd ? 5 : 10),
      progress: parseCount(get(row, columns.progress)),
      totalEpisodes: total && total > 0 ? total : null,
      finishedOn: parseIsoDate(get(row, columns.finished)),
      imdbId: /^tt\d{5,10}$/.test(imdbId) ? imdbId : null,
      externalId: external || null,
      source,
    });
  }

  return { format: letterboxd ? "letterboxd" : imdb ? "imdb" : "csv", entries, skipped };
}
