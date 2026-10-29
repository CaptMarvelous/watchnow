/** The two kinds of title TMDB knows about. Anime and dramas are both "tv". */
export type MediaKind = "movie" | "tv";

export type MediaSummary = {
  kind: MediaKind;
  id: number;
  title: string;
  /** Title in the original language, when TMDB reports one (used to match imports). */
  originalTitle?: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  /** Movie release date or series first-air date as YYYY-MM-DD, or "" when unknown */
  releaseDate: string;
  /** 0–10; 0 means "no rating available" */
  rating: number;
  genreIds: number[];
};

/** The minimal fields needed to render a card. */
export type CardMedia = Pick<
  MediaSummary,
  "kind" | "id" | "title" | "posterPath" | "releaseDate" | "rating"
>;

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

export type TvInfo = {
  seasons: number | null;
  episodes: number | null;
  /** e.g. "Returning Series", "Ended" */
  status: string | null;
  networks: string[];
  nextEpisodeDate: string | null;
};

export type MediaDetails = MediaSummary & {
  tagline: string;
  /** Movie runtime, or typical episode length for series, in minutes */
  runtime: number | null;
  genres: { id: number; name: string }[];
  cast: CastMember[];
  /** YouTube video key of an official trailer, if one exists */
  trailerKey: string | null;
  similar: MediaSummary[];
  /** Present only for series */
  tv: TvInfo | null;
};

export type MediaRowData = {
  slug: string;
  title: string;
  items: MediaSummary[];
};

export type HomeData = {
  hero: MediaSummary | null;
  rows: MediaRowData[];
  /** Set when bundled sample data is shown instead of live TMDB data */
  sample: null | "no-key" | "api-error";
};

export type SearchResult = {
  page: number;
  totalPages: number;
  results: MediaSummary[];
};
