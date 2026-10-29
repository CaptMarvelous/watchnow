import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { readCurrentSession, type ActiveSession, type SessionUser } from "./session";

/*
 * Data access layer for "who is asking?". Server components and actions call
 * these instead of touching cookies directly. React's cache() means the lookup
 * happens once per request no matter how many components ask.
 *
 * Hiding a button is not authorization: every server action also calls
 * getCurrentUser() itself and scopes its queries to that user's id.
 */

export const getSession = cache(async (): Promise<ActiveSession | null> => {
  return readCurrentSession();
});

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return (await getSession())?.user ?? null;
});

/** For pages that need a signed-in user: redirects to the login form otherwise. */
export async function requireUser(returnTo = "/"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}
