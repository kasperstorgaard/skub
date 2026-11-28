import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";
import { parsePuzzle } from "#/game/parser.ts";

/** Saves the board as it stands, then plays it: autosave may still be pending. */
export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const markdown = form.get("markdown")?.toString() ?? "";

    await setUserPuzzleDraft(
      ctx.state.userId,
      parsePuzzle(markdown, { validate: false }),
    );

    return new Response(null, {
      headers: { Location: "/puzzles/preview" },
      status: 303,
    });
  },
});
