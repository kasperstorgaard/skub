import { deleteCookie, getCookies, setCookie } from "@std/http/cookie";

import type { User } from "#/db/types.ts";
import { isDev } from "#/lib/env.ts";
import {
  COOKIE_SIGNING_KEY,
  signValue,
  verifyValue,
} from "#/lib/signed-cookie.ts";

const PROFILE_KEY = "profile";
// 5 years in seconds, same as user_id
const PROFILE_DURATION = 60 * 60 * 24 * 365 * 5;
// Leave headroom under the 4 KB cookie cap; a bigger profile stays in KV only.
const PROFILE_MAX_LENGTH = 3800;

/** The user record as carried by the `profile` cookie, bound to its user id. */
export type Profile = User & {
  sessionId?: string;
  // Epoch ms of the last KV read, so logged-in devices know when to resync
  syncedAt?: number;
};

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
  const { id, sessionId, syncedAt, skillLevel, theme, name, email } = profile;
  return JSON.stringify({
    v: 1,
    id,
    sessionId,
    syncedAt,
    skillLevel,
    theme,
    name,
    email,
  });
}

/** Signs an {@link encodeProfile} payload, or `null` if it won't fit in a cookie. */
export async function signProfile(payload: string): Promise<string | null> {
  const value = await signValue(payload, COOKIE_SIGNING_KEY);
  return value.length > PROFILE_MAX_LENGTH ? null : value;
}

/** Sets the `profile` cookie to a value from {@link signProfile}. */
export function setProfileCookie(headers: Headers, value: string): void {
  setCookie(headers, {
    name: PROFILE_KEY,
    value,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: PROFILE_DURATION,
    sameSite: "Lax",
  });
}

export function clearProfileCookie(headers: Headers): void {
  deleteCookie(headers, PROFILE_KEY, { path: "/" });
}
