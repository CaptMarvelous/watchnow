"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { isLimited, recordFailure, WINDOW } from "@/lib/auth/rate-limit";
import { MAX_UPLOAD_BYTES } from "@/lib/import/container";
import type { ImportState } from "@/lib/import/report";
import { runImport } from "@/lib/import/run";
import { ImportError } from "@/lib/import/types";
import { STATUSES } from "@/lib/library/constants";

const optionsSchema = z.object({
  source: z.enum(["auto", "mal", "mdl", "letterboxd", "imdb", "csv"]),
  defaultStatus: z.enum(STATUSES),
  policy: z.enum(["keep", "overwrite"]),
});

/** Import a list exported from another site into the signed-in user's library. */
export async function importList(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has ended. Please sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a file to import." } };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { fieldErrors: { file: `That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` } };
  }

  const options = optionsSchema.safeParse({
    source: formData.get("source"),
    defaultStatus: formData.get("defaultStatus"),
    policy: formData.get("policy"),
  });
  if (!options.success) return { error: "Those import options aren't valid. Reload the page and try again." };

  // Imports do a lot of work (parsing, TMDB lookups, a big write), so cap how often one account runs them.
  const key = `import:user:${user.id}`;
  if (await isLimited(key, 12, WINDOW.hour)) {
    return { error: "You've run a lot of imports in the last hour. Try again a little later." };
  }
  await recordFailure(key, WINDOW.hour);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const report = await runImport(user.id, bytes, file.name.slice(0, 200), options.data);
    revalidatePath("/", "layout");
    return { report };
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message };
    console.error("[import] unexpected failure", error);
    return {
      error:
        "Something went wrong while importing, and nothing was changed. Try again, or try a smaller file.",
    };
  }
}
