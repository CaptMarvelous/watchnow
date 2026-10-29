import type { Metadata } from "next";
import { ImportForm } from "@/components/import/ImportForm";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Import a list" };

export default async function ImportPage() {
  await requireUser("/import");

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">Import a list</h1>
      <p className="mt-2 text-sm text-mute">
        Bring in what you&apos;ve already watched from another site. Titles are matched to this
        catalogue automatically where possible; anything that doesn&apos;t match is still saved,
        and you can link it by hand afterwards.
      </p>

      <div className="mt-6 space-y-1 text-sm text-mute">
        <p>
          <strong className="text-cream">MyAnimeList:</strong> on your anime list, use Export
          &gt; XML, then upload the file (or its .gz) here.
        </p>
        <p>
          <strong className="text-cream">MyDramaList:</strong> MDL doesn&apos;t offer its own
          export. A community userscript (&ldquo;Better MDL&rdquo;) or tool can save your list as
          a CSV; upload that here. Otherwise, add titles manually or through search.
        </p>
        <p>
          <strong className="text-cream">Letterboxd:</strong> Settings &gt; Data &gt; Export
          your data, then upload the .zip as it downloads.
        </p>
        <p>
          <strong className="text-cream">IMDb:</strong> on Your Ratings, use the Export button,
          then upload the CSV.
        </p>
      </div>

      <div className="mt-8">
        <ImportForm />
      </div>
    </section>
  );
}
