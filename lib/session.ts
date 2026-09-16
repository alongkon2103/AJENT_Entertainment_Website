// Admin session token: "<expiry-ms>.<hmac>". Signed with ADMIN_PASSWORD, so changing the password logs everyone out.
// No Next.js imports here, so proxy.ts, route handlers and server actions can all share it.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "ajent_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // seconds

function secret() {
  const s = process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("ADMIN_PASSWORD is not set");
  return s;
}

/** Constant-time string compare (hashing first makes lengths equal). */
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken() {
  const expiry = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expiry}.${sign(expiry)}`;
}

export function isValidSession(token: string | undefined) {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const [expiry, sig] = token.split(".");
  return Boolean(expiry && sig) && Number(expiry) > Date.now() && safeEqual(sig, sign(expiry));
}

export const isCorrectPassword = (input: string) => Boolean(process.env.ADMIN_PASSWORD) && safeEqual(input, secret());
