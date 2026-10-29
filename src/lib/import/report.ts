/** Client-safe description of what an import did. */

export type ImportReport = {
  format: "mal" | "letterboxd" | "imdb" | "csv";
  /** Titles found in the file (after skipped rows were dropped). */
  titles: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Rows that described a title already in the same file and were merged into it. */
  merged: number;
  linked: number;
  unlinked: number;
  skipped: { reason: string; count: number }[];
  matching: "complete" | "no-key" | "deadline" | "unavailable";
  /** A few titles that couldn't be linked, to show what to look for in the library. */
  unlinkedExamples: string[];
};

export type ImportState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      report?: ImportReport;
    }
  | undefined;

export const FORMAT_LABEL: Record<ImportReport["format"], string> = {
  mal: "MyAnimeList export",
  letterboxd: "Letterboxd export",
  imdb: "IMDb export",
  csv: "CSV list",
};
