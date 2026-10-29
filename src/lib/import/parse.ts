import type { Source, Status } from "@/lib/library/constants";
import { readSourceFiles, type SourceFile } from "./container";
import { parseCsv } from "./csv";
import { parseMal } from "./mal";
import { ImportError, MAX_ROWS, type ParseResult } from "./types";

export type ParseOptions = {
  /** What the person said the file is. Content decides the format; this only labels CSV lists. */
  source: Source | "auto";
  /** Status for rows that don't have one. */
  defaultStatus: Status;
};

function parseOne(file: SourceFile, options: ParseOptions): ParseResult {
  const start = file.text.trimStart().charAt(0);
  if (start === "<") return parseMal(file.text);
  if (start === "{" || start === "[") {
    throw new ImportError("JSON exports aren't supported yet. Export a CSV from that site instead.");
  }
  return parseCsv(file.text, file.name, options);
}

/** Read an uploaded file (plain, .gz or .zip) into normalised, un-matched entries. */
export function parseImportFile(
  bytes: Uint8Array,
  filename: string,
  options: ParseOptions,
): ParseResult {
  const parts = readSourceFiles(bytes, filename).map((file) => parseOne(file, options));

  const skipped: Record<string, number> = {};
  for (const part of parts) {
    for (const [reason, count] of Object.entries(part.skipped)) {
      skipped[reason] = (skipped[reason] ?? 0) + count;
    }
  }
  const entries = parts.flatMap((part) => part.entries);

  if (entries.length === 0) {
    const left = Object.values(skipped).reduce((a, b) => a + b, 0);
    throw new ImportError(
      left > 0
        ? `Nothing to import: all ${left} rows were skipped.`
        : "We didn't find any titles in that file.",
    );
  }
  if (entries.length > MAX_ROWS) {
    throw new ImportError(
      `That file has ${entries.length} titles. The limit is ${MAX_ROWS} per import, so split it into parts.`,
    );
  }

  return { format: parts[0].format, entries, skipped };
}
