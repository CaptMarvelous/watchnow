import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/redirect";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw, "/library");
  if (await getCurrentUser()) redirect(next);

  return (
    <section className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl">Join {SITE_NAME}</h1>
      <p className="mt-2 text-sm text-mute">
        Track the movies, dramas and anime you watch, and import your lists from other sites.
      </p>
      <div className="mt-8">
        <SignupForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-mute">
        Already have an account?{" "}
        <Link
          href={next === "/library" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="text-cream underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
