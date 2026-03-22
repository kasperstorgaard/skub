import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";
import { getPuzzle } from "#/game/loader.ts";
import { isDev } from "#/lib/env.ts";

// Redirect handler to create a new puzzle based on an existing one
export const handler = define.handlers({
  async GET(ctx) {
    const { slug } = ctx.params;

    const puzzle = await getPuzzle(slug);
    if (!puzzle) {
      throw new HttpError(404, `Unable to find puzzle with slug: ${slug}`);
    }
    if (!isDev) puzzle.name = "Untitled";

    puzzle.createdAt = new Date(Date.now());
    puzzle.minMoves = 0;

    await setUserPuzzleDraft(ctx.state.userId, puzzle);

    return new Response("", {
      headers: { Location: "/puzzles/new" },
      status: 303,
    });
  },
});
