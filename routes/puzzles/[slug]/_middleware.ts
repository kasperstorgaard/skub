import { createDefine, HttpError } from "fresh";

import type { State } from "#/core.ts";
import { getDayOfYear } from "#/game/date.ts";
import { getPuzzle } from "#/game/loader.ts";
import type { Puzzle } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

export type PuzzleState = State & { puzzle: Puzzle };

export const define = createDefine<PuzzleState>();

/**
 * Loads the puzzle for all routes under /puzzles/[slug].
 * Throws 404 if the slug doesn't match a puzzle file.
 * Guards all [slug] routes against premature access.
 * Returns 404 for puzzles with a number beyond today's day-of-year.
 * Dev always bypasses the guard.
 */
export const handler = define.middleware(async (ctx) => {
  const { slug } = ctx.params;
  const puzzle = await getPuzzle(slug);

  if (!puzzle) {
    throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
  }

  if (!isDev && puzzle.number) {
    const dayOfYear = getDayOfYear(new Date(Date.now()));
    if (puzzle.number > dayOfYear) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }
  }

  ctx.state.puzzle = puzzle;
  return ctx.next();
});
