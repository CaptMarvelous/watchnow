import { XMLParser } from "fast-xml-parser";
import { classifyType, parseCount, parseIsoDate, parseScore, parseStatus } from "./fields";
import { countSkip, ImportError, type ParsedEntry, type ParseResult } from "./types";

/*
 * MyAnimeList's "Export My List" produces
 *
 *   <myanimelist>
 *     <myinfo>…</myinfo>
 *     <anime>
 *       <series_animedb_id>1</series_animedb_id>
 *       <series_title>…</series_title>
 *       <series_type>TV</series_type>
 *       <series_episodes>26</series_episodes>
 *       <my_watched_episodes>26</my_watched_episodes>
 *       <my_finish_date>0000-00-00</my_finish_date>
 *       <my_score>9</my_score>
 *       <my_status>Completed</my_status>
 *       …
 *     </anime>
 *   </myanimelist>
 *
 * Statuses are words ("Plan to Watch") in exports and numbers (6) in the import
 * format; both are accepted. series_type and series_episodes are optional.
 */

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // keep "86" or "009-1" as text
  trimValues: true,
  isArray: (name) => name === "anime" || name === "manga",
});

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";

export function parseMal(xml: string): ParseResult {
  // Real exports never declare a DOCTYPE. Refusing it rules out entity-expansion tricks.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new ImportError(
      "That XML file declares a DOCTYPE, which a real MyAnimeList export never does, so it was not read.",
    );
  }

  let doc: { myanimelist?: Record<string, unknown> } | undefined;
  try {
    doc = parser.parse(xml);
  } catch {
    throw new ImportError("We couldn't read that XML file. Is it the file MyAnimeList gave you?");
  }

  const root = doc?.myanimelist;
  if (!root || typeof root !== "object") {
    throw new ImportError("That XML file isn't a MyAnimeList export (no <myanimelist> element).");
  }

  const rows = Array.isArray(root.anime) ? (root.anime as Record<string, unknown>[]) : [];
  if (rows.length === 0) {
    if (Array.isArray(root.manga) && root.manga.length > 0) {
      throw new ImportError(
        "That is a manga list. WatchNow tracks anime, series and movies, so export your anime list instead.",
      );
    }
    throw new ImportError("That MyAnimeList export doesn't contain any anime.");
  }

  const entries: ParsedEntry[] = [];
  const skipped: Record<string, number> = {};

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const title = text(row.series_title);
    if (!title) {
      countSkip(skipped, "Entry without a title");
      continue;
    }

    const status = parseStatus(text(row.my_status));
    if (status === "skip") {
      countSkip(skipped, "Marked not interested");
      continue;
    }
    if (!status) {
      countSkip(skipped, "Entry with an unrecognised status");
      continue;
    }

    const isMovie = classifyType(text(row.series_type)).kindHint === "movie";
    const total = parseCount(text(row.series_episodes));
    const id = text(row.series_animedb_id);

    entries.push({
      title: title.slice(0, 300),
      year: null, // MyAnimeList's export has no release year
      mediaType: "anime",
      kindHint: isMovie ? "movie" : "tv",
      status,
      score: parseScore(text(row.my_score)),
      progress: isMovie ? null : parseCount(text(row.my_watched_episodes)),
      totalEpisodes: isMovie || !total ? null : total,
      finishedOn: parseIsoDate(text(row.my_finish_date)),
      imdbId: null,
      externalId: id ? id.slice(0, 40) : null,
      source: "mal",
    });
  }

  return { format: "mal", entries, skipped };
}
