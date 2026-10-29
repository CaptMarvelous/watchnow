"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-mute">
        We couldn&apos;t load this page. It may be a temporary problem with the movie
        service.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex rounded-full bg-marquee px-6 py-2.5 text-sm font-semibold text-ink hover:bg-marquee/90"
      >
        Try again
      </button>
    </section>
  );
}
