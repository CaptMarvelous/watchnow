import { Hero } from "@/components/Hero";
import { MediaRow } from "@/components/MediaRow";
import { getHomeData } from "@/lib/tmdb";

export default async function HomePage() {
  const { hero, rows, sample } = await getHomeData();

  return (
    <>
      {sample && (
        <div
          role="status"
          className="border-b border-marquee/30 bg-marquee/10 px-4 py-2 text-center text-xs text-marquee"
        >
          {sample === "no-key"
            ? "Showing bundled sample data. Add a TMDB_API_KEY in .env.local to load the live catalogue."
            : "Couldn't reach TMDB, so sample data is shown. Check your TMDB_API_KEY and connection."}
        </div>
      )}

      {hero && <Hero media={hero} />}

      <div className="-mt-8 pb-4">
        {rows.map((row) => (
          <MediaRow key={row.slug} id={row.slug} title={row.title} items={row.items} />
        ))}
      </div>
    </>
  );
}
