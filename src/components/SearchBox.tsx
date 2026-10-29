"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cardMeta, mediaHref } from "@/lib/format";
import type { CardMedia } from "@/lib/types";
import { Poster } from "./Poster";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

type Fetched = { q: string; items: CardMedia[] };

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [fetched, setFetched] = useState<Fetched>({ q: "", items: [] });
  const [open, setOpen] = useState(false);

  const activeQuery = debounced.trim();
  const searchable = activeQuery.length >= MIN_CHARS;
  const loading = searchable && fetched.q !== activeQuery;
  const items = searchable && fetched.q === activeQuery ? fetched.items : [];

  // Debounce keystrokes so we don't fire a request per character.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch suggestions for the settled query; abort stale requests.
  useEffect(() => {
    if (activeQuery.length < MIN_CHARS) return;
    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(activeQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data: { results?: CardMedia[] }) =>
        setFetched({ q: activeQuery, items: data.results ?? [] }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ q: activeQuery, items: [] });
      });

    return () => controller.abort();
  }, [activeQuery]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const showPanel = open && query.trim().length >= MIN_CHARS;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form role="search" onSubmit={submit}>
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search movies and series
        </label>
        <input
          id={`${listId}-input`}
          type="search"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search movies & series…"
          autoComplete="off"
          aria-controls={listId}
          className="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm text-cream placeholder:text-mute focus:border-marquee focus:outline-none"
        />
      </form>

      {showPanel && (
        <div
          id={listId}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        >
          <p aria-live="polite" className="sr-only">
            {loading
              ? "Searching"
              : `${items.length} suggestion${items.length === 1 ? "" : "s"}`}
          </p>
          {loading && <p className="px-4 py-3 text-sm text-mute">Searching…</p>}
          {!loading && items.length === 0 && (
            <p className="px-4 py-3 text-sm text-mute">No matches yet.</p>
          )}
          {items.length > 0 && (
            <ul>
              {items.map((media) => (
                <li key={`${media.kind}-${media.id}`}>
                  <Link
                    href={mediaHref(media.kind, media.id)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-raised"
                  >
                    <Poster
                      id={media.id}
                      title={media.title}
                      path={media.posterPath}
                      size="w185"
                      sizes="40px"
                      className="w-10 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-cream">
                        {media.title}
                      </span>
                      <span className="block text-xs text-mute">{cardMeta(media)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-medium text-marquee hover:bg-raised"
            >
              See all results for “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
