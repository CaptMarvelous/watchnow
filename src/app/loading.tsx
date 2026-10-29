export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-8 w-56 animate-pulse rounded bg-surface" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    </div>
  );
}
