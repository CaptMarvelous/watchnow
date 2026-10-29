import "server-only";

import {
  sampleDetails,
  sampleHome,
  sampleSearch,
  sampleSearchKind,
} from "./sample-data";
import type {
  CardMedia,
  HomeData,
  MediaDetails,
  MediaKind,
  MediaRowData,
  MediaSummary,
  SearchResult,
} from "./types";

// Overridable so tests can point the client at a local fake server.
const API_BASE = process.env.TMDB_API_BASE?.trim() || "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY?.trim();

/** True when a TMDB key is configured; otherwise bundled sample data is used. */
export const hasTmdbKey = Boolean(API_KEY);

/* ---------- raw TMDB shapes (only the fields we use) ---------- */

type RawMedia = {
  id: number;
  /** Present on mixed lists such as trending and multi-search. */
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
};

type RawList = {
  page: number;
  results: RawMedia[];
  total_pages: number;
};

type RawDetails = RawMedia & {
  tagline?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  networks?: { name: string }[];
  next_episode_to_air?: { air_date?: string | null } | null;
  genres?: { id: number; name: string }[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
  };
  videos?: {
    results?: { key: string; type: string; site: string; official?: boolean }[];
  };
  similar?: { results?: RawMedia[] };
};

type RawFind = { movie_results?: RawMedia[]; tv_results?: RawMedia[] };

/* ---------- plumbing ---------- */

