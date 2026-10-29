import "server-only";

import type { Metadata } from "next";
import { tmdbImage } from "@/lib/images";
import { getMedia } from "@/lib/tmdb";
import type { MediaDetails, MediaKind } from "@/lib/types";

/** Shared by /movie/[id] and /tv/[id]. Returns null for ids that can't exist. */
export async function loadMedia(kind: MediaKind, rawId: string): Promise<MediaDetails | null> {
  if (!/^\d{1,9}$/.test(rawId)) return null;
  return getMedia(kind, Number(rawId));
}

export function mediaMetadata(media: MediaDetails | null, kind: MediaKind): Metadata {
  if (!media) return { title: kind === "tv" ? "Series not found" : "Movie not found" };

  const description = media.overview.slice(0, 160) || undefined;
  const backdrop = tmdbImage(media.backdropPath, "w780");
  return {
    title: media.title,
    description,
    openGraph: { title: media.title, description, images: backdrop ? [backdrop] : undefined },
  };
}
