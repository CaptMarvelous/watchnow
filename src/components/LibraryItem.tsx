import Link from "next/link";
import { removeEntryById } from "@/app/actions/library";
import { mediaHref } from "@/lib/format";
import { MEDIA_TYPE_LABEL, type MediaType, type Status } from "@/lib/library/constants";
import type { LibraryEntry } from "@/lib/library/queries";
import type { MediaKind } from "@/lib/types";
import { LinkMatch } from "./LinkMatch";
import { Poster } from "./Poster";
import { StatusPill } from "./StatusPill";

/** Stable number from a title, so un-linked entries still get a distinct placeholder colour. */
function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function LibraryItem({ entry }: { entry: LibraryEntry }) {
  const linked = entry.tmdbId != null && entry.tmdbKind != null;
  const href = linked ? mediaHref(entry.tmdbKind as MediaKind, entry.tmdbId as number) : null;
  const type = entry.mediaType as MediaType;

  const progress =
    type !== "movie" && entry.progress != null
      ? `${entry.progress}${entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""} episodes`
      : "";
  const meta = [MEDIA_TYPE_LABEL[type], entry.year ?? "", progress].filter(Boolean).join(" · ");

  const poster = (
    <Poster
      id={entry.tmdbId ?? hashTitle(entry.title)}
      title={entry.title}
      path={entry.posterPath}
      size="w185"
      sizes="80px"
      className="w-20 shrink-0"
    />
  );
  const title = (
    <h3 className="line-clamp-2 text-sm font-medium text-cream">{entry.title}</h3>
  );

  return (
    <li className="flex flex-wrap gap-x-4 rounded-xl border border-line bg-surface p-3">
      {href ? <Link href={href}>{poster}</Link> : poster}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {href ? (
          <Link href={href} className="hover:text-marquee">
            {title}
          </Link>
        ) : (
          title
        )}
        <p className="text-xs text-mute">{meta}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={entry.status as Status} />
          {entry.score != null && entry.score > 0 && (
            <span className="text-xs font-medium text-marquee">★ {entry.score}</span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-4 pt-1">
          {!linked && <LinkMatch entryId={entry.id} initialQuery={entry.title} />}
          <form action={removeEntryById}>
            <input type="hidden" name="entryId" value={entry.id} />
            <button
              type="submit"
              aria-label={`Remove ${entry.title} from your library`}
              className="text-xs text-mute underline-offset-2 hover:text-rose-300 hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
