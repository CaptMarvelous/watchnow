"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { fieldErrors } from "@/lib/auth/validation";
import type { FormState } from "@/lib/form-state";
import { STATUSES, type MediaType } from "@/lib/library/constants";
import {
  getEntryForMedia,
  linkEntryToMedia,
  removeEntry,
  removeEntryForMedia,
  saveTrackedEntry,
} from "@/lib/library/queries";
import { releaseYear, toCard } from "@/lib/format";
import { getMedia, searchMedia } from "@/lib/tmdb";
import type { CardMedia, MediaDetails, MediaKind } from "@/lib/types";

/** Empty input means "not set"; anything else must be a number. */
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    schema.nullable(),
  );

const saveSchema = z.object({
  kind: z.enum(["movie", "tv"], { error: "Unknown kind of title." }),
  tmdbId: z.coerce.number().int().positive().max(2_000_000_000),
  status: z.enum(STATUSES, { error: "Pick a status." }),
  score: optionalNumber(
    z.number({ error: "Enter a number from 1 to 10." }).min(0, { error: "Scores run from 1 to 10." }).max(10, { error: "Scores run from 1 to 10." }),
  ),
  progress: optionalNumber(
    z.number({ error: "Enter a whole number." }).int({ error: "Enter a whole number." }).min(0, { error: "Can't be negative." }).max(100_000),
  ),
});

const SIGNED_OUT: FormState = { error: "Your session has ended. Please sign in again." };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function titleRef(media: MediaDetails) {
  const year = Number.parseInt(releaseYear(media.releaseDate), 10);
  return {
    kind: media.kind,
    id: media.id,
    title: media.title,
    year: Number.isFinite(year) ? year : null,
  };
}

/** Add or edit the signed-in user's entry for a TMDB title. */
export async function saveEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;

  const parsed = saveSchema.safeParse({
    kind: formData.get("kind"),
    tmdbId: formData.get("tmdbId"),
    status: formData.get("status"),
    score: formData.get("score"),
    progress: formData.get("progress"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { kind, tmdbId, status, score } = parsed.data;

  // Title, poster and episode count come from TMDB, never from the browser.
  const media = await getMedia(kind, tmdbId);
  if (!media) return { error: "We couldn't find that title." };

  const ref = titleRef(media);
  const existing = await getEntryForMedia(user.id, ref);
  const totalEpisodes = media.tv?.episodes ?? existing?.totalEpisodes ?? null;

  let progress: number | null = null;
  if (kind === "tv") {
    progress = parsed.data.progress;
    if (progress == null && status === "completed") progress = totalEpisodes;
    if (progress != null && totalEpisodes != null) progress = Math.min(progress, totalEpisodes);
  }

  await saveTrackedEntry(user.id, {
    title: media.title,
    year: ref.year,
    mediaType: (existing?.mediaType as MediaType | undefined) ?? kind,
    status,
    score,
    progress,
    totalEpisodes,
    finishedOn:
      status === "completed" ? (existing?.finishedOn ?? today()) : (existing?.finishedOn ?? null),
    tmdbKind: kind,
    tmdbId,
    imdbId: existing?.imdbId ?? null,
    posterPath: media.posterPath,
    source: "manual",
    externalId: null,
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved to your library." };
}

/** One-tap "plan to watch" from a card. Never changes an entry that already exists. */
export async function quickAdd(
  kind: MediaKind,
  tmdbId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if ((kind !== "movie" && kind !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, error: "Unknown title." };
  }

  const media = await getMedia(kind, tmdbId);
  if (!media) return { ok: false, error: "We couldn't find that title." };

  const ref = titleRef(media);
  if (await getEntryForMedia(user.id, ref)) return { ok: true };

  await saveTrackedEntry(user.id, {
    title: media.title,
    year: ref.year,
    mediaType: kind,
    status: "plan",
    score: null,
    progress: null,
    totalEpisodes: media.tv?.episodes ?? null,
    finishedOn: null,
    tmdbKind: kind,
    tmdbId,
    imdbId: null,
    posterPath: media.posterPath,
    source: "manual",
    externalId: null,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove a title from the track panel on its detail page. */
export async function removeTracked(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return SIGNED_OUT;

  const kind = formData.get("kind");
  const tmdbId = Number(formData.get("tmdbId"));
  if ((kind !== "movie" && kind !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { error: "Unknown title." };
  }

  const media = await getMedia(kind, tmdbId);
  if (!media) return { error: "We couldn't find that title." };

  await removeEntryForMedia(user.id, titleRef(media));
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed from your library." };
}

/** Title search for the "find a match" panel on un-linked library entries. */
export async function searchForLink(
  query: string,
): Promise<{ ok: true; results: CardMedia[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const q = typeof query === "string" ? query.trim().slice(0, 100) : "";
  if (q.length < 2) return { ok: false, error: "Type at least two characters." };

  try {
    const { results } = await searchMedia(q);
    return { ok: true, results: results.slice(0, 6).map(toCard) };
  } catch {
    return { ok: false, error: "Search isn't available right now. Try again shortly." };
  }
}

/** Link an un-linked library entry to the TMDB title the user picked. */
export async function linkEntry(
  entryId: string,
  kind: MediaKind,
  tmdbId: number,
): Promise<{ ok: true; merged: boolean } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/i.test(entryId)) {
    return { ok: false, error: "Unknown entry." };
  }
  if ((kind !== "movie" && kind !== "tv") || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    return { ok: false, error: "Unknown title." };
  }

  // Title, poster and episode count come from TMDB, never from the browser.
  const media = await getMedia(kind, tmdbId);
  if (!media) return { ok: false, error: "We couldn't find that title." };

  const ref = titleRef(media);
  const result = await linkEntryToMedia(user.id, entryId, {
    kind,
    id: tmdbId,
    title: media.title,
    year: ref.year,
    posterPath: media.posterPath,
    totalEpisodes: media.tv?.episodes ?? null,
  });
  if (result === "missing") return { ok: false, error: "That entry no longer exists." };

  revalidatePath("/", "layout");
  return { ok: true, merged: result === "merged" };
}

/** Remove an entry from the library page (also covers entries with no TMDB link). */
export async function removeEntryById(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const id = formData.get("entryId");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return;

  // The user id in the query is what prevents deleting someone else's entry.
  await removeEntry(user.id, id);
  revalidatePath("/", "layout");
}
