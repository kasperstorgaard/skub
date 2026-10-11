import { deleteCookie, getCookies, setCookie } from "@std/http/cookie";

import { getPuzzleManifest } from "#/game/loader.ts";
import { decodeProgress, encodeProgress, Progress } from "#/game/progress.ts";
import { deflate, inflate } from "#/lib/deflate.ts";
import { isDev } from "#/lib/env.ts";
import {
  COOKIE_SIGNING_KEY,
  signBytes,
  verifyBytes,
} from "#/lib/signed-cookie.ts";

const PROGRESS_KEY = "progress";
// Bumping it makes every device rebuild its progress from KV once.
const PROGRESS_VERSION = 1;
// 5 years in seconds, same as user_id
const PROGRESS_DURATION = 60 * 60 * 24 * 365 * 5;
// Leave headroom under the 4 KB cookie cap; bigger progress stays in KV only.
const PROGRESS_MAX_LENGTH = 3800;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** The verified `progress` cookie, or `null` if absent, tampered with or another user's. */
export async function getProgressCookie(
  req: Request,
  userId: string,
): Promise<Progress | null> {
  const value = getCookies(req.headers)[PROGRESS_KEY];
  if (!value) return null;

  const payload = await verifyBytes(value, COOKIE_SIGNING_KEY);
  if (!payload || payload[0] !== PROGRESS_VERSION) return null;

  const idEnd = 2 + payload[1];
  const id = decoder.decode(payload.subarray(2, idEnd));
  if (id !== userId) return null;

  try {
    const [bytes, manifest] = await Promise.all([
      inflate(payload.subarray(idEnd)),
      getPuzzleManifest(),
    ]);
    return decodeProgress(bytes, manifest);
  } catch {
    return null;
  }
}

/** Signs progress bound to its user, or `null` if it won't fit in a cookie. */
export async function signProgress(
  progress: Progress,
  userId: string,
): Promise<string | null> {
  const manifest = await getPuzzleManifest();
  const id = encoder.encode(userId);
  const body = await deflate(encodeProgress(progress, manifest));
  const payload = new Uint8Array([PROGRESS_VERSION, id.length, ...id, ...body]);

  const value = await signBytes(payload, COOKIE_SIGNING_KEY);
  return value.length > PROGRESS_MAX_LENGTH ? null : value;
}

/** Sets the `progress` cookie to a value from {@link signProgress}. */
export function setProgressCookie(headers: Headers, value: string): void {
  setCookie(headers, {
    name: PROGRESS_KEY,
    value,
    httpOnly: true,
    path: "/",
    secure: !isDev,
    maxAge: PROGRESS_DURATION,
    sameSite: "Lax",
  });
}

export function clearProgressCookie(headers: Headers): void {
  deleteCookie(headers, PROGRESS_KEY, { path: "/" });
}
