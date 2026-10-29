"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state?.fieldErrors?.password}
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-marquee px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
