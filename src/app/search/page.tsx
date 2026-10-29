import type { Metadata } from "next";
import Link from "next/link";
import { MediaCard } from "@/components/MediaCard";
import { searchMedia } from "@/lib/tmdb";

type Params = { q?: string | string[]; page?: string | string[] };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/search">): Promise<Metadata> {
  const q = first(((await searchParams) as Params).q);
  return { title: q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = (await searchParams) as Params;
  const q = first(params.q).slice(0, 100);
  const page = Math.min(500, Math.max(1, Number.parseInt(first(params.page), 10) || 1));

  if (!q) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-display text-3xl">Search</h1>
        <p className="mt-3 text-mute">Type a title in the search box above.</p>
      </section>
    );
  }

  const { results, totalPages } = await searchMedia(q, page);
  const href = (p: number) => `/search?q=${encodeURIComponent(q)}&page=${p}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl">
        Results for <span className="text-marquee">“{q}”</span>
      </h1>
      <p className="mt-1 text-sm text-mute">Movies and series</p>

      {results.length === 0 ? (
        <p className="mt-10 text-mute">
          Nothing found. Try a different spelling or a shorter title.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((media, index) => (
            <li key={`${media.kind}-${media.id}`}>
              <MediaCard media={media} priority={index < 6} />
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="rounded-full border border-line px-4 py-2 hover:border-cream">
              ← Previous
            </Link>
          ) : (
            <span className="px-4 py-2 text-mute/50">← Previous</span>
          )}
          <span className="text-mute">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href(page + 1)} className="rounded-full border border-line px-4 py-2 hover:border-cream">
              Next →
            </Link>
          ) : (
            <span className="px-4 py-2 text-mute/50">Next →</span>
          )}
        </nav>
      )}
    </section>
  );
}
