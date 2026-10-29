import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const raw = (await searchParams).next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw, "/library");
  if (await getCurrentUser()) redirect(next);

  return (
    <section className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-display text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-mute">Sign in to see your library and keep your progress.</p>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-mute">
        New here?{" "}
        <Link
          href={next === "/library" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="text-cream underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
