import { getCookies, setCookie } from "@std/http/cookie";

import type { User } from "#/db/types.ts";
import { isDev } from "#/lib/env.ts";
import { signValue, verifyValue } from "#/lib/signed-cookie.ts";

export const USER_ID_KEY = "user_id";
// 5 years in seconds
const USER_ID_DURATION = 60 * 60 * 24 * 365 * 5;

export function getUserIdCookie(headers: Headers): string | undefined {
  return getCookies(headers)[USER_ID_KEY];
}

export function setUserIdCookie(headers: Headers, userId: string): void {
  setCookie(headers, {
    name: USER_ID_KEY,
    value: userId,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: USER_ID_DURATION,
    sameSite: "Lax",
  });
}

const PROFILE_KEY = "profile";
const SESSION_KEY = "session";
// 30 minutes of inactivity ends a session, as in PostHog
const SESSION_DURATION = 60 * 30;
// Leave headroom under the 4 KB cookie cap; a bigger profile stays in KV only.
const PROFILE_MAX_LENGTH = 3800;

const COOKIE_SIGNING_KEY = getSigningKey();

function getSigningKey(): string {
  const key = Deno.env.get("COOKIE_SIGNING_KEY") ??
    (isDev ? "skub-dev-cookie-signing-key" : undefined);
  if (!key) throw new Error("COOKIE_SIGNING_KEY must be set outside dev");
  return key;
}

/** The user record as carried by the `profile` cookie, bound to its user id. */
export type Profile = User & { sessionId?: string };

const profiles = new WeakMap<Request, Promise<Profile | null>>();

/** The verified `profile` cookie, or `null` if absent or tampered with. */
export function getProfileCookie(req: Request): Promise<Profile | null> {
  let profile = profiles.get(req);
  if (!profile) {
    profile = readProfile(req.headers);
    profiles.set(req, profile);
  }
  return profile;
}

async function readProfile(headers: Headers): Promise<Profile | null> {
  const value = getCookies(headers)[PROFILE_KEY];
  if (!value) return null;

  const payload = await verifyValue(value, COOKIE_SIGNING_KEY);
  if (!payload) return null;

  try {
    const { v, ...profile } = JSON.parse(payload);
    return v === 1 ? profile : null;
  } catch {
    return null;
  }
}

/** JSON payload for `profile`, keys in a fixed order so equal profiles compare equal. */
export function encodeProfile(profile: Profile): string {
  const { id, sessionId, skillLevel, theme, name, email } = profile;
  return JSON.stringify({
    v: 1,
    id,
    sessionId,
    skillLevel,
    theme,
    name,
    email,
  });
}

/** Sets the `profile` cookie from an {@link encodeProfile} payload; skipped if too large. */
export async function setProfileCookie(
  headers: Headers,
  payload: string,
): Promise<void> {
  const value = await signValue(payload, COOKIE_SIGNING_KEY);
  if (value.length > PROFILE_MAX_LENGTH) return;

  setCookie(headers, {
    name: PROFILE_KEY,
    value,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: USER_ID_DURATION,
    sameSite: "Lax",
  });
}

/** Whether the device has made a request in the last 30 minutes. */
export function hasSessionCookie(headers: Headers): boolean {
  return SESSION_KEY in getCookies(headers);
}

/** Starts or extends the device's session. Unsigned: forging it only skips a sync. */
export function setSessionCookie(headers: Headers): void {
  setCookie(headers, {
    name: SESSION_KEY,
    value: "1",
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: SESSION_DURATION,
    sameSite: "Lax",
  });
}
