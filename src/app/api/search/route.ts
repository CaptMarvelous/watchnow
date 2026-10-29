import { NextResponse } from "next/server";
import { toCard } from "@/lib/format";
import { searchMedia } from "@/lib/tmdb";

/**
 * Search proxy for the header's live suggestions. Keeping this on the server
 * means the TMDB credential never reaches the browser.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (q.length < 2 || q.length > 100) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { results } = await searchMedia(q);
    return NextResponse.json(
      { results: results.slice(0, 6).map(toCard) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
}
