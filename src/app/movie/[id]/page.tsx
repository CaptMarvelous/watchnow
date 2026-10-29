import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaDetail } from "@/components/MediaDetail";
import { loadMedia, mediaMetadata } from "@/lib/media-page";

export async function generateMetadata({
  params,
}: PageProps<"/movie/[id]">): Promise<Metadata> {
  const { id } = await params;
  return mediaMetadata(await loadMedia("movie", id), "movie");
}

export default async function MoviePage({ params }: PageProps<"/movie/[id]">) {
  const { id } = await params;
  const media = await loadMedia("movie", id);
  if (!media) notFound();
  return <MediaDetail media={media} />;
}
