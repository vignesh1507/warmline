/**
 * Single-user passcode auth.
 *
 * The session cookie is `expiry.hmac`, signed with SESSION_SECRET using Web
 * Crypto so the same code runs in middleware (edge) and in server components.
 * No user record, no password database — there is one user, and the passcode
 * lives in the environment.
 */
const COOKIE_NAME = "warmline_session";
const encoder = new TextEncoder();

export { COOKIE_NAME };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short — set a long random string in .env");
  }
  return value;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-independent comparison, so a wrong guess leaks nothing through timing. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function passcodeMatches(input: string): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    throw new Error("APP_PASSCODE is not set — nobody could sign in. Set one in .env");
  }
  return safeEqual(input.trim(), expected);
}

export async function createSessionToken(ttlDays = 30): Promise<string> {
  const expiresAt = Date.now() + ttlDays * 86_400_000;
  const payload = String(expiresAt);
  return `${payload}.${await hmacHex(payload)}`;
}

export async function sessionTokenIsValid(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  return safeEqual(signature, await hmacHex(payload));
}

export const SESSION_MAX_AGE_SECONDS = 30 * 86_400;
