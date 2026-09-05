import { define } from "#/core.ts";
import { setUserPuzzleDraft } from "#/db/user.ts";
import { parsePuzzle } from "#/game/parser.ts";
import { Puzzle } from "#/game/types.ts";

type Payload = {
  // markdown content to store
  markdown: string;
};

// POST endpoint for storing a puzzle in KV (either new or existing)
export const handler = define.handlers({
  async POST(ctx) {
    let body: Payload;

    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const { markdown } = body;

    if (!markdown) {
      return new Response("Invalid options", { status: 400 });
    }

    let puzzle: Puzzle;

    try {
      // A draft is saved on every change, most of them mid-build.
      puzzle = parsePuzzle(markdown, { validate: false });
    } catch {
      return new Response("Invalid puzzle", { status: 400 });
    }

    await setUserPuzzleDraft(ctx.state.userId, puzzle);

    return new Response("OK", { status: 200 });
  },
});
