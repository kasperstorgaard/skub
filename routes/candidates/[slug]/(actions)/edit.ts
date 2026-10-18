import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";
import { readCandidate } from "#/game/candidate-store.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Takes a candidate into the editor as the current draft, name and move count
 * included — unlike `clone`, which strips both for remixing.
 */
export const handler = define.handlers({
  async GET(ctx) {
    if (!isDev) throw new HttpError(404, "Not found");

    const candidate = await readCandidate(ctx.params.slug);
    if (!candidate) throw new HttpError(404, "Not found");

    const { name, slug: puzzleSlug, createdAt, difficulty, minMoves, board } =
      candidate;
    await setUserPuzzleDraft(ctx.state.userId, {
      name,
      slug: puzzleSlug,
      createdAt,
      difficulty,
      minMoves,
      board,
    });

    return new Response("", {
      headers: { Location: "/puzzles/build" },
      status: 303,
    });
  },
});
