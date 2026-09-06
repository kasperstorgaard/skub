import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";

/**
 * Empties the editor draft and opens the editor on a blank board. Its own
 * action because `/puzzles/new` resumes whatever draft is in KV.
 */
export const handler = define.handlers({
  async GET(ctx) {
    await setUserPuzzleDraft(ctx.state.userId, {
      number: 0,
      name: "Untitled",
      slug: "untitled",
      createdAt: new Date(Date.now()),
      difficulty: "medium",
      minMoves: 0,
      board: {
        destination: { x: 3, y: 3 },
        pieces: [],
        walls: [],
        holes: [],
        portals: [],
      },
    });

    return new Response("", {
      headers: { Location: "/puzzles/new" },
      status: 303,
    });
  },
});
