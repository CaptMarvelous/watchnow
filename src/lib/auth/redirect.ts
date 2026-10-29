/**
 * Only allow redirects to a path on this site. Anything that could point
 * elsewhere (//evil.com, /\evil.com, absolute URLs, control characters) falls
 * back to a safe default, which closes the "open redirect" hole in ?next=.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
