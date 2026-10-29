import type { CardMedia, MediaKind } from "./types";

export function releaseYear(date: string | null | undefined): string {
  return date && /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Strip a title down to the card fields (safe to send to the client). */
export function toCard(m: CardMedia): CardMedia {
  return {
    kind: m.kind,
    id: m.id,
    title: m.title,
    posterPath: m.posterPath,
    releaseDate: m.releaseDate,
    rating: m.rating,
  };
}

export function cardMeta(m: CardMedia): string {
  return [
    m.kind === "tv" ? "Series" : "Movie",
    releaseYear(m.releaseDate),
    m.rating > 0 ? `★ ${m.rating.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function mediaHref(kind: MediaKind, id: number): string {
  return `/${kind}/${id}`;
}
