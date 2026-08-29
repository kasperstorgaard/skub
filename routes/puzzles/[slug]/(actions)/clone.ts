import { setUserPuzzleDraft } from "#/db/user.ts";
import { isDev } from "#/lib/env.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

// Redirect handler to create a new puzzle based on an existing one
export const handler = define.handlers({
  async GET(ctx) {
    const { puzzle } = ctx.state;
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
