import { setUserPuzzleDraft } from "#/db/user.ts";
import { isDev } from "#/lib/env.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

// Redirect handler to create a new puzzle based on an existing one. POST, as it
// writes a draft to KV.
export const handler = define.handlers({
  async POST(ctx) {
    const puzzle = {
      ...ctx.state.puzzle,
      name: isDev ? ctx.state.puzzle.name : "Untitled",
      createdAt: new Date(Date.now()),
      minMoves: 0,
    };

    await setUserPuzzleDraft(ctx.state.userId, puzzle);

    return new Response("", {
      headers: { Location: "/puzzles/build" },
      status: 303,
    });
  },
});
