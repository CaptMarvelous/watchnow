import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { ImportError } from "./types";

const opts = { source: "auto" as const, defaultStatus: "plan" as const };

describe("parseCsv: Letterboxd layout", () => {
  const watched = [
    "Date,Name,Year,Letterboxd URI",
    "2023-01-02,Parasite,2019,https://boxd.it/abc",
    "2023-01-05,Oldboy,2003,https://boxd.it/def",
  ].join("\n");

  it("detects the layout and marks entries completed", () => {
    const result = parseCsv(watched, "watched.csv", opts);
    expect(result.format).toBe("letterboxd");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      title: "Parasite",
      year: 2019,
      mediaType: "movie",
      status: "completed",
      source: "letterboxd",
    });
  });

  it("marks entries from a file named watchlist as plan-to-watch", () => {
    const list = ["Date,Name,Year,Letterboxd URI", "2023-01-02,Dune,2021,https://boxd.it/x"].join(
      "\n",
    );
    const result = parseCsv(list, "watchlist.csv", opts);
    expect(result.entries[0].status).toBe("plan");
  });

  it("reads a 5-point rating onto the 10-point scale", () => {
    const ratings = [
      "Date,Name,Year,Letterboxd URI,Rating",
      "2023-01-02,Parasite,2019,https://boxd.it/abc,4.5",
    ].join("\n");
    const result = parseCsv(ratings, "ratings.csv", opts);
    expect(result.entries[0].score).toBe(9);
  });
});

describe("parseCsv: IMDb layout", () => {
  const rows = [
    "Const,Your Rating,Date Rated,Title,Title Type,Release Date,IMDb Rating",
    "tt6751668,9,2020-06-01,Parasite,movie,2019-05-30,8.5",
    "tt0944947,10,2021-01-01,Game of Thrones,tvSeries,2011-04-17,9.2",
    "tt1234567,,,Some Episode,tvEpisode,2015-01-01,8.0",
    "tt7654321,,,A Short Film,short,2018-01-01,7.0",
  ].join("\n");

  it("detects the layout and classifies by Title Type", () => {
    const result = parseCsv(rows, "ratings.csv", opts);
    expect(result.format).toBe("imdb");
    // The tvEpisode row is skipped; the short counts as a movie.
    expect(result.entries).toHaveLength(3);
    expect(result.skipped["TV episodes (rate the series instead)"]).toBe(1);
  });

  it("captures the imdb id and treats a rating as 'completed'", () => {
    const result = parseCsv(rows, "ratings.csv", opts);
    const parasite = result.entries.find((e) => e.title === "Parasite")!;
    expect(parasite.imdbId).toBe("tt6751668");
    expect(parasite.status).toBe("completed");
    expect(parasite.mediaType).toBe("movie");
    expect(parasite.score).toBe(9);
  });

  it("classifies a tvSeries row as tv", () => {
    const got = parseCsv(rows, "ratings.csv", opts);
    const got_ = got.entries.find((e) => e.title === "Game of Thrones")!;
    expect(got_.mediaType).toBe("tv");
    expect(got_.kindHint).toBe("tv");
  });
});

describe("parseCsv: generic / MDL-style layout", () => {
  it("reads a list with Title/Type/Status/Score/Episodes Watched columns", () => {
    const csv = [
      "Title,Type,Status,Score,Episodes Watched,Total Episodes",
      "Goblin,Drama,Completed,9.5,16,16",
      "Crash Landing on You,Drama,Watching,,8,16",
      "Hospital Playlist,Drama,Plan to Watch,,0,12",
    ].join("\n");

    const result = parseCsv(csv, "mydramalist.csv", { source: "mdl", defaultStatus: "plan" });
    expect(result.format).toBe("csv");
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toMatchObject({
      title: "Goblin",
      mediaType: "tv",
      status: "completed",
      score: 9.5,
      progress: 16,
      totalEpisodes: 16,
      source: "mdl",
    });
    expect(result.entries[1].status).toBe("watching");
    expect(result.entries[2].status).toBe("plan");
  });

  it("splits a trailing (YYYY) out of the title when there's no Year column", () => {
    const csv = ["Title,Status", "Goblin (2016),Completed"].join("\n");
    const result = parseCsv(csv, "list.csv", opts);
    expect(result.entries[0]).toMatchObject({ title: "Goblin", year: 2016 });
  });

  it("falls back to the chosen default status when none is given", () => {
    const csv = ["Title", "Some Show"].join("\n");
    const result = parseCsv(csv, "list.csv", { source: "auto", defaultStatus: "completed" });
    expect(result.entries[0].status).toBe("completed");
  });

  it("matches a title column by a known alias, tolerating case and spacing", () => {
    const csv = ["  Drama Title  ,My Rating", "Signal,8"].join("\n");
    const result = parseCsv(csv, "list.csv", opts);
    expect(result.entries[0].title).toBe("Signal");
    expect(result.entries[0].score).toBe(8);
  });

  it("skips a row with no title but keeps the rest", () => {
    const csv = ["Title,Status", ",Completed", "Real Show,Completed"].join("\n");
    const result = parseCsv(csv, "list.csv", opts);
    expect(result.entries).toHaveLength(1);
    expect(result.skipped["Row without a title"]).toBe(1);
  });

  it("skips a row with an unrecognised status rather than guessing", () => {
    const csv = ["Title,Status", "Show,Favorited"].join("\n");
    const result = parseCsv(csv, "list.csv", opts);
    expect(result.entries).toHaveLength(0);
    expect(result.skipped["Row with an unrecognised status"]).toBe(1);
  });

  it("throws a helpful error when there is no title column", () => {
    const csv = ["Foo,Bar", "1,2"].join("\n");
    expect(() => parseCsv(csv, "list.csv", opts)).toThrow(ImportError);
    expect(() => parseCsv(csv, "list.csv", opts)).toThrow(/title column/i);
  });

  it("throws a helpful error for a file with no header row", () => {
    expect(() => parseCsv("", "list.csv", opts)).toThrow(ImportError);
  });

  it("reads tab-separated values too (Papaparse auto-detects the delimiter)", () => {
    const tsv = ["Title\tStatus", "Goblin\tCompleted"].join("\n");
    const result = parseCsv(tsv, "list.tsv", opts);
    expect(result.entries[0].title).toBe("Goblin");
  });

  it("strips a UTF-8 BOM from the header", () => {
    const csv = "﻿Title,Status\nGoblin,Completed";
    const result = parseCsv(csv, "list.csv", opts);
    expect(result.entries[0].title).toBe("Goblin");
  });
});
