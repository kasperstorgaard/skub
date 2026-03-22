import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import { isDev } from "#/lib/env.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const { userId } = ctx.state;
    const slug = ctx.params.slug;

    const puzzle = await getUserPuzzleDraft(userId);
    if (!puzzle) throw new HttpError(404, "Unable to get draft puzzle");

    if (!isDev && slug !== "preview") {
      throw new HttpError(503, "Solve only allowed on preview");
    }

    const url = new URL(ctx.req.url);
    url.pathname = `/puzzles/${slug}`;
    url.searchParams.set("dialog", "solve");

    const headers = new Headers();
    headers.set("Location", url.href);

    return new Response(null, { headers, status: 303 });
  },
});
