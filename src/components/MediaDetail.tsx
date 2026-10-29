import Image from "next/image";
import { MediaRow } from "@/components/MediaRow";
import { Poster } from "@/components/Poster";
import { TrackPanel } from "@/components/TrackPanel";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatRuntime, releaseYear } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import type { Status } from "@/lib/library/constants";
import { getEntryForMedia } from "@/lib/library/queries";
import { hasTmdbKey } from "@/lib/tmdb";
import type { MediaDetails } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Shared detail layout for movies and series. */
export async function MediaDetail({ media }: { media: MediaDetails }) {
  const user = await getCurrentUser();
  const year = releaseYear(media.releaseDate);
  const yearNumber = Number.parseInt(year, 10);
  const entry = user
    ? await getEntryForMedia(user.id, {
        kind: media.kind,
        id: media.id,
        title: media.title,
        year: Number.isFinite(yearNumber) ? yearNumber : null,
      })
    : null;

  const backdrop = tmdbImage(media.backdropPath, "w1280");
  const runtime = formatRuntime(media.runtime);
  const isTv = media.kind === "tv";

  const facts = [
    isTv ? "Series" : "Movie",
    year,
    runtime ? (isTv ? `${runtime} per episode` : runtime) : "",
    media.rating > 0 ? `★ ${media.rating.toFixed(1)}` : "",
  ].filter(Boolean);

  const tv = media.tv;
  const tvFacts = tv
    ? [
        tv.seasons ? plural(tv.seasons, "season") : "",
        tv.episodes ? plural(tv.episodes, "episode") : "",
        tv.status ?? "",
        tv.networks.slice(0, 2).join(", "),
        tv.nextEpisodeDate ? `Next episode ${tv.nextEpisodeDate}` : "",
      ].filter(Boolean)
    : [];

  return (
    <article>
      <div className="relative h-[38vh] min-h-[240px] w-full overflow-hidden bg-surface sm:h-[48vh]">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/50 to-ink/10" />
      </div>

      <div className="mx-auto -mt-28 max-w-7xl px-4 sm:-mt-40 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <Poster
            id={media.id}
            title={media.title}
            path={media.posterPath}
            sizes="(min-width: 640px) 256px, 160px"
            priority
            className="w-40 shrink-0 shadow-2xl ring-1 ring-line sm:w-64"
          />

          <div className="flex min-w-0 flex-1 flex-col justify-end gap-3 sm:pb-2">
            <h1 className="font-display text-3xl leading-tight sm:text-5xl">{media.title}</h1>
            {media.tagline && (
              <p className="font-display text-lg italic text-mute">{media.tagline}</p>
            )}
            <p className="text-sm text-mute">{facts.join(" · ")}</p>
            {tvFacts.length > 0 && <p className="text-sm text-mute">{tvFacts.join(" · ")}</p>}
            {media.genres.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {media.genres.map((genre) => (
                  <li
                    key={genre.id}
                    className="rounded-full border border-line px-3 py-1 text-xs text-cream/90"
                  >
                    {genre.name}
                  </li>
                ))}
              </ul>
            )}
            {media.trailerKey && (
              <div className="mt-1">
                <a
                  href="#trailer"
                  className="inline-flex items-center rounded-full bg-marquee px-5 py-2.5 text-sm font-semibold text-ink hover:bg-marquee/90"
                >
                  Watch trailer
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <section aria-labelledby="overview-heading" className="max-w-3xl">
              <h2 id="overview-heading" className="font-display text-xl">
                Overview
              </h2>
              <p className="mt-2 leading-relaxed text-cream/85">
                {media.overview || "No overview is available for this title yet."}
              </p>
              {!hasTmdbKey && (
                <p className="mt-3 text-xs text-mute">
                  Sample entry. Connect a TMDB key for artwork, cast, ratings and trailers.
                </p>
              )}
            </section>

            {media.trailerKey && (
              <section id="trailer" aria-labelledby="trailer-heading" className="mt-12 scroll-mt-24">
                <h2 id="trailer-heading" className="font-display text-xl">
                  Trailer
                </h2>
                <div className="mt-3 aspect-video max-w-4xl overflow-hidden rounded-xl border border-line bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.trailerKey)}`}
                    title={`${media.title} trailer`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="size-full"
                  />
                </div>
              </section>
            )}

            {media.cast.length > 0 && (
              <section aria-labelledby="cast-heading" className="mt-12">
                <h2 id="cast-heading" className="font-display text-xl">
                  Cast
                </h2>
                <ul className="no-scrollbar mt-3 flex gap-4 overflow-x-auto pb-2">
                  {media.cast.map((person) => {
                    const photo = tmdbImage(person.profilePath, "w185");
                    return (
                      <li key={person.id} className="w-28 shrink-0">
                        <div className="relative aspect-square overflow-hidden rounded-full bg-raised">
                          {photo ? (
                            <Image
                              src={photo}
                              alt={person.name}
                              fill
                              sizes="112px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="grid h-full place-items-center font-display text-2xl text-mute">
                              {person.name.charAt(0)}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-1 text-center text-sm">{person.name}</p>
                        <p className="line-clamp-1 text-center text-xs text-mute">
                          {person.character}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <TrackPanel
              kind={media.kind}
              id={media.id}
              signedIn={Boolean(user)}
              entry={
                entry
                  ? {
                      status: entry.status as Status,
                      score: entry.score,
                      progress: entry.progress,
                    }
                  : null
              }
              totalEpisodes={tv?.episodes ?? entry?.totalEpisodes ?? null}
            />
          </aside>
        </div>
      </div>

      <div className="mt-12">
        <MediaRow id="similar" title="More like this" items={media.similar} />
      </div>
    </article>
  );
}
