import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { getDayOfYear } from "#/game/date.ts";
import { getPuzzle } from "#/game/loader.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Guards all [slug] routes against premature access.
 * Returns 404 for puzzles with a number beyond today's day-of-year.
 * Dev always bypasses the guard.
 */
// TODO: use the cached manifest (getPuzzleManifest) instead of getPuzzle —
// getPuzzle re-reads and re-parses the .md file on every request, and most
// [slug] handlers call it again themselves, so the middleware currently
// doubles the per-request cost. The manifest has slug + number + hidden,
// which is all the guard needs.
export const handler = define.middleware(async (ctx) => {
  if (isDev) return ctx.next();

  const { slug } = ctx.params;
  const puzzle = await getPuzzle(slug);

  if (!puzzle) {
    throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
  }

  if (puzzle.number) {
    const dayOfYear = getDayOfYear(new Date(Date.now()));
    if (puzzle.number > dayOfYear) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }
  }

  return ctx.next();
});
