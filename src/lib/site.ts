/**
 * The one place the product name lives.
 *
 * To rename the app: change the two parts below (they are split only so the
 * logo can colour the second half), then update the "name" field in
 * package.json and the title in README.md. Nothing else hard-codes the name.
 */
export const SITE_NAME_PARTS = ["Watch", "Now"] as const;

export const SITE_NAME: string = SITE_NAME_PARTS.join("");

/** Lowercase identifier used for storage keys, cookie names and file names. */
export const SITE_SLUG: string = SITE_NAME.toLowerCase();

export const SITE_TAGLINE =
  "Discover movies and dramas, and keep track of everything you've watched.";
