"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import {
  dummyHash,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "@/lib/auth/password";
import {
  clearLimit,
  clientIp,
  isLimited,
  recordFailure,
  WINDOW,
} from "@/lib/auth/rate-limit";
import { safeNext } from "@/lib/auth/redirect";
import { endSession, startSession } from "@/lib/auth/session";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/auth/validation";
import type { FormState } from "@/lib/form-state";

const EMAIL_TAKEN = "An account with this email already exists. Try signing in.";

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const parsed = signupSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { displayName, email, password } = parsed.data;

  // Cap sign-ups per network so the form can't be used to mass-create accounts.
  const ipKey = `signup:ip:${clientIp(await headers())}`;
  if (await isLimited(ipKey, 10, WINDOW.hour)) {
    return { error: "Too many sign-ups from this network. Try again later.", values };
  }
  await recordFailure(ipKey, WINDOW.hour);

  const db = await getDb();
  const [taken] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (taken) return { fieldErrors: { email: EMAIL_TAKEN }, values };

  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    const [row] = await db
      .insert(schema.users)
      .values({ email, passwordHash, displayName })
      .returning({ id: schema.users.id });
    userId = row.id;
  } catch (error) {
    // Two sign-ups racing for the same email: the unique index decides.
    if (isUniqueViolation(error)) return { fieldErrors: { email: EMAIL_TAKEN }, values };
    throw error;
  }

  await startSession(userId);
  redirect(safeNext(formData.get("next"), "/library"));
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: String(formData.get("email") ?? "") };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter your email and password.", values };
  const { email, password } = parsed.data;

  const ip = clientIp(await headers());
  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${ip}`;
  if ((await isLimited(emailKey, 10, WINDOW.fifteenMinutes)) || (await isLimited(ipKey, 40, WINDOW.fifteenMinutes))) {
    return { error: "Too many attempts. Wait a few minutes and try again.", values };
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  // Always run a full verification, even for unknown emails, so timing doesn't
  // reveal which addresses have accounts.
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !valid) {
    await recordFailure(emailKey, WINDOW.fifteenMinutes);
    await recordFailure(ipKey, WINDOW.fifteenMinutes);
    return { error: "Incorrect email or password.", values };
  }

  await clearLimit(emailKey);

  // Quietly upgrade hashes made with older, weaker settings.
  if (needsRehash(user.passwordHash)) {
    await db
      .update(schema.users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(schema.users.id, user.id));
  }

  await startSession(user.id);
  redirect(safeNext(formData.get("next"), "/library"));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}
