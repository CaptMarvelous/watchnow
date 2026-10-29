import { describe, expect, it } from "vitest";
import { parseMal } from "./mal";
import { ImportError } from "./types";

// A realistic slice of MyAnimeList's "Export My List" XML.
const SAMPLE = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo>
    <user_id>12345</user_id>
    <user_name>demo</user_name>
    <user_export_type>1</user_export_type>
  </myinfo>
  <anime>
    <series_animedb_id>1</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>26</series_episodes>
    <my_id>0</my_id>
    <my_watched_episodes>26</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>2022-03-01</my_finish_date>
    <my_score>9</my_score>
    <my_status>Completed</my_status>
  </anime>
  <anime>
    <series_animedb_id>5</series_animedb_id>
    <series_title><![CDATA[Cowboy Bebop: Tengoku no Tobira]]></series_title>
    <series_type>Movie</series_type>
    <series_episodes>1</series_episodes>
    <my_watched_episodes>1</my_watched_episodes>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Plan to Watch</my_status>
  </anime>
  <anime>
    <series_animedb_id>6</series_animedb_id>
    <series_title><![CDATA[Trigun]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>26</series_episodes>
    <my_watched_episodes>12</my_watched_episodes>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_status>Watching</my_status>
  </anime>
  <anime>
    <series_animedb_id>999</series_animedb_id>
    <series_title><![CDATA[Some Show]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>12</series_episodes>
    <my_watched_episodes>0</my_watched_episodes>
    <my_score>0</my_score>
    <my_status>Not Interested</my_status>
  </anime>
</myanimelist>`;

describe("parseMal", () => {
  it("parses a real-shaped export", () => {
    const result = parseMal(SAMPLE);
    expect(result.format).toBe("mal");
    // "Not Interested" row is skipped.
    expect(result.entries).toHaveLength(3);
    expect(result.skipped["Marked not interested"]).toBe(1);
  });

  it("maps a completed TV entry correctly", () => {
    const [bebop] = parseMal(SAMPLE).entries;
    expect(bebop).toMatchObject({
      title: "Cowboy Bebop",
      mediaType: "anime",
      kindHint: "tv",
      status: "completed",
      score: 9,
      progress: 26,
      totalEpisodes: 26,
      finishedOn: "2022-03-01",
      externalId: "1",
      source: "mal",
    });
  });

  it("treats a Movie series_type as a movie with no episode progress", () => {
    const movie = parseMal(SAMPLE).entries.find((e) => e.title.includes("Tobira"))!;
    expect(movie.kindHint).toBe("movie");
    expect(movie.progress).toBeNull();
    expect(movie.totalEpisodes).toBeNull();
    expect(movie.score).toBeNull(); // my_score 0 means unrated
  });

  it("treats MAL's 0000-00-00 as no finish date", () => {
    const watching = parseMal(SAMPLE).entries.find((e) => e.title === "Trigun")!;
    expect(watching.finishedOn).toBeNull();
    expect(watching.status).toBe("watching");
    expect(watching.progress).toBe(12);
  });

  it("rejects a file that isn't MyAnimeList XML", () => {
    expect(() => parseMal("<foo><bar/></foo>")).toThrow(ImportError);
  });

  it("rejects truncated/malformed XML", () => {
    expect(() => parseMal("<myanimelist><anime><series_title>Oops</series_ti")).toThrow(
      ImportError,
    );
  });

  it("returns no entries (rather than throwing) for well-formed XML with no usable rows", () => {
    // fast-xml-parser tolerates a tag with no matching close; this is parseImportFile's
    // job to turn into a user-facing error, not parseMal's.
    const result = parseMal("<myanimelist><anime>");
    expect(result.entries).toHaveLength(0);
  });

  it("refuses a DOCTYPE declaration", () => {
    const withDoctype = `<?xml version="1.0"?><!DOCTYPE foo><myanimelist><anime><series_title>x</series_title><my_status>Completed</my_status></anime></myanimelist>`;
    expect(() => parseMal(withDoctype)).toThrow(ImportError);
  });

  it("gives a clear error for a manga export", () => {
    const manga = `<myanimelist><manga><manga_title>X</manga_title></manga></myanimelist>`;
    expect(() => parseMal(manga)).toThrow(/manga/i);
  });

  it("skips a row with no title", () => {
    const xml = `<myanimelist><anime><series_animedb_id>1</series_animedb_id><my_status>Completed</my_status></anime></myanimelist>`;
    const result = parseMal(xml);
    expect(result.entries).toHaveLength(0);
    expect(result.skipped["Entry without a title"]).toBe(1);
  });

  it("handles a single <anime> entry (not wrapped in an array by the XML parser)", () => {
    const xml = `<myanimelist><anime><series_title>Solo Show</series_title><my_status>Completed</my_status></anime></myanimelist>`;
    const result = parseMal(xml);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe("Solo Show");
  });
});
