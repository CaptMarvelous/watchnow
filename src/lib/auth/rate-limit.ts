import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/*
 * Fixed-window counters kept in Postgres so limits hold across server
 * instances. Callers check isLimited() first, then recordFailure() when an
 * attempt fails (or for every attempt, for things like sign-ups).
 */

const t = schema.rateLimits;

export async function isLimited(
  key: string,
  max: number,
  windowMs: number,
  now = new Date(),
): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select().from(t).where(eq(t.key, key)).limit(1);
  if (!row) return false;
  const windowEnd = row.windowStart.getTime() + windowMs;
  return windowEnd > now.getTime() && row.count >= max;
}

/** Count one attempt. The window restarts once it has fully elapsed. */
export async function recordFailure(
  key: string,
  windowMs: number,
  now = new Date(),
): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - windowMs);
  await db
    .insert(t)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`CASE WHEN ${t.windowStart} < ${cutoff} THEN 1 ELSE ${t.count} + 1 END`,
        windowStart: sql`CASE WHEN ${t.windowStart} < ${cutoff} THEN ${now} ELSE ${t.windowStart} END`,
      },
    });
}

export async function clearLimit(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(t).where(eq(t.key, key));
}

/**
 * Best-effort client address. x-forwarded-for is only trustworthy behind a
 * proxy that sets it (Vercel, most hosts do); otherwise everyone shares the
 * "unknown" bucket, which still caps abuse, just less precisely.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (forwarded || headers.get("x-real-ip") || "unknown").slice(0, 64);
}

export const WINDOW = {
  fifteenMinutes: 15 * 60 * 1000,
  hour: 60 * 60 * 1000,
} as const;
