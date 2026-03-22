import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { incrementHintUsageCount } from "#/db/stats.ts";
import { getHintCount, setHintCount } from "#/game/cookies.ts";
import { getPuzzle } from "#/game/loader.ts";
import { decodeState } from "#/game/url.ts";
import { isDev } from "#/lib/env.ts";
import { posthog } from "#/lib/posthog.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { cookieChoice, trackingId } = ctx.state;

    const slug = ctx.params.slug;

    const state = decodeState(ctx.req.url);

    const puzzle = await getPuzzle(slug);
    if (!puzzle) throw new HttpError(404, "Unable to get puzzle");

    if (slug === "preview") {
      throw new HttpError(503, "Hints not allowed on preview");
    }

    const hintCount = getHintCount(ctx.req.headers);

    if (!isDev && hintCount >= 1) {
      throw new HttpError(400, "Hint limit exceeded");
    }

    // hint requested is an important metric for engagement and to gauge difficulty
    posthog?.capture({
      event: "hint_requested",
      distinctId: trackingId,
      properties: {
        $current_url: ctx.req.url,
        $process_person_profile: cookieChoice === "accepted",

        puzzle_slug: slug,
        puzzle_difficulty: puzzle.difficulty,
        puzzle_min_moves: puzzle.minMoves,
        game_moves: state.cursor,
      },
    });

    await incrementHintUsageCount(slug);

    const url = new URL(ctx.req.url);
    url.pathname = `/puzzles/${slug}`;
    url.searchParams.set("dialog", "hint");

    const headers = new Headers();
    setHintCount(headers, { path: `/puzzles/${slug}`, value: hintCount + 1 });
    headers.set("Location", url.href);

    return new Response(null, { headers, status: 303 });
  },
});
