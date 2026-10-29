"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { removeTracked, saveEntry } from "@/app/actions/library";
import { STATUS_LABEL, STATUSES, type Status } from "@/lib/library/constants";
import type { MediaKind } from "@/lib/types";
import { FormMessage } from "./ui/FormMessage";

type Entry = { status: Status; score: number | null; progress: number | null };

type Props = {
  kind: MediaKind;
  id: number;
  signedIn: boolean;
  entry: Entry | null;
  /** Total episodes for a series, when known. */
  totalEpisodes: number | null;
};

const selectClass =
  "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-cream focus:border-marquee focus:outline-none";
const labelClass = "block text-sm font-medium text-cream";

/** Add, rate and update a title in the signed-in user's library. */
export function TrackPanel({ kind, id, signedIn, entry, totalEpisodes }: Props) {
  const pathname = usePathname();
  const [saveState, saveAction, saving] = useActionState(saveEntry, undefined);
  const [removeState, removeAction, removing] = useActionState(removeTracked, undefined);

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg">Your list</h2>
        <p className="mt-1 text-sm text-mute">
          Sign in to mark this as watching or watched, rate it and keep your progress.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="mt-4 inline-flex rounded-full bg-marquee px-5 py-2 text-sm font-semibold text-ink hover:bg-marquee/90"
        >
          Sign in to track
        </Link>
      </div>
    );
  }

  const scores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  // Imported lists can hold half-point scores; keep them selectable.
  const extraScore = entry?.score != null && !scores.includes(entry.score) ? entry.score : null;
  // Re-mount the form when the saved values change so the inputs show them.
  const formKey = `${entry?.status ?? "none"}|${entry?.score ?? ""}|${entry?.progress ?? ""}`;
  const errors = saveState?.fieldErrors ?? {};

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg">Your list</h2>

      <form key={formKey} action={saveAction} className="mt-3 space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="tmdbId" value={id} />

        <div>
          <label htmlFor={`status-${id}`} className={labelClass}>
            Status
          </label>
          <select
            id={`status-${id}`}
            name="status"
            defaultValue={entry?.status ?? "plan"}
            className={selectClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {errors.status && <p role="alert" className="mt-1 text-xs text-rose-300">{errors.status}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`score-${id}`} className={labelClass}>
              Your score
            </label>
            <select
              id={`score-${id}`}
              name="score"
              defaultValue={entry?.score != null ? String(entry.score) : ""}
              className={selectClass}
            >
              <option value="">Not rated</option>
              {extraScore != null && <option value={String(extraScore)}>{extraScore}</option>}
              {scores.map((s) => (
                <option key={s} value={String(s)}>
                  {s}
                </option>
              ))}
            </select>
            {errors.score && <p role="alert" className="mt-1 text-xs text-rose-300">{errors.score}</p>}
          </div>

          {kind === "tv" && (
            <div>
              <label htmlFor={`progress-${id}`} className={labelClass}>
                Episodes seen
              </label>
              <input
                id={`progress-${id}`}
                name="progress"
                type="number"
                inputMode="numeric"
                min={0}
                max={totalEpisodes ?? undefined}
                defaultValue={entry?.progress ?? ""}
                placeholder="0"
                className={selectClass}
              />
              {totalEpisodes != null && (
                <p className="mt-1 text-xs text-mute">of {totalEpisodes}</p>
              )}
              {errors.progress && <p role="alert" className="mt-1 text-xs text-rose-300">{errors.progress}</p>}
            </div>
          )}
        </div>

        <FormMessage state={saveState} />

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-marquee px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90 disabled:opacity-60"
        >
          {saving ? "Saving…" : entry ? "Update" : "Add to my list"}
        </button>
      </form>

      {entry && (
        <form action={removeAction} className="mt-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="tmdbId" value={id} />
          <button
            type="submit"
            disabled={removing}
            className="w-full rounded-full border border-line px-5 py-2 text-sm text-mute transition-colors hover:border-rose-400/60 hover:text-rose-300 disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove from my list"}
          </button>
          <div className="mt-2">
            <FormMessage state={removeState} />
          </div>
        </form>
      )}
    </div>
  );
}
