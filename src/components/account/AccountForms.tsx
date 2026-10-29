"use client";

import { useActionState } from "react";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  updateProfile,
} from "@/app/actions/account";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";

const primary =
  "rounded-full bg-marquee px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90 disabled:opacity-60";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field
        label="Display name"
        name="displayName"
        defaultValue={displayName}
        required
        maxLength={50}
        error={state?.fieldErrors?.displayName}
      />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changeEmail, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-mute">
        Current email: <span className="text-cream">{email}</span>
      </p>
      <FormMessage state={state} />
      <Field
        label="New email"
        name="newEmail"
        type="email"
        autoComplete="email"
        required
        error={errors.newEmail}
      />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Updating…" : "Change email"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <Field
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        hint="At least 10 characters."
        error={errors.newPassword}
      />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <Field
        label="Type DELETE to confirm"
        name="confirm"
        autoComplete="off"
        required
        error={errors.confirm}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-rose-400/60 px-5 py-2 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
