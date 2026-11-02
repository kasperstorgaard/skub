import { getCookies, setCookie } from "@std/http/cookie";

import { decodeMoves, encodeMoves } from "#/game/strings.ts";
import type { Move } from "#/game/types.ts";

const TRACKING_ID_KEY = "tracking_id";
// 1 year
const TRACKING_DURATION = 1000 * 60 * 60 * 24 * 365;

const HINT_COUNT_KEY = "hint_count";
// 24 h in seconds
const HINT_COUNT_DURATION = 60 * 60 * 24;

const FLASH_NUDGED_KEY = "flash_nudged";
// 1 year in seconds
const FLASH_NUDGED_DURATION = 60 * 60 * 24 * 365;

const FLASH_KEY = "flash";
// 24 h in seconds
const FLASH_DURATION = 60 * 60 * 24;

/**
 * Generates a tracking ID using Web Crypto API.
 * @returns a UUID string
 */
export function generateTrackingId() {
  return crypto.randomUUID();
}

/**
 * Sets the tracking_id cookie for analytics consent.
 * @param headers
 * @param id - the tracking ID, or "declined" if user declined
 * @returns updated headers
 */
export function setTrackingCookie(headers: Headers, id: string) {
  const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") != null;

  setCookie(headers, {
    name: TRACKING_ID_KEY,
    value: id,
    httpOnly: false, // needs to be readable client-side to hide banner
    path: "/",
    secure: isDenoDeploy,
    maxAge: TRACKING_DURATION,
    sameSite: "Lax",
  });

  return headers;
}

/**
 * Gets the tracking_id cookie value.
 * @param headers
 * @returns the tracking ID, "declined", or undefined if not set
 */
export function getTrackingCookie(headers: Headers) {
  const cookies = getCookies(headers);

  return cookies[TRACKING_ID_KEY];
}

/**
 * Reads the hint count for a puzzle from the request cookies.
 * Resets automatically after 24 hours (enforced by cookie expiry).
 */
export function getHintCount(headers: Headers) {
  const cookies = getCookies(headers);
  const raw = cookies[HINT_COUNT_KEY];
  return raw ? parseInt(raw, 10) : 0;
}

type SetHintCookieOptions = {
  path: string;
  value: number | string;
};

/**
 * Sets the hint count cookie for a specific puzzle.
 * Path-scoped to /puzzles/<slug> and expires after 24 hours.
 */
export function setHintCount(
  headers: Headers,
  { path, value }: SetHintCookieOptions,
) {
  setCookie(headers, {
    name: HINT_COUNT_KEY,
    value: value.toString(),
    path,
    maxAge: HINT_COUNT_DURATION,
    httpOnly: true,
  });
}

/**
 * The Flash start for a puzzle, or `null` when Flash is off.
 * Turns itself off after 24 hours (enforced by cookie expiry).
 */
export function getFlashStart(headers: Headers): Move[] | null {
  const raw = getCookies(headers)[FLASH_KEY];
  return raw ? decodeMoves(raw) : null;
}

type SetFlashCookieOptions = {
  path: string;
  flashStart: Move[];
};

/**
 * Turns Flash on for a puzzle, keeping its Flash start.
 * Path-scoped to /puzzles/<slug> and expires after 24 hours.
 */
export function setFlashStart(
  headers: Headers,
  { path, flashStart }: SetFlashCookieOptions,
) {
  setCookie(headers, {
    name: FLASH_KEY,
    value: encodeMoves(flashStart),
    path,
    maxAge: FLASH_DURATION,
    httpOnly: true,
    sameSite: "Lax",
  });
}

/** Whether the Flash nudge has been answered, either way. */
export function isFlashNudged(headers: Headers) {
  return getCookies(headers)[FLASH_NUDGED_KEY] === "1";
}

/** Hides the Flash nudge on every puzzle; the badge stays the way in. */
export function setFlashNudged(headers: Headers) {
  setCookie(headers, {
    name: FLASH_NUDGED_KEY,
    value: "1",
    path: "/",
    maxAge: FLASH_NUDGED_DURATION,
    httpOnly: true,
    sameSite: "Lax",
  });
}
