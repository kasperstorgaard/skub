import { HttpError } from "fresh";

import { readCandidates } from "#/game/candidate-store.ts";
import { shippedFrom } from "#/game/candidates.ts";
import { isDev } from "#/lib/env.ts";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

/**
 * Opens a shipped puzzle's candidate page: the version it was promoted from, or
 * — for a puzzle made by hand — its corpus copy under its own slug.
 */
export const handler = define.handlers({
  async GET(ctx) {
    if (!isDev) throw new HttpError(404, "Not found");

    const { puzzle } = ctx.state;
    const candidate = shippedFrom(puzzle, await readCandidates());

    return new Response("", {
      headers: { Location: `/candidates/${candidate?.slug ?? puzzle.slug}` },
      status: 303,
    });
  },
});