class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function tmdb<T>(
  path: string,
  params: Record<string, string | number | boolean> = {},
  revalidate = 3600,
): Promise<T> {
  const url = new URL(API_BASE + path);
  const headers: Record<string, string> = { accept: "application/json" };

  // Supports both credential types TMDB issues: the long v4 "read access token"
  // (a JWT, sent as a bearer token) and the short v3 API key (query param).
  if (API_KEY!.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${API_KEY}`;
  } else {
    url.searchParams.set("api_key", API_KEY!);
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers, next: { revalidate } });
  if (!res.ok) throw new TmdbError(`TMDB ${res.status} for ${path}`, res.status);
  return (await res.json()) as T;
}

function toSummary(m: RawMedia, kind: MediaKind): MediaSummary {
  const title = kind === "movie" ? m.title : m.name;
  return {
    kind,
    id: m.id,
    title: title ?? m.title ?? m.name ?? "Untitled",
    originalTitle: (kind === "movie" ? m.original_title : m.original_name) || undefined,
    overview: m.overview ?? "",
    posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null,
    releaseDate: (kind === "movie" ? m.release_date : m.first_air_date) ?? "",
    rating: m.vote_average ?? 0,
    genreIds: m.genre_ids ?? [],
  };
}

/** Summaries from a list whose items declare their own media_type. */
function mixedToSummaries(raw: RawMedia[]): MediaSummary[] {
  const out: MediaSummary[] = [];
  for (const item of raw) {
    if (item.media_type === "movie") out.push(toSummary(item, "movie"));
    else if (item.media_type === "tv") out.push(toSummary(item, "tv"));
  }
  return out;
}

/* ---------- home page ---------- */

type RowSpec = {
  slug: string;
  title: string;
  path: string;
  params?: Record<string, string | number | boolean>;
  /** "mixed" lists carry a media_type on every item. */
  kind: MediaKind | "mixed";
};

const HOME_ROWS: RowSpec[] = [
  { slug: "trending", title: "Trending this week", path: "/trending/all/week", kind: "mixed" },
  {
    slug: "kdrama",
    title: "K-dramas",
    path: "/discover/tv",
    params: {
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: "popularity.desc",
      "vote_count.gte": 50,
    },
    kind: "tv",
  },
  {
    slug: "anime",
    title: "Anime",
    path: "/discover/tv",
    params: {
      with_genres: 16,
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "vote_count.gte": 100,
    },
    kind: "tv",
  },
  {
    slug: "cdrama",
    title: "C-dramas",
    path: "/discover/tv",
    params: {
      with_origin_country: "CN",
      with_original_language: "zh",
      sort_by: "popularity.desc",
      "vote_count.gte": 30,
    },
    kind: "tv",
  },
  {
    slug: "jdrama",
    title: "Japanese dramas",
    path: "/discover/tv",
    params: {
      with_origin_country: "JP",
      with_original_language: "ja",
      without_genres: 16,
      sort_by: "popularity.desc",
      "vote_count.gte": 30,
    },
    kind: "tv",
  },
  { slug: "top-series", title: "Top-rated series", path: "/tv/top_rated", kind: "tv" },
  { slug: "popular-movies", title: "Popular movies", path: "/movie/popular", kind: "movie" },
  { slug: "top-movies", title: "Top-rated movies", path: "/movie/top_rated", kind: "movie" },
];

export async function getHomeData(): Promise<HomeData> {
  if (!hasTmdbKey) return sampleHome("no-key");

  const settled = await Promise.allSettled(
    HOME_ROWS.map((row) => tmdb<RawList>(row.path, row.params)),
  );

  const rows: MediaRowData[] = [];
  HOME_ROWS.forEach((spec, i) => {
    const result = settled[i];
    if (result.status !== "fulfilled") return;
    const items =
      spec.kind === "mixed"
        ? mixedToSummaries(result.value.results)
        : result.value.results.map((r) => toSummary(r, spec.kind as MediaKind));
    if (items.length > 0) rows.push({ slug: spec.slug, title: spec.title, items });
  });

  // If every list failed, the key is probably wrong or TMDB is down.
  if (rows.length === 0) return sampleHome("api-error");

  const hero =
    rows
      .flatMap((r) => r.items)
      .find((m) => m.backdropPath && m.overview) ?? null;

  return { hero, rows, sample: null };
}

/* ---------- search ---------- */

export async function searchMedia(query: string, page = 1): Promise<SearchResult> {
  if (!hasTmdbKey) return sampleSearch(query);

  const data = await tmdb<RawList>(
    "/search/multi",
    { query, page, include_adult: false },
    600,
  );
  return {
    page: data.page,
    // TMDB caps pagination at 500 pages.
    totalPages: Math.min(data.total_pages, 500),
    results: mixedToSummaries(data.results),
  };
}

/** Kind-specific title lookup used by the importer to match list entries. */
export async function searchByKind(
  kind: MediaKind,
  query: string,
  year?: number,
): Promise<MediaSummary[]> {
  if (!hasTmdbKey) return sampleSearchKind(kind, query);

  const params: Record<string, string | number | boolean> = {
    query,
    include_adult: false,
  };
  if (year) {
    if (kind === "movie") params.year = year;
    else params.first_air_date_year = year;
  }
  const data = await tmdb<RawList>(`/search/${kind}`, params, 86_400);
  return data.results.slice(0, 8).map((r) => toSummary(r, kind));
}

/** Exact lookup by IMDb id (tt1234567). Returns null when TMDB has no match. */
export async function findByImdbId(imdbId: string): Promise<MediaSummary | null> {
  if (!hasTmdbKey || !/^tt\d{5,10}$/.test(imdbId)) return null;

  const data = await tmdb<RawFind>(
    `/find/${imdbId}`,
    { external_source: "imdb_id" },
    86_400,
  );
  const movie = data.movie_results?.[0];
  if (movie) return toSummary(movie, "movie");
  const tv = data.tv_results?.[0];
  return tv ? toSummary(tv, "tv") : null;
}

/* ---------- details ---------- */

/** Returns null when the title does not exist. */
export async function getMedia(
  kind: MediaKind,
  id: number,
): Promise<MediaDetails | null> {
  if (!hasTmdbKey) return sampleDetails(kind, id);

  let raw: RawDetails;
  try {
    raw = await tmdb<RawDetails>(`/${kind}/${id}`, {
      append_to_response: "credits,videos,similar",
    });
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }

  const youtube = (raw.videos?.results ?? []).filter((v) => v.site === "YouTube");
  const trailer =
    youtube.find((v) => v.type === "Trailer" && v.official) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube.find((v) => v.type === "Teaser");

  return {
    ...toSummary(raw, kind),
    genreIds: (raw.genres ?? []).map((g) => g.id),
    tagline: raw.tagline ?? "",
    runtime:
      kind === "movie" ? (raw.runtime ?? null) : (raw.episode_run_time?.[0] ?? null),
    genres: raw.genres ?? [],
    cast: (raw.credits?.cast ?? []).slice(0, 14).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    trailerKey: trailer?.key ?? null,
    similar: (raw.similar?.results ?? []).slice(0, 18).map((r) => toSummary(r, kind)),
    tv:
      kind === "tv"
        ? {
            seasons: raw.number_of_seasons ?? null,
            episodes: raw.number_of_episodes ?? null,
            status: raw.status ?? null,
            networks: (raw.networks ?? []).map((n) => n.name),
            nextEpisodeDate: raw.next_episode_to_air?.air_date ?? null,
          }
        : null,
  };
}

/** Canonical card data for a title, fetched server-side so clients can't forge it. */
export async function getCard(kind: MediaKind, id: number): Promise<CardMedia | null> {
  const media = await getMedia(kind, id);
  return media
    ? {
        kind: media.kind,
        id: media.id,
        title: media.title,
        posterPath: media.posterPath,
        releaseDate: media.releaseDate,
        rating: media.rating,
      }
    : null;
}
