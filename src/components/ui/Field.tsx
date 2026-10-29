import type { ComponentProps } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with an optional hint and an accessible inline error. */
export function Field({ label, error, hint, id, className = "", ...props }: Props) {
  const fieldId = id ?? props.name;
  const describedBy =
    [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-cream">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm text-cream placeholder:text-mute focus:outline-none ${
          error ? "border-rose-400" : "border-line focus:border-marquee"
        } ${className}`}
        {...props}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
