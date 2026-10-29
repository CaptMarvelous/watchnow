"use client";

import { useState, useTransition } from "react";
import { linkEntry, searchForLink } from "@/app/actions/library";
import { cardMeta } from "@/lib/format";
import type { CardMedia } from "@/lib/types";
import { Poster } from "./Poster";

type Props = { entryId: string; initialQuery: string };

/**
 * For a library entry that isn't linked to TMDB: search by title and pick the
 * right match, which adds the poster, details and a link to the title's page.
 */
export function LinkMatch({ entryId, initialQuery }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CardMedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      setError(null);
      const result = await searchForLink(query);
      if (result.ok) setResults(result.results);
      else {
        setResults(null);
        setError(result.error);
      }
    });
  }

  function choose(media: CardMedia) {
    startTransition(async () => {
      setError(null);
      const result = await linkEntry(entryId, media.kind, media.id);
      if (!result.ok) setError(result.error);
      // On success the server re-renders the library without this entry's "unlinked" state.
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          search();
        }}
        className="text-xs font-medium text-marquee underline-offset-2 hover:underline"
      >
        Find match
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-line bg-ink/50 p-3">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
        className="flex gap-2"
      >
        <label htmlFor={`link-${entryId}`} className="sr-only">
          Search for this title
        </label>
        <input
          id={`link-${entryId}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-cream focus:border-marquee focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-marquee px-3 py-1.5 text-sm font-semibold text-ink disabled:opacity-60"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm text-mute hover:text-cream"
        >
          Close
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
      {pending && <p className="mt-2 text-xs text-mute">Working…</p>}
      {results && results.length === 0 && !pending && (
        <p className="mt-2 text-xs text-mute">No matches. Try the English or original title.</p>
      )}
      {results && results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((media) => (
            <li key={`${media.kind}-${media.id}`} className="flex items-center gap-3">
              <Poster
                id={media.id}
                title={media.title}
                path={media.posterPath}
                size="w185"
                sizes="40px"
                className="w-10 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-cream">{media.title}</span>
                <span className="block text-xs text-mute">{cardMeta(media)}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(media)}
                className="shrink-0 rounded-full border border-marquee/60 px-3 py-1 text-xs font-semibold text-marquee hover:bg-marquee/10 disabled:opacity-60"
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
