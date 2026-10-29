"use client";

import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={50}
        defaultValue={state?.values?.displayName}
        error={errors.displayName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        error={errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        hint="At least 10 characters. A few random words make a strong password."
        error={errors.password}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-marquee px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90 disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
