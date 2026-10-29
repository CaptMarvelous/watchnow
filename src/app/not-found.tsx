import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-marquee">
        404
      </p>
      <h1 className="mt-3 font-display text-4xl">Nothing to watch here</h1>
      <p className="mt-3 text-mute">
        We couldn&apos;t find the page or movie you were looking for.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-marquee px-6 py-2.5 text-sm font-semibold text-ink hover:bg-marquee/90"
      >
        Back to home
      </Link>
    </section>
  );
}
