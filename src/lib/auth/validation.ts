import * as z from "zod";

/**
 * A short deny-list of the passwords people actually pick. Length is the main
 * defence (10+ characters, up to 128); this just catches the obvious ones.
 */
const COMMON_PASSWORDS = new Set([
  "1234567890",
  "0123456789",
  "12345678910",
  "1111111111",
  "0000000000",
  "qwertyuiop",
  "qwerty1234",
  "qwerty12345",
  "1q2w3e4r5t",
  "abcdefghij",
  "password12",
  "password123",
  "password1234",
  "password!23",
  "passw0rd123",
  "iloveyou123",
  "letmein1234",
  "welcome123",
  "welcome1234",
  "changeme123",
  "administrator",
  "adminadmin",
  "watchnow123",
  "watchnow1234",
]);

export const emailSchema = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254, { error: "That email address is too long." })
  .pipe(z.email({ error: "Enter a valid email address." }));

export const displayNameSchema = z
  .string({ error: "Enter a display name." })
  .trim()
  .min(1, { error: "Enter a display name." })
  .max(50, { error: "Keep it to 50 characters or fewer." })
  .regex(/^[^\p{Cc}]+$/u, { error: "Display names can't contain control characters." });

export const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(10, { error: "Use at least 10 characters." })
  .max(128, { error: "Use 128 characters or fewer." })
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    error: "That password is too common. Try a longer phrase.",
  });

const currentPasswordSchema = z
  .string({ error: "Enter your current password." })
  .min(1, { error: "Enter your current password." })
  .max(128, { error: "That password is too long." });

export const signupSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(128),
});

export const profileSchema = z.object({ displayName: displayNameSchema });

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: currentPasswordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: currentPasswordSchema,
  confirm: z.literal("DELETE", { error: "Type DELETE to confirm." }),
});

/** First error per field, keyed by field name, ready to show under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
