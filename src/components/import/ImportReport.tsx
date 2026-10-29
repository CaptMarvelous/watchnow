import Link from "next/link";
import { FORMAT_LABEL, type ImportReport } from "@/lib/import/report";

const MATCHING_NOTE: Record<ImportReport["matching"], string | null> = {
  complete: null,
  "no-key": "This WatchNow instance has no TMDB key configured, so titles were saved without artwork or links.",
  deadline: "Matching took longer than expected and stopped partway through; the rest were saved without a link.",
  unavailable: "The movie database looked unreachable partway through, so some titles were saved without a link.",
};

function Stat({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-ink/40 px-4 py-3 text-center">
      <p className="font-display text-2xl text-cream">{value}</p>
      <p className="text-xs text-mute">{label}</p>
    </div>
  );
}

export function ImportReportView({
  report,
  onImportAnother,
}: {
  report: ImportReport;
  onImportAnother: () => void;
}) {
  const note = MATCHING_NOTE[report.matching];

  return (
    <div
      role="status"
      className="space-y-5 rounded-xl border border-marquee/30 bg-marquee/5 p-5"
    >
      <div>
        <h2 className="font-display text-xl text-cream">Import complete</h2>
        <p className="mt-1 text-sm text-mute">
          Read {report.titles} {report.titles === 1 ? "title" : "titles"} from your{" "}
          {FORMAT_LABEL[report.format]}
          {report.merged > 0 &&
            ` (${report.merged} ${report.merged === 1 ? "row" : "rows"} combined into titles already counted above)`}
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Added" value={report.created} />
        <Stat label="Updated" value={report.updated} />
        <Stat label="Already up to date" value={report.unchanged} />
        <Stat label="Linked to a title page" value={report.linked} />
      </div>

      {note && (
        <p className="rounded-lg border border-line bg-ink/40 px-3 py-2 text-xs text-mute">
          {note}
        </p>
      )}

      {report.unlinked > 0 && (
        <div className="rounded-lg border border-line bg-ink/40 px-4 py-3">
          <p className="text-sm text-cream">
            {report.unlinked} {report.unlinked === 1 ? "title doesn't" : "titles don't"} have a
            catalogue link yet, so they show without artwork.
          </p>
          {report.unlinkedExamples.length > 0 && (
            <p className="mt-1 text-xs text-mute">
              Including: {report.unlinkedExamples.join(", ")}
              {report.unlinked > report.unlinkedExamples.length ? ", …" : ""}
            </p>
          )}
          <p className="mt-2 text-xs text-mute">
            Open your library and use “Find match” on any of them to link it.
          </p>
        </div>
      )}

      {report.skipped.length > 0 && (
        <details className="text-sm text-mute">
          <summary className="cursor-pointer text-cream">
            {report.skipped.reduce((a, s) => a + s.count, 0)} rows were skipped
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {report.skipped.map((s) => (
              <li key={s.reason}>
                {s.reason}: {s.count}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <Link
          href="/library"
          className="rounded-full bg-marquee px-5 py-2 text-sm font-semibold text-ink hover:bg-marquee/90"
        >
          Go to your library
        </Link>
        <button
          type="button"
          onClick={onImportAnother}
          className="rounded-full border border-line px-5 py-2 text-sm text-cream hover:border-cream"
        >
          Import another file
        </button>
      </div>
    </div>
  );
}
