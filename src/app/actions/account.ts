"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { getSession } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isLimited, recordFailure, clearLimit, WINDOW } from "@/lib/auth/rate-limit";
import { deleteSessionsForUser, endSession, SESSION_COOKIE } from "@/lib/auth/session";
import {
  changeEmailSchema,
  changePasswordSchema,
  deleteAccountSchema,
  fieldErrors,
  profileSchema,
} from "@/lib/auth/validation";
import type { FormState } from "@/lib/form-state";

const SIGNED_OUT: FormState = { error: "Your session has ended. Please sign in again." };

/**
 * Re-check the password for sensitive changes, with its own attempt limit so a
 * stolen session can't be used to guess the password offline-style.
 */
async function confirmPassword(
  userId: string,
  password: string,
): Promise<"ok" | "wrong" | "limited"> {
  const key = `pw:user:${userId}`;
  if (await isLimited(key, 10, WINDOW.fifteenMinutes)) return "limited";

  const db = await getDb();
  const [row] = await db
    .select({ hash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!row || !(await verifyPassword(password, row.hash))) {
    await recordFailure(key, WINDOW.fifteenMinutes);
    return "wrong";
  }
  await clearLimit(key);
  return "ok";
}

const TOO_MANY: FormState = { error: "Too many wrong passwords. Wait a few minutes and try again." };

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGNED_OUT;

  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ displayName: parsed.data.displayName })
    .where(eq(schema.users.id, session.user.id));

  revalidatePath("/", "layout");
  return { ok: true, message: "Display name updated." };
}

export async function changeEmail(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGNED_OUT;

  const parsed = changeEmailSchema.safeParse({
    newEmail: formData.get("newEmail"),
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const check = await confirmPassword(session.user.id, parsed.data.currentPassword);
  if (check === "limited") return TOO_MANY;
  if (check === "wrong") return { fieldErrors: { currentPassword: "That password is incorrect." } };

  const db = await getDb();
  try {
    await db
      .update(schema.users)
      .set({ email: parsed.data.newEmail })
      .where(eq(schema.users.id, session.user.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { fieldErrors: { newEmail: "Another account already uses that email." } };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Email updated." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGNED_OUT;

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const check = await confirmPassword(session.user.id, parsed.data.currentPassword);
  if (check === "limited") return TOO_MANY;
  if (check === "wrong") return { fieldErrors: { currentPassword: "That password is incorrect." } };

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword) })
    .where(eq(schema.users.id, session.user.id));

  // A changed password should end every other login, but not this one.
  await deleteSessionsForUser(session.user.id, session.sessionId);

  revalidatePath("/account");
  return { ok: true, message: "Password changed. Every other device was signed out." };
}

export async function signOutOtherDevices(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await deleteSessionsForUser(session.user.id, session.sessionId);
  revalidatePath("/account");
}

export async function signOutEverywhere(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await deleteSessionsForUser(session.user.id);
  await endSession();
  redirect("/login");
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return SIGNED_OUT;

  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const check = await confirmPassword(session.user.id, parsed.data.password);
  if (check === "limited") return TOO_MANY;
  if (check === "wrong") return { fieldErrors: { password: "That password is incorrect." } };

  // Library entries and sessions are removed by ON DELETE CASCADE.
  const db = await getDb();
  await db.delete(schema.users).where(eq(schema.users.id, session.user.id));

  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?account=deleted");
}
