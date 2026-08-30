import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";

/**
 * Empties the editor draft and opens the editor on a blank board.
 *
 * Its own action rather than a link to `/puzzles/new`, which resumes whatever
 * draft is in KV: after reviewing a candidate that draft is the board you just
 * came from, so "New" would land you back in the board you meant to leave.
 * Discarding it is safe — a reviewed board is already in the store.
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
      board: { destination: { x: 3, y: 3 }, pieces: [], walls: [] },
    });

    return new Response("", {
      headers: { Location: "/puzzles/new" },
      status: 303,
    });
  },
});
