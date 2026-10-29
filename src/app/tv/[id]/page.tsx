import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaDetail } from "@/components/MediaDetail";
import { loadMedia, mediaMetadata } from "@/lib/media-page";

export async function generateMetadata({
  params,
}: PageProps<"/tv/[id]">): Promise<Metadata> {
  const { id } = await params;
  return mediaMetadata(await loadMedia("tv", id), "tv");
}

export default async function TvPage({ params }: PageProps<"/tv/[id]">) {
  const { id } = await params;
  const media = await loadMedia("tv", id);
  if (!media) notFound();
  return <MediaDetail media={media} />;
}
