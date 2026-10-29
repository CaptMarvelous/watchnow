import { gunzipSync } from "node:zlib";
import { unzipSync } from "fflate";
import { ImportError } from "./types";

/** Largest upload we accept, in bytes. Keep in step with serverActions.bodySizeLimit. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Largest amount of text we will unpack from an upload (guards against zip/gzip bombs). */
export const MAX_TEXT_BYTES = 24 * 1024 * 1024;

export type SourceFile = { name: string; text: string };

const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;
const isZip = (b: Uint8Array) =>
  b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05);

/** UTF-8 (with or without BOM) or UTF-16 text. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Letterboxd's export zip holds many files; these are the ones that matter. */
const LETTERBOXD_FILE = /^(watched|ratings|watchlist)\.csv$/i;
const LIST_FILE = /\.(csv|tsv|txt|xml)$/i;
const MAX_ZIP_FILES = 12;

function readZip(bytes: Uint8Array): SourceFile[] {
  let total = 0;
  let accepted = 0;
  let tooBig = false;

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Decide from the zip's directory, before anything is inflated.
      filter(file) {
        if (file.name.includes("/") || file.name.includes("\\")) return false; // top level only
        if (!LIST_FILE.test(file.name)) return false;
        if (file.originalSize > MAX_TEXT_BYTES || total + file.originalSize > MAX_TEXT_BYTES) {
          tooBig = true;
          return false;
        }
        if (accepted >= MAX_ZIP_FILES) return false;
        accepted++;
        total += file.originalSize;
        return true;
      },
    });
  } catch {
    throw new ImportError("We couldn't open that zip file. It may be damaged.");
  }

  let entries = Object.entries(files);
  const letterboxd = entries.filter(([name]) => LETTERBOXD_FILE.test(name));
  if (letterboxd.length > 0) entries = letterboxd;

  if (entries.length === 0) {
    throw new ImportError(
      tooBig
        ? "That zip contains files that are too large."
        : "We didn't find a list inside that zip (expected a .csv, .tsv or .xml file at the top level).",
    );
  }
  if (letterboxd.length === 0 && entries.length > 1) {
    throw new ImportError(
      "That zip contains several files. Unzip it and upload the one list you want to import.",
    );
  }

  return entries.map(([name, data]) => ({ name, text: decodeText(data) }));
}

/** Turn an upload (plain, .gz or .zip) into one or more text files. */
export function readSourceFiles(bytes: Uint8Array, filename: string): SourceFile[] {
  if (bytes.byteLength === 0) throw new ImportError("That file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImportError(`That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  if (isGzip(bytes)) {
    try {
      const out = gunzipSync(bytes, { maxOutputLength: MAX_TEXT_BYTES });
      return [{ name: filename.replace(/\.gz$/i, ""), text: decodeText(out) }];
    } catch (error) {
      if ((error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
        throw new ImportError("That file is too large once unpacked.");
      }
      throw new ImportError("We couldn't unpack that .gz file. It may be damaged.");
    }
  }

  if (isZip(bytes)) return readZip(bytes);

  return [{ name: filename, text: decodeText(bytes) }];
}
