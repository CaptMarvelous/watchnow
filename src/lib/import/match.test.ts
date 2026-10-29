import { describe, expect, it, vi } from "vitest";
import type { MediaSummary } from "@/lib/types";
import { matchEntries, pickBest, similarity, titleVariants, type Lookup } from "./match";
import type { ParsedEntry } from "./types";

function media(partial: Partial<MediaSummary> & { id: number; kind: "movie" | "tv" }): MediaSummary {
  return {
    title: "Untitled",
    overview: "",
    posterPath: null,
    backdropPath: null,
    releaseDate: "",
    rating: 0,
    genreIds: [],
    ...partial,
  };
}

function entry(partial: Partial<ParsedEntry>): ParsedEntry {
  return {
    title: "Example",
    year: null,
    mediaType: null,
    kindHint: null,
    status: "plan",
    score: null,
    progress: null,
    totalEpisodes: null,
    finishedOn: null,
    imdbId: null,
    externalId: null,
    source: "csv",
    ...partial,
  };
}

describe("similarity", () => {
  it("is 1 for identical strings and 0 for empty input", () => {
    expect(similarity("goblin", "goblin")).toBe(1);
    expect(similarity("", "goblin")).toBe(0);
  });

  it("is high for near-identical titles and low for unrelated ones", () => {
    expect(similarity("attack on titan", "attack on titans")).toBeGreaterThan(0.9);
    expect(similarity("goblin", "crash landing on you")).toBeLessThan(0.3);
  });
});

describe("titleVariants", () => {
  it("strips a season suffix and offers a franchise-head variant", () => {
    const variants = titleVariants("Attack on Titan: Final Season");
    expect(variants).toContain("Attack on Titan: Final Season");
    expect(variants).toContain("Attack on Titan");
  });

  it("strips an ordinal season suffix", () => {
    expect(titleVariants("My Hero Academia 6th Season")).toContain("My Hero Academia");
  });

  it("de-duplicates variants that normalise the same", () => {
    const variants = titleVariants("Show");
    expect(variants).toEqual(["Show"]);
  });
});

describe("pickBest", () => {
  const candidates = [
    media({ id: 1, kind: "tv", title: "Goblin", releaseDate: "2016-12-02" }),
    media({ id: 2, kind: "tv", title: "Guardian: The Lonely and Great God", releaseDate: "2016-12-02" }),
    media({ id: 3, kind: "movie", title: "Gobbler", releaseDate: "2016-01-01" }),
  ];

  it("picks the closest title match above the threshold", () => {
    const hit = pickBest(entry({}), "Goblin", candidates);
    expect(hit?.candidate.id).toBe(1);
  });

  it("returns null when nothing is close enough", () => {
    const hit = pickBest(entry({}), "Completely Unrelated Title Here", candidates);
    expect(hit).toBeNull();
  });

  it("rejects a movie candidate whose year is far from the entry's year", () => {
    const hit = pickBest(entry({ year: 2016 }), "Gobbler", [candidates[2]]);
    expect(hit).not.toBeNull();
    const farAway = pickBest(entry({ year: 2016 }), "Gobbler", [
      media({ id: 3, kind: "movie", title: "Gobbler", releaseDate: "2005-01-01" }),
    ]);
    expect(farAway).toBeNull();
  });

  it("allows a wider year gap for series than for movies", () => {
    const hit = pickBest(entry({ year: 2014 }), "Goblin", [
      media({ id: 1, kind: "tv", title: "Goblin", releaseDate: "2016-12-02" }),
    ]);
    expect(hit).not.toBeNull();
  });

  it("uses the original title when it matches better than the localized one", () => {
    const hit = pickBest(entry({}), "Kimi no Na wa", [
      media({ id: 9, kind: "movie", title: "Your Name.", originalTitle: "Kimi no Na wa." }),
    ]);
    expect(hit?.candidate.id).toBe(9);
  });
});

describe("matchEntries", () => {
  function fakeLookup(catalogue: MediaSummary[]): Lookup {
    return {
      async searchByKind(kind, query) {
        const q = query.toLowerCase();
        return catalogue.filter((c) => c.kind === kind && c.title.toLowerCase().includes(q.split(" ")[0]));
      },
      async findByImdbId() {
        return null;
      },
    };
  }

  it("matches entries it can find and leaves the rest unmatched", async () => {
    const catalogue = [media({ id: 1, kind: "tv", title: "Goblin", releaseDate: "2016-01-01" })];
    const entries = [entry({ title: "Goblin", kindHint: "tv" }), entry({ title: "Nonexistent Show" })];
    const run = await matchEntries(entries, fakeLookup(catalogue));
    expect(run.stopped).toBe("complete");
    expect(run.outcomes[0].status).toBe("matched");
    expect(run.outcomes[0].match?.id).toBe(1);
    expect(run.outcomes[1].status).toBe("unmatched");
  });

  it("prefers an IMDb id match over a title search", async () => {
    const imdbHit = media({ id: 42, kind: "movie", title: "Found by IMDb id" });
    const lookup: Lookup = {
      async searchByKind() {
        return [];
      },
      async findByImdbId(id) {
        return id === "tt0000001" ? imdbHit : null;
      },
    };
    const run = await matchEntries([entry({ imdbId: "tt0000001" })], lookup);
    expect(run.outcomes[0]).toMatchObject({ status: "matched", via: "imdb" });
    expect(run.outcomes[0].match?.id).toBe(42);
  });

  it("caches repeated searches instead of calling the lookup again", async () => {
    const searchByKind = vi.fn().mockResolvedValue([]);
    const lookup: Lookup = { searchByKind, async findByImdbId() { return null; } };
    await matchEntries([entry({ title: "Same Show" }), entry({ title: "Same Show" })], lookup);
    // Both entries try "Same Show" with kinds movie and tv by default (no kindHint) = 2 calls, not 4.
    expect(searchByKind).toHaveBeenCalledTimes(2);
  });

  it("stops after repeated lookup failures and reports 'unavailable'", async () => {
    const lookup: Lookup = {
      async searchByKind() {
        throw new Error("boom");
      },
      async findByImdbId() {
        return null;
      },
    };
    const entries = Array.from({ length: 20 }, (_, i) => entry({ title: `Show ${i}` }));
    const run = await matchEntries(entries, lookup, { concurrency: 2 });
    expect(run.stopped).toBe("unavailable");
    expect(run.outcomes.some((o) => o.status === "skipped")).toBe(true);
  });

  it("stops at the time budget and leaves the remainder skipped", async () => {
    let now = 0;
    const lookup: Lookup = {
      async searchByKind() {
        now += 100; // simulate each lookup taking time
        return [];
      },
      async findByImdbId() {
        return null;
      },
    };
    const entries = Array.from({ length: 50 }, (_, i) => entry({ title: `Show ${i}` }));
    const run = await matchEntries(entries, lookup, {
      concurrency: 1,
      budgetMs: 250,
      now: () => now,
    });
    expect(run.stopped).toBe("deadline");
    expect(run.outcomes.some((o) => o.status === "skipped")).toBe(true);
  });
});
