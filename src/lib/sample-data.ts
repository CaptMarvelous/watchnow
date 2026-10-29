import type {
  HomeData,
  MediaDetails,
  MediaKind,
  MediaSummary,
  SearchResult,
} from "./types";

/**
 * Bundled sample catalogue so the app runs end to end without a TMDB API key.
 *
 * Movies are public-domain films. Series are fictional placeholders written for
 * this project (they are not real shows). No artwork or ratings are bundled:
 * cards fall back to generated placeholders and the rating is hidden.
 */

export const GENRE_NAMES: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  53: "Thriller",
  80: "Crime",
  878: "Science Fiction",
  9648: "Mystery",
  10749: "Romance",
  10752: "War",
  10765: "Sci-Fi & Fantasy",
};

type Seed = {
  kind: MediaKind;
  id: number;
  title: string;
  year: number;
  genreIds: number[];
  overview: string;
  /** Series only */
  seasons?: number;
  episodes?: number;
};

const SEEDS: Seed[] = [
  {
    kind: "movie",
    id: 900001,
    title: "Metropolis",
    year: 1927,
    genreIds: [878, 18],
    overview:
      "A planner's son discovers that the workers who keep a futuristic city running live in the depths beneath it, and tries to bridge the divide before it tears the city apart.",
  },
  {
    kind: "movie",
    id: 900002,
    title: "Nosferatu",
    year: 1922,
    genreIds: [27, 14],
    overview:
      "A young estate agent travels to a remote castle to close a property deal and unwittingly carries an ancient horror back to his home town.",
  },
  {
    kind: "movie",
    id: 900003,
    title: "A Trip to the Moon",
    year: 1902,
    genreIds: [878, 12, 35],
    overview:
      "A band of eccentric scholars launch themselves into space in a giant cannon shell and discover the Moon is not as quiet as it looks.",
  },
  {
    kind: "movie",
    id: 900004,
    title: "The General",
    year: 1926,
    genreIds: [35, 12, 10752],
    overview:
      "When enemy soldiers steal his beloved locomotive, a devoted engineer gives chase across the countryside in a story of slapstick and stubborn heroism.",
  },
  {
    kind: "movie",
    id: 900005,
    title: "Night of the Living Dead",
    year: 1968,
    genreIds: [27, 53],
    overview:
      "Strangers barricade themselves in a farmhouse overnight as the dead begin to walk, and fear turns the survivors against one another.",
  },
  {
    kind: "movie",
    id: 900006,
    title: "The Cabinet of Dr. Caligari",
    year: 1920,
    genreIds: [27, 9648],
    overview:
      "A sleepwalker is exhibited at a fairground and a string of murders follows, told through twisted sets and an unreliable narrator.",
  },
  {
    kind: "movie",
    id: 900007,
    title: "Sherlock Jr.",
    year: 1924,
    genreIds: [35],
    overview:
      "A film projectionist who dreams of being a great detective literally steps into the movie screen to solve a case of his own.",
  },
  {
    kind: "movie",
    id: 900008,
    title: "The Phantom of the Opera",
    year: 1925,
    genreIds: [27, 18],
    overview:
      "A disfigured composer haunts the cellars of a Paris opera house and becomes obsessed with a young singer.",
  },
  {
    kind: "movie",
    id: 900009,
    title: "The Kid",
    year: 1921,
    genreIds: [35, 18],
    overview:
      "A tramp who finds an abandoned baby raises him as his own, until the authorities threaten to separate them.",
  },
  {
    kind: "movie",
    id: 900010,
    title: "Safety Last!",
    year: 1923,
    genreIds: [35],
    overview:
      "A small-town clerk tries to impress his sweetheart in the big city and ends up scaling a skyscraper, one dizzying ledge at a time.",
  },
  {
    kind: "movie",
    id: 900011,
    title: "D.O.A.",
    year: 1950,
    genreIds: [80, 53],
    overview:
      "A man learns he has been fatally poisoned and has only days to find out who did it and why.",
  },
  {
    kind: "movie",
    id: 900012,
    title: "The Gold Rush",
    year: 1925,
    genreIds: [35, 12, 18],
    overview:
      "A lone prospector braves the frozen north in search of fortune and love, and learns that gold is the least of the hazards.",
  },

  // Fictional sample series ---------------------------------------------------
  {
    kind: "tv",
    id: 910001,
    title: "Harbor Lights",
    year: 2019,
    genreIds: [18, 10749],
    seasons: 1,
    episodes: 16,
    overview:
      "A ferry captain and a visiting marine biologist keep crossing paths on a small island where everyone knows everyone's secrets.",
  },
  {
    kind: "tv",
    id: 910002,
    title: "The Midnight Archive",
    year: 2021,
    genreIds: [9648, 18],
    seasons: 1,
    episodes: 12,
    overview:
      "A night-shift archivist realises the records in the basement are quietly changing, and someone upstairs wants her to stop asking why.",
  },
  {
    kind: "tv",
    id: 910003,
    title: "Paper Lanterns",
    year: 2018,
    genreIds: [10749, 18],
    seasons: 1,
    episodes: 20,
    overview:
      "Two rival lantern makers are forced to share a workshop for one festival season, and neither plans to lose.",
  },
  {
    kind: "tv",
    id: 910004,
    title: "Neon Tide",
    year: 2022,
    genreIds: [16, 10765],
    seasons: 2,
    episodes: 24,
    overview:
      "In a half-flooded future city, a young courier discovers the cargo she has been carrying is alive.",
  },
  {
    kind: "tv",
    id: 910005,
    title: "Cold Case Café",
    year: 2020,
    genreIds: [80, 9648],
    seasons: 1,
    episodes: 10,
    overview:
      "A retired detective runs a quiet café where regulars bring him the one case each of them could never let go.",
  },
  {
    kind: "tv",
    id: 910006,
    title: "Moonrise Academy",
    year: 2023,
    genreIds: [16, 10765],
    seasons: 1,
    episodes: 12,
    overview:
      "Scholarship student Mira arrives at an academy that only opens its doors after dark, and slowly learns why.",
  },
];

