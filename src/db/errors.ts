/** True when a database error is a unique-constraint violation (Postgres 23505). */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  // Drizzle wraps the driver error; walk the cause chain to find the SQLSTATE.
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const code = (current as { code?: unknown }).code;
    if (code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
