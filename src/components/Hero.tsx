import Image from "next/image";
import Link from "next/link";
import { mediaHref, releaseYear } from "@/lib/format";
import { tmdbImage } from "@/lib/images";
import type { MediaSummary } from "@/lib/types";
import { QuickAdd } from "./QuickAdd";

export function Hero({ media }: { media: MediaSummary }) {
  const backdrop = tmdbImage(media.backdropPath, "w1280");
  const hue = (media.id * 47) % 360;
  const year = releaseYear(media.releaseDate);

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(120% 90% at 70% 10%, hsl(${hue} 40% 24%), var(--color-ink) 70%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/60 to-ink/10" />
        <div className="absolute inset-0 bg-linear-to-r from-ink/90 via-ink/40 to-transparent" />
      </div>

      <div className="mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end gap-4 px-4 pb-14 pt-32 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-marquee">
          Featured · {media.kind === "tv" ? "Series" : "Movie"}
        </p>
        <h1
          id="hero-title"
          className="max-w-3xl font-display text-4xl leading-tight text-cream sm:text-6xl"
        >
          {media.title}
        </h1>
        <p className="text-sm text-mute">
          {[year, media.rating > 0 ? `★ ${media.rating.toFixed(1)}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="line-clamp-3 max-w-2xl text-base leading-relaxed text-cream/85">
          {media.overview}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={mediaHref(media.kind, media.id)}
            className="inline-flex items-center rounded-full bg-marquee px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90"
          >
            View details
          </Link>
          <QuickAdd kind={media.kind} id={media.id} title={media.title} variant="full" />
        </div>
      </div>
    </section>
  );
}
