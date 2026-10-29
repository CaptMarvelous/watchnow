import Papa from "papaparse";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { exportLibrary } from "@/lib/library/queries";
import { SITE_SLUG } from "@/lib/site";

const COLUMNS = [
  "title",
  "year",
  "type",
  "status",
  "score",
  "episodes_watched",
  "total_episodes",
  "finished_on",
  "tmdb_kind",
  "tmdb_id",
  "imdb_id",
  "source",
  "added_at",
  "updated_at",
] as const;

/** Download the signed-in user's library as JSON or CSV. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Sign in to download your data.", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = await exportLibrary(user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const common = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "csv") {
    const csv = Papa.unparse(
      { fields: [...COLUMNS], data: rows.map((row) => COLUMNS.map((c) => row[c] ?? "")) },
      // Titles come from other people's lists: stop spreadsheets running "=..." cells.
      { escapeFormulae: true },
    );
    return new NextResponse(csv, {
      headers: {
        ...common,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${SITE_SLUG}-library-${stamp}.csv"`,
      },
    });
  }

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: { email: user.email, display_name: user.displayName },
      library: rows,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      ...common,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${SITE_SLUG}-library-${stamp}.json"`,
    },
  });
}
