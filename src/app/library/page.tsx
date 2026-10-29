import type { Metadata } from "next";
import Link from "next/link";
import { LibraryItem } from "@/components/LibraryItem";
import { requireUser } from "@/lib/auth/dal";
import {
  isMediaType,
  isStatus,
  MEDIA_TYPE_LABEL,
  MEDIA_TYPES,
  STATUS_LABEL,
  STATUSES,
  type MediaType,
  type Status,
} from "@/lib/library/constants";
import { libraryStats, listEntries, type LibraryFilters } from "@/lib/library/queries";

export const metadata: Metadata = { title: "Your library" };

const PAGE_SIZE = 48;
const SORTS = [
  { value: "updated", label: "Recently updated" },
  { value: "title", label: "Title" },
  { value: "score", label: "Score" },
  { value: "year", label: "Year" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

type Query = { status?: Status; type?: MediaType; q: string; sort: Sort; page: number };

function href(base: Query, change: Partial<Query>): string {
  const next = { ...base, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.type) params.set("type", next.type);
  if (next.q) params.set("q", next.q);
  if (next.sort !== "updated") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? "border-marquee bg-marquee/15 text-marquee"
      : "border-line text-mute hover:border-cream hover:text-cream"
  }`;

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const user = await requireUser("/library");
  const sp = (await searchParams) as Params;

  const statusParam = one(sp.status);
  const typeParam = one(sp.type);
  const sortParam = one(sp.sort);
  const query: Query = {
    status: isStatus(statusParam) ? statusParam : undefined,
    type: isMediaType(typeParam) ? typeParam : undefined,
    q: one(sp.q).trim().slice(0, 100),
    sort: SORTS.some((s) => s.value === sortParam) ? (sortParam as Sort) : "updated",
    page: Math.max(1, Number.parseInt(one(sp.page), 10) || 1),
  };

  const filters: LibraryFilters = {
    status: query.status,
    mediaType: query.type,
    q: query.q || undefined,
    sort: query.sort,
  };
  const [stats, entries] = await Promise.all([
    libraryStats(user.id),
    listEntries(user.id, filters),
  ]);

  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = Boolean(query.status || query.type || query.q);

  if (stats.total === 0) {
    return (
      <section className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Your library is empty</h1>
        <p className="mt-3 text-mute">
          Add titles from any page with the + button, or bring in a list you already keep
          somewhere else.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/import"
            className="rounded-full bg-marquee px-6 py-2.5 text-sm font-semibold text-ink hover:bg-marquee/90"
          >
            Import a list
          </Link>
          <Link
            href="/"
            className="rounded-full border border-line px-6 py-2.5 text-sm hover:border-cream"
          >
            Browse titles
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Your library</h1>
          <p className="mt-1 text-sm text-mute">
            {stats.total} {stats.total === 1 ? "title" : "titles"}
            {stats.meanScore != null && ` · average score ${stats.meanScore.toFixed(1)}`}
            {stats.episodesWatched > 0 &&
              ` · ${stats.episodesWatched.toLocaleString("en-US")} episodes watched`}
          </p>
        </div>
        <Link
          href="/import"
          className="rounded-full border border-line px-4 py-2 text-sm hover:border-cream"
        >
          Import a list
        </Link>
      </header>

      {stats.unlinked > 0 && (
        <p
          role="note"
          className="mt-5 rounded-lg border border-marquee/30 bg-marquee/10 px-4 py-2.5 text-sm text-marquee"
        >
          {stats.unlinked} {stats.unlinked === 1 ? "title isn't" : "titles aren't"} linked to
          a catalogue entry yet, so they have no artwork. Use “Find match” on any of them to
          fix that.
        </p>
      )}

      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        <Link href={href(query, { status: undefined })} className={chip(!query.status)}>
          All ({stats.total})
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={href(query, { status: s })} className={chip(query.status === s)}>
            {STATUS_LABEL[s]} ({stats.byStatus[s]})
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <nav aria-label="Filter by type" className="flex flex-wrap gap-2">
          <Link href={href(query, { type: undefined })} className={chip(!query.type)}>
            All types
          </Link>
          {MEDIA_TYPES.map((t) => (
            <Link key={t} href={href(query, { type: t })} className={chip(query.type === t)}>
              {MEDIA_TYPE_LABEL[t]}
            </Link>
          ))}
        </nav>

        <form action="/library" method="get" role="search" className="flex gap-2">
          {query.status && <input type="hidden" name="status" value={query.status} />}
          {query.type && <input type="hidden" name="type" value={query.type} />}
          {query.sort !== "updated" && <input type="hidden" name="sort" value={query.sort} />}
          <label htmlFor="library-q" className="sr-only">
            Search your library
          </label>
          <input
            id="library-q"
            name="q"
            defaultValue={query.q}
            placeholder="Search your library…"
            maxLength={100}
            className="w-56 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-cream placeholder:text-mute focus:border-marquee focus:outline-none"
          />
        </form>

        <nav aria-label="Sort" className="flex items-center gap-2 text-sm text-mute">
          <span>Sort:</span>
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={href(query, { sort: s.value })}
              aria-current={query.sort === s.value ? "true" : undefined}
              className={
                query.sort === s.value ? "text-marquee" : "hover:text-cream"
              }
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <p className="mt-12 text-center text-mute">
          {filtered ? "Nothing in your library matches those filters." : "Nothing here yet."}{" "}
          {filtered && (
            <Link href="/library" className="text-cream underline underline-offset-2">
              Clear filters
            </Link>
          )}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <LibraryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link href={href(query, { page: page - 1 })} className="rounded-full border border-line px-4 py-2 hover:border-cream">
              ← Previous
            </Link>
          ) : (
            <span className="px-4 py-2 text-mute/50">← Previous</span>
          )}
          <span className="text-mute">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href(query, { page: page + 1 })} className="rounded-full border border-line px-4 py-2 hover:border-cream">
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
