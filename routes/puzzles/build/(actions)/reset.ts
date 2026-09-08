import { define } from "#/core.ts";
import { newPuzzleDraft, setUserPuzzleDraft } from "#/db/user.ts";

/**
 * Empties the editor draft and opens the editor on a blank board. Its own
 * action because `/puzzles/build` resumes whatever draft is in KV.
 */
export const handler = define.handlers({
  async GET(ctx) {
    await setUserPuzzleDraft(ctx.state.userId, newPuzzleDraft());

    return new Response("", {
      headers: { Location: "/puzzles/build" },
      status: 303,
    });
  },
});
