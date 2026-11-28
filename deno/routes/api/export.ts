import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import { formatPuzzle } from "#/game/formatter.ts";

// GET endpoint that returns the stored puzzle as a markdown file download
export const handler = define.handlers({
  async GET(ctx) {
    const puzzle = await getUserPuzzleDraft(ctx.state.userId);
    if (!puzzle) return new Response("No stored puzzle", { status: 404 });

    return new Response(formatPuzzle(puzzle), {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${puzzle.slug}.md"`,
      },
    });
  },
});
