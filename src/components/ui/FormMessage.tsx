import type { FormState } from "@/lib/form-state";

/** Shows a form-level error or success message returned by a server action. */
export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
        {state.error}
      </p>
    );
  }
  if (state?.ok && state.message) {
    return (
      <p role="status" className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        {state.message}
      </p>
    );
  }
  return null;
}
