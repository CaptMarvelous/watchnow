"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { quickAdd } from "@/app/actions/library";
import type { MediaKind } from "@/lib/types";
import { useLibrary } from "./LibraryProvider";
import { StatusPill } from "./StatusPill";

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

type Props = {
  kind: MediaKind;
  id: number;
  title: string;
  variant?: "icon" | "full";
};

/**
 * One-tap "plan to watch". Shows the title's status instead when it is already
 * in the library, and a sign-in link for visitors who aren't signed in.
 */
export function QuickAdd({ kind, id, title, variant = "icon" }: Props) {
  const { signedIn, index } = useLibrary();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const status = index[`${kind}:${id}`];
  if (status) return <StatusPill status={status} className={variant === "full" ? "px-3 py-1.5 text-xs" : ""} />;

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  if (variant === "full") {
    const classes =
      "inline-flex items-center gap-2 rounded-full border border-cream/30 px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-cream hover:bg-cream/10 disabled:opacity-60";
    if (!signedIn) {
      return (
        <Link href={loginHref} className={classes}>
          <PlusIcon /> Sign in to track
        </Link>
      );
    }
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          disabled={pending}
          className={classes}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await quickAdd(kind, id);
              if (!result.ok) setError(result.error);
            })
          }
        >
          <PlusIcon /> {pending ? "Adding…" : "Plan to watch"}
        </button>
        {error && <span role="alert" className="text-xs text-rose-300">{error}</span>}
      </span>
    );
  }

  const iconClasses =
    "grid size-8 place-items-center rounded-full bg-ink/70 text-cream backdrop-blur transition hover:bg-ink hover:text-marquee disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  if (!signedIn) {
    return (
      <Link href={loginHref} aria-label={`Sign in to add ${title} to your library`} title="Sign in to track" className={iconClasses}>
        <PlusIcon />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Add ${title} to plan to watch`}
      title={error ?? "Plan to watch"}
      className={iconClasses}
      onClick={() =>
        startTransition(async () => {
          setError(null);
          const result = await quickAdd(kind, id);
          if (!result.ok) setError(result.error);
        })
      }
    >
      {pending ? "…" : <PlusIcon />}
    </button>
  );
}
