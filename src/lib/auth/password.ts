import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * Passwords are hashed with scrypt (built into Node, no native dependency).
 * Parameters follow OWASP's "N=2^15, r=8, p=3" option. They are stored inside
 * each hash string, so they can be raised later without invalidating old
 * hashes: needsRehash() flags a hash made with weaker settings and the login
 * action upgrades it the next time that user signs in.
 *
 * Format:  scrypt$<log2 N>$<r>$<p>$<salt b64>$<hash b64>
 */

const LOG2_N = 15;
const R = 8;
const P = 3;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
/** scrypt needs about 128 * N * r bytes (~32 MiB here); leave generous headroom. */
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  log2N: number,
  r: number,
  p: number,
  keyLength: number,
): Promise<Buffer> {
  const options: ScryptOptions = { N: 2 ** log2N, r, p, maxmem: MAX_MEMORY };
  return new Promise((resolve, reject) => {
    // NFKC so visually identical passwords typed on different devices match.
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, LOG2_N, R, P, KEY_BYTES);
  return ["scrypt", LOG2_N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

type Parsed = { log2N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [log2N, r, p] = [parts[1], parts[2], parts[3]].map(Number);
  const inRange = (n: number, lo: number, hi: number) =>
    Number.isInteger(n) && n >= lo && n <= hi;
  if (!inRange(log2N, 10, 20) || !inRange(r, 1, 16) || !inRange(p, 1, 16)) return null;

  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || hash.length === 0) return null;
  return { log2N, r, p, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  try {
    const actual = await derive(
      password,
      parsed.salt,
      parsed.log2N,
      parsed.r,
      parsed.p,
      parsed.hash.length,
    );
    return timingSafeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}

export function needsRehash(stored: string): boolean {
  const parsed = parse(stored);
  return (
    !parsed ||
    parsed.log2N !== LOG2_N ||
    parsed.r !== R ||
    parsed.p !== P ||
    parsed.hash.length !== KEY_BYTES
  );
}

let dummy: Promise<string> | null = null;

/**
 * A real hash of a throw-away password. Logging in with an unknown email still
 * verifies against this, so the response time doesn't reveal which emails exist.
 */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}
