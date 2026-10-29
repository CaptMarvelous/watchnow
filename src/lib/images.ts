const BASE = "https://image.tmdb.org/t/p";

export type ImageSize = "w185" | "w342" | "w500" | "w780" | "w1280";

export function tmdbImage(
  path: string | null | undefined,
  size: ImageSize = "w500",
): string | null {
  return path ? `${BASE}/${size}${path}` : null;
}
