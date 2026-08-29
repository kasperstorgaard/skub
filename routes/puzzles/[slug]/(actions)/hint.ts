import { HttpError } from "fresh";

import { incrementHintUsageCount } from "#/db/stats.ts";
import { resolveMoves } from "#/game/board.ts";
import { getHintCount, setHintCount } from "#/game/cookies.ts";
import { solveSync } from "#/game/solver.ts";
import { encodeMove } from "#/game/strings.ts";
import type { Move } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { isDev } from "#/lib/env.ts";
import { trackHintRequested } from "#/lib/tracking.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * The one place a hint comes from, so the allowance is checked wherever one is
 * produced. Serves two representations of the same result — JSON for the
 * dialog's client-side enhancement, a 303 back to the puzzle without JS.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const slug = ctx.params.slug;
    const { puzzle } = ctx.state;

    const state = decodeState(ctx.req.url);

    if (slug === "preview") {
      throw new HttpError(503, "Hints not allowed on preview");
    }

    const hintCount = getHintCount(ctx.req.headers);

    if (!isDev && hintCount >= 1) {
      throw new HttpError(400, "Hint limit exceeded");
    }

    // Hint from where the player actually stands, not the pristine board.
    const played = state.moves.slice(0, state.cursor ?? state.moves.length);

    let solution: Move[];
    try {
      // resolveMoves throws on an illegal move, so a forged move list is
      // rejected here rather than reaching the solver.
      solution = solveSync(resolveMoves(puzzle.board, played));
    } catch {
      throw new HttpError(422, "No solution from this position");
    }

    if (!solution.length) throw new HttpError(422, "Puzzle already solved");

    // Counted only once a hint actually exists — a failed solve shouldn't spend
    // the player's allowance.
    trackHintRequested(ctx.state, puzzle, {
      url: ctx.req.url,
      cursor: state.cursor,
    });

    await incrementHintUsageCount(slug);

    const headers = new Headers();
    setHintCount(headers, { path: `/puzzles/${slug}`, value: hintCount + 1 });

    const hint = encodeMove(solution[0]);

    if (ctx.req.headers.get("accept")?.includes("application/json")) {
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ hint, remaining: solution.length }),
        { headers },
      );
    }

    const url = new URL(ctx.req.url);
    url.pathname = `/puzzles/${slug}`;
    url.searchParams.set("dialog", "hint");
    url.searchParams.set("hint", hint);
    url.searchParams.set("remaining", String(solution.length));

    headers.set("Location", url.href);

    return new Response(null, { headers, status: 303 });
  },
});
