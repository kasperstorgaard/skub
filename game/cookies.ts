import { getCookies, setCookie } from "@std/http/cookie";

import type { GenOptions } from "#/game/generated.ts";

const TRACKING_ID_KEY = "tracking_id";
// 1 year
const TRACKING_DURATION = 1000 * 60 * 60 * 24 * 365;

const HINT_COUNT_KEY = "hint_count";
// 24 h in seconds
const HINT_COUNT_DURATION = 60 * 60 * 24;

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

const GENERATOR_OPTIONS_KEY = "generator_options";
// 1 year in seconds
const GENERATOR_OPTIONS_DURATION = 60 * 60 * 24 * 365;

const DIFFICULTIES = ["easy", "medium", "hard"];
const SPREADS = ["mid", "balanced", "spread"];

const isRange = (r: unknown): r is [number, number] =>
  Array.isArray(r) && r.length === 2 &&
  r.every((n) => typeof n === "number" && n >= 0) && r[0] <= r[1];

/**
 * Reads the generator's persisted knob values from the request cookies, so a
 * curation session's settings survive reloads. Set by `setGeneratorOptions` on
 * each /api/generate run; anything malformed or out of range is dropped
 * field-by-field rather than rejecting the whole cookie.
 */
export function getGeneratorOptions(headers: Headers): Partial<GenOptions> {
  const raw = getCookies(headers)[GENERATOR_OPTIONS_KEY];
  if (!raw) return {};

  let stored: Partial<GenOptions>;
  try {
    stored = JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }

  const options: Partial<GenOptions> = {};
  if (DIFFICULTIES.includes(stored.difficulty!)) {
    options.difficulty = stored.difficulty;
  }
  if (isRange(stored.wallsRange)) options.wallsRange = stored.wallsRange;
  if (isRange(stored.blockersRange)) {
    options.blockersRange = stored.blockersRange;
  }
  if (SPREADS.includes(stored.wallSpread!)) {
    options.wallSpread = stored.wallSpread;
  }
  if (
    typeof stored.symmetry === "number" &&
    stored.symmetry >= 0 && stored.symmetry <= 1
  ) {
    options.symmetry = stored.symmetry;
  }
  return options;
}

/**
 * Persists the knob values a generation run actually used, on the response
 * headers of /api/generate — "persist on Generate", so idle slider twiddling
 * never sticks. Server-set and server-read only, hence httpOnly.
 */
export function setGeneratorOptions(headers: Headers, options: GenOptions) {
  setCookie(headers, {
    name: GENERATOR_OPTIONS_KEY,
    value: encodeURIComponent(JSON.stringify(options)),
    path: "/puzzles",
    maxAge: GENERATOR_OPTIONS_DURATION,
    httpOnly: true,
    sameSite: "Lax",
  });
  return headers;
}
