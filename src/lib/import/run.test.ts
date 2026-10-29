import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "@/db";
import { listEntries } from "@/lib/library/queries";
import { collapseDuplicates, runImport, toEntryInput } from "./run";
import type { ParsedEntry } from "./types";

/*
 * No TMDB_API_KEY is set for tests (see vitest.config.ts), so hasTmdbKey is
 * false and runImport skips matching entirely. That lets these tests exercise
 * the real parse -> collapse -> write pipeline against the real test database,
 * with every entry landing unlinked (which is also worth covering on its own).
 */

async function freshUser(email: string) {
  const db = await getDb();
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: "x", displayName: "Test" })
    .returning();
  return user;
}

const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));

describe("runImport", () => {
  it("creates one entry per title from a CSV list", async () => {
    const user = await freshUser(`a-${Date.now()}@example.com`);
    const csv = ["Title,Status,Score", "Goblin,Completed,9.5", "Signal,Watching,"].join("\n");

    const report = await runImport(user.id, bytes(csv), "list.csv", {
      source: "auto",
      defaultStatus: "plan",
      policy: "keep",
    });

    expect(report.titles).toBe(2);
    expect(report.created).toBe(2);
    expect(report.linked).toBe(0);
    expect(report.unlinked).toBe(2);
    expect(report.matching).toBe("no-key");

    const entries = await listEntries(user.id);
    expect(entries.map((e) => e.title).sort()).toEqual(["Goblin", "Signal"]);
    expect(entries.find((e) => e.title === "Goblin")?.score).toBe(9.5);
  });

  it("is idempotent: importing the same file twice changes nothing the second time", async () => {
    const user = await freshUser(`b-${Date.now()}@example.com`);
    const csv = ["Title,Status", "Goblin,Completed"].join("\n");
    const options = { source: "auto" as const, defaultStatus: "plan" as const, policy: "keep" as const };

    const first = await runImport(user.id, bytes(csv), "list.csv", options);
    const second = await runImport(user.id, bytes(csv), "list.csv", options);

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(await listEntries(user.id)).toHaveLength(1);
  });

  it("'keep' policy doesn't overwrite a manual edit; 'overwrite' does", async () => {
    const user = await freshUser(`c-${Date.now()}@example.com`);
    const csv = ["Title,Status,Score", "Goblin,Completed,9"].join("\n");

    await runImport(user.id, bytes(csv), "list.csv", {
      source: "auto",
      defaultStatus: "plan",
      policy: "keep",
    });

    // The user re-rates it by hand.
    const db = await getDb();
    await db
      .update(schema.libraryEntries)
      .set({ score: 10 })
      .where(eq(schema.libraryEntries.userId, user.id));

    const keepRun = await runImport(user.id, bytes(csv), "list.csv", {
      source: "auto",
      defaultStatus: "plan",
      policy: "keep",
    });
    expect(keepRun.unchanged).toBe(1); // the import's 9 doesn't beat the user's 10
    expect((await listEntries(user.id))[0].score).toBe(10);

    const overwriteRun = await runImport(user.id, bytes(csv), "list.csv", {
      source: "auto",
      defaultStatus: "plan",
      policy: "overwrite",
    });
    expect(overwriteRun.updated).toBe(1);
    expect((await listEntries(user.id))[0].score).toBe(9);
  });

  it("collapses MyAnimeList seasons of one series into a single library entry", async () => {
    const user = await freshUser(`d-${Date.now()}@example.com`);
    const xml = `<myanimelist>
      <anime><series_animedb_id>1</series_animedb_id><series_title>Show</series_title><series_type>TV</series_type><series_episodes>12</series_episodes><my_watched_episodes>12</my_watched_episodes><my_score>8</my_score><my_status>Completed</my_status></anime>
      <anime><series_animedb_id>2</series_animedb_id><series_title>Show</series_title><series_type>TV</series_type><series_episodes>12</series_episodes><my_watched_episodes>6</my_watched_episodes><my_score>0</my_score><my_status>Watching</my_status></anime>
    </myanimelist>`;

    const report = await runImport(user.id, bytes(xml), "export.xml", {
      source: "mal",
      defaultStatus: "plan",
      policy: "keep",
    });

    // Both rows describe one un-linked title ("Show" / "Show"), so they collapse.
    expect(report.titles).toBe(2);
    expect(report.merged).toBe(1);
    expect(report.created).toBe(1);

    const [entry] = await listEntries(user.id);
    expect(entry.status).toBe("watching"); // one season still in progress
    expect(entry.progress).toBe(18); // 12 + 6, summed across seasons
  });

  it("surfaces skipped-row reasons in the report", async () => {
    const user = await freshUser(`e-${Date.now()}@example.com`);
    const csv = ["Title,Status", "Good Show,Completed", ",Completed", "Other,Favorited"].join("\n");

    const report = await runImport(user.id, bytes(csv), "list.csv", {
      source: "auto",
      defaultStatus: "plan",
      policy: "keep",
    });

    expect(report.titles).toBe(1);
    expect(report.skipped).toContainEqual({ reason: "Row without a title", count: 1 });
    expect(report.skipped).toContainEqual({
      reason: "Row with an unrecognised status",
      count: 1,
    });
  });
});

describe("toEntryInput / collapseDuplicates", () => {
  function entry(partial: Partial<ParsedEntry>): ParsedEntry {
    return {
      title: "Show",
      year: null,
      mediaType: "tv",
      kindHint: "tv",
      status: "watching",
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

  it("falls back to the source's implied media type when nothing else says", () => {
    const input = toEntryInput(entry({ mediaType: null, source: "mdl" }), null);
    expect(input.mediaType).toBe("tv");
    const input2 = toEntryInput(entry({ mediaType: null, source: "csv" }), null);
    expect(input2.mediaType).toBe("movie");
  });

  it("collapseDuplicates groups rows that share a dedupe key and leaves others alone", () => {
    const rows = [
      toEntryInput(entry({ title: "A", status: "completed" }), null),
      toEntryInput(entry({ title: "A", status: "watching" }), null),
      toEntryInput(entry({ title: "B", status: "plan" }), null),
    ];
    const collapsed = collapseDuplicates(rows);
    expect(collapsed).toHaveLength(2);
    expect(collapsed.find((e) => e.title === "B")?.status).toBe("plan");
  });
});