function toSummary(s: Seed): MediaSummary {
  return {
    kind: s.kind,
    id: s.id,
    title: s.title,
    overview: s.overview,
    posterPath: null,
    backdropPath: null,
    releaseDate: `${s.year}-01-01`,
    rating: 0,
    genreIds: s.genreIds,
  };
}

export const SAMPLE_MEDIA: MediaSummary[] = SEEDS.map(toSummary);
export const SAMPLE_MOVIES = SAMPLE_MEDIA.filter((m) => m.kind === "movie");
export const SAMPLE_SHOWS = SAMPLE_MEDIA.filter((m) => m.kind === "tv");

const byGenre = (list: MediaSummary[], ...ids: number[]) =>
  list.filter((m) => m.genreIds.some((g) => ids.includes(g)));

export function sampleHome(reason: "no-key" | "api-error"): HomeData {
  return {
    hero: SAMPLE_SHOWS[0],
    sample: reason,
    rows: [
      { slug: "sample-series", title: "Sample series", items: SAMPLE_SHOWS },
      { slug: "classics", title: "Public-domain classics", items: SAMPLE_MOVIES },
      { slug: "comedy", title: "Comedy", items: byGenre(SAMPLE_MOVIES, 35) },
      { slug: "horror", title: "Fright night", items: byGenre(SAMPLE_MOVIES, 27) },
      {
        slug: "mystery",
        title: "Crime & mystery",
        items: byGenre(SAMPLE_MEDIA, 80, 9648),
      },
    ],
  };
}

export function sampleSearch(query: string): SearchResult {
  const q = query.toLowerCase();
  const results = SAMPLE_MEDIA.filter((m) => m.title.toLowerCase().includes(q));
  return { page: 1, totalPages: 1, results };
}

/** Candidate lookup used by the importer when no TMDB key is configured. */
export function sampleSearchKind(kind: MediaKind, query: string): MediaSummary[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];
  return SAMPLE_MEDIA.filter(
    (m) =>
      m.kind === kind && tokens.some((t) => m.title.toLowerCase().includes(t)),
  );
}

export function sampleDetails(kind: MediaKind, id: number): MediaDetails | null {
  const seed = SEEDS.find((s) => s.kind === kind && s.id === id);
  if (!seed) return null;
  const media = toSummary(seed);
  return {
    ...media,
    tagline: "",
    runtime: null,
    genres: media.genreIds.map((g) => ({ id: g, name: GENRE_NAMES[g] ?? "Drama" })),
    cast: [],
    trailerKey: null,
    similar: SAMPLE_MEDIA.filter(
      (m) =>
        m.kind === kind &&
        m.id !== id &&
        m.genreIds.some((g) => media.genreIds.includes(g)),
    ),
    tv:
      kind === "tv"
        ? {
            seasons: seed.seasons ?? 1,
            episodes: seed.episodes ?? null,
            status: "Ended",
            networks: [],
            nextEpisodeDate: null,
          }
        : null,
  };
}
