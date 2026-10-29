import { describe, expect, it } from "vitest";
import {
  classifyType,
  parseCount,
  parseIsoDate,
  parseScore,
  parseStatus,
  parseYear,
  splitTrailingYear,
} from "./fields";

describe("parseStatus", () => {
  it("reads MAL's numeric codes", () => {
    expect(parseStatus("1")).toBe("watching");
    expect(parseStatus("2")).toBe("completed");
    expect(parseStatus("3")).toBe("on_hold");
    expect(parseStatus("4")).toBe("dropped");
    expect(parseStatus("6")).toBe("plan");
  });

  it("reads common words loosely (case, spacing, punctuation)", () => {
    expect(parseStatus("Completed")).toBe("completed");
    expect(parseStatus("Plan to Watch")).toBe("plan");
    expect(parseStatus("plan-to-watch")).toBe("plan");
    expect(parseStatus("Currently Watching")).toBe("watching");
    expect(parseStatus("On-Hold")).toBe("on_hold");
    expect(parseStatus("Watchlist")).toBe("plan");
  });

  it("treats 'Not Interested' as a row to skip", () => {
    expect(parseStatus("Not Interested")).toBe("skip");
  });

  it("returns null for empty or unrecognised values", () => {
    expect(parseStatus("")).toBeNull();
    expect(parseStatus(undefined)).toBeNull();
    expect(parseStatus("banana")).toBeNull();
  });
});

describe("parseScore", () => {
  it("reads a plain 10-point score", () => {
    expect(parseScore("8")).toBe(8);
    expect(parseScore("7.5")).toBe(7.5);
  });

  it("reads fractions on any scale", () => {
    expect(parseScore("4/5", 10)).toBe(8);
    expect(parseScore("8/10")).toBe(8);
    expect(parseScore("90/100")).toBe(9);
  });

  it("reads a 5-point scale (Letterboxd) onto 10 points", () => {
    expect(parseScore("4.5", 5)).toBe(9);
    expect(parseScore("2.5", 5)).toBe(5);
  });

  it("treats a bare number over 10 as a percentage on a 10-point list", () => {
    expect(parseScore("85")).toBe(8.5);
  });

  it("returns null for unrated / empty / garbage", () => {
    expect(parseScore("")).toBeNull();
    expect(parseScore("-")).toBeNull();
    expect(parseScore("0")).toBeNull();
    expect(parseScore("n/a")).toBeNull();
    expect(parseScore(undefined)).toBeNull();
  });

  it("never returns more than 10 (a fraction above 1 is rejected, not clamped)", () => {
    expect(parseScore("999")).toBeNull();
    expect(parseScore("11/10")).toBeNull();
  });
});

describe("parseCount", () => {
  it("reads whole numbers including zero", () => {
    expect(parseCount("0")).toBe(0);
    expect(parseCount("26")).toBe(26);
  });

  it("rejects non-integers and junk", () => {
    expect(parseCount("3.5")).toBeNull();
    expect(parseCount("abc")).toBeNull();
    expect(parseCount("")).toBeNull();
    expect(parseCount("-5")).toBeNull();
  });
});

describe("parseIsoDate", () => {
  it("accepts a plain date and an ISO timestamp", () => {
    expect(parseIsoDate("2020-05-14")).toBe("2020-05-14");
    expect(parseIsoDate("2020-05-14T10:00:00Z")).toBe("2020-05-14");
  });

  it("rejects MAL's unset 0000-00-00 sentinel", () => {
    expect(parseIsoDate("0000-00-00")).toBeNull();
  });

  it("rejects an impossible calendar date", () => {
    expect(parseIsoDate("2020-02-30")).toBeNull();
    expect(parseIsoDate("2020-13-01")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });
});

describe("parseYear / splitTrailingYear", () => {
  it("finds a plausible year inside text", () => {
    expect(parseYear("Released 2016")).toBe(2016);
    expect(parseYear("no year here")).toBeNull();
  });

  it("splits a trailing (YYYY) off a title", () => {
    expect(splitTrailingYear("Goblin (2016)")).toEqual({ title: "Goblin", year: 2016 });
    expect(splitTrailingYear("Parasite")).toEqual({ title: "Parasite", year: null });
    // Not a year: left alone.
    expect(splitTrailingYear("Oceans (Eleven)")).toEqual({ title: "Oceans (Eleven)", year: null });
  });
});

describe("classifyType", () => {
  it("recognises movies", () => {
    expect(classifyType("Movie")).toEqual({ mediaType: "movie", kindHint: "movie" });
    expect(classifyType("TV Movie")).toEqual({ mediaType: "movie", kindHint: "movie" });
  });

  it("recognises series/drama variants", () => {
    expect(classifyType("TV Series")).toEqual({ mediaType: "tv", kindHint: "tv" });
    expect(classifyType("Drama")).toEqual({ mediaType: "tv", kindHint: "tv" });
    expect(classifyType("Web series")).toEqual({ mediaType: "tv", kindHint: "tv" });
  });

  it("recognises anime, picking movie vs tv underneath", () => {
    expect(classifyType("TV")).toEqual({ mediaType: "tv", kindHint: "tv" });
    expect(classifyType("Movie").mediaType).toBe("movie");
  });

  it("returns nulls for empty or unrecognised values", () => {
    expect(classifyType("")).toEqual({ mediaType: null, kindHint: null });
    expect(classifyType("xyz")).toEqual({ mediaType: null, kindHint: null });
  });
});
