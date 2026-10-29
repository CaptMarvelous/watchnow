import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, schema } from "./index";
import { MIGRATION_IDS } from "./migrations";

describe("database layer", () => {
  it("applies every migration exactly once", async () => {
    const db = await getDb();
    const rows = await db.select().from(schema.schemaMigrations);
    expect(rows.map((r) => r.id).sort()).toEqual([...MIGRATION_IDS].sort());
  });

  it("enforces unique emails and cascades deletes to library entries", async () => {
    const db = await getDb();
    const [user] = await db
      .insert(schema.users)
      .values({ email: "a@example.com", passwordHash: "x", displayName: "A" })
      .returning();

    await expect(
      db
        .insert(schema.users)
        .values({ email: "a@example.com", passwordHash: "y", displayName: "B" }),
    ).rejects.toThrow();

    await db.insert(schema.libraryEntries).values({
      userId: user.id,
      dedupeKey: "t:movie:metropolis:1927",
      source: "manual",
      title: "Metropolis",
      mediaType: "movie",
      status: "completed",
    });

    // The same title cannot be stored twice for one user...
    await expect(
      db.insert(schema.libraryEntries).values({
        userId: user.id,
        dedupeKey: "t:movie:metropolis:1927",
        source: "manual",
        title: "Metropolis",
        mediaType: "movie",
        status: "completed",
      }),
    ).rejects.toThrow();

    // ...and invalid enum-like values are rejected by CHECK constraints.
    await expect(
      db.insert(schema.libraryEntries).values({
        userId: user.id,
        dedupeKey: "other",
        source: "manual",
        title: "Bad",
        mediaType: "book",
        status: "completed",
      }),
    ).rejects.toThrow();

    await db.delete(schema.users).where(eq(schema.users.id, user.id));
    const left = await db.select().from(schema.libraryEntries);
    expect(left).toHaveLength(0);
  });
});
