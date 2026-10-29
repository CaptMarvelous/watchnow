"use client";

import { useActionState, useRef, useState } from "react";
import { importList } from "@/app/actions/import";
import { MAX_UPLOAD_BYTES } from "@/lib/import/container";
import { FORMAT_LABEL } from "@/lib/import/report";
import { STATUS_LABEL, STATUSES } from "@/lib/library/constants";
import { ImportReportView } from "./ImportReport";

const SOURCE_OPTIONS = [
  { value: "auto", label: "Detect automatically" },
  { value: "mal", label: "MyAnimeList (XML export)" },
  { value: "mdl", label: "MyDramaList (CSV, via a community export tool)" },
  { value: "letterboxd", label: "Letterboxd (CSV, detected automatically)" },
  { value: "imdb", label: "IMDb (CSV, detected automatically)" },
  { value: "csv", label: "Other CSV / spreadsheet export" },
] as const;

const selectClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-cream focus:border-marquee focus:outline-none";

export function ImportForm() {
  const [state, action, pending] = useActionState(importList, undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-5 rounded-xl border border-line bg-surface p-5">
        <div>
          <label htmlFor="import-file" className="block text-sm font-medium text-cream">
            List file
          </label>
          <input
            ref={inputRef}
            id="import-file"
            name="file"
            type="file"
            required
            accept=".csv,.tsv,.txt,.xml,.gz,.zip"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="mt-1 block w-full text-sm text-cream file:mr-3 file:rounded-full file:border-0 file:bg-marquee file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-marquee/90"
          />
          <p className="mt-1 text-xs text-mute">
            {fileName ? `Selected: ${fileName}. ` : ""}
            CSV, TSV, XML, or a .gz / .zip containing one. Up to{" "}
            {MAX_UPLOAD_BYTES / 1024 / 1024} MB.
          </p>
          {state?.fieldErrors?.file && (
            <p role="alert" className="mt-1 text-xs text-rose-300">
              {state.fieldErrors.file}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="import-source" className="block text-sm font-medium text-cream">
            Where this is from
          </label>
          <select id="import-source" name="source" defaultValue="auto" className={selectClass}>
            {SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-mute">
            Letterboxd and IMDb exports are recognised from their columns either way. This only
            matters for a plain CSV that doesn&apos;t say what site it&apos;s from.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="import-status" className="block text-sm font-medium text-cream">
              Status for rows with none
            </label>
            <select
              id="import-status"
              name="defaultStatus"
              defaultValue="plan"
              className={selectClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="import-policy" className="block text-sm font-medium text-cream">
              If a title is already in your library
            </label>
            <select id="import-policy" name="policy" defaultValue="keep" className={selectClass}>
              <option value="keep">Keep what I have; fill in anything missing</option>
              <option value="overwrite">Use the imported values</option>
            </select>
          </div>
        </div>

        {state?.error && (
          <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-marquee px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90 disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Importing…" : "Import"}
        </button>
      </form>

      {state?.report && (
        <ImportReportView
          report={state.report}
          onImportAnother={() => {
            if (inputRef.current) inputRef.current.value = "";
            setFileName(null);
          }}
        />
      )}
    </div>
  );
}

export { FORMAT_LABEL };
