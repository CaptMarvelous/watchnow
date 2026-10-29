import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";
import { SITE_SLUG } from "@/lib/site";

/*
 * Database-backed sessions.
 *
 * The browser holds a random 256-bit token in an httpOnly cookie. The database
 * stores only the SHA-256 of that token, so a leaked database dump can't be
 * replayed as live sessions. Sessions are absolute (30 days) and a new token is
 * issued on every login, which prevents session fixation.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const isProd = process.env.NODE_ENV === "production";

/** The __Host- prefix pins the cookie to this exact host, over HTTPS, at path "/". */
export const SESSION_COOKIE = isProd ? `__Host-${SITE_SLUG}_session` : `${SITE_SLUG}_session`;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
};

export type ActiveSession = { sessionId: string; user: SessionUser };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ---------- database layer (no request context, easy to test) ---------- */

export async function insertSession(
  userId: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const db = await getDb();
  await db.insert(schema.sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}

export async function findSession(
  token: string,
  now = new Date(),
): Promise<ActiveSession | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      sessionId: schema.sessions.id,
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      createdAt: schema.users.createdAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, now)))
    .limit(1);

  if (!row) return null;
  return {
    sessionId: row.sessionId,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
}

/** Sign a user out everywhere, optionally keeping the session they're using. */
export async function deleteSessionsForUser(
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.sessions)
    .where(
      exceptSessionId
        ? and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, exceptSessionId))
        : eq(schema.sessions.userId, userId),
    );
}

export async function countSessions(userId: string, now = new Date()): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, now)));
  return row?.n ?? 0;
}

export async function purgeExpiredSessions(now = new Date()): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
}

/* ---------- cookie layer (needs a request; call from actions and route handlers) ---------- */

export async function startSession(userId: string): Promise<void> {
  await purgeExpiredSessions();
  const { token, expiresAt } = await insertSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByToken(token);
  store.delete(SESSION_COOKIE);
}

export async function readCurrentSession(): Promise<ActiveSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? findSession(token) : null;
}
