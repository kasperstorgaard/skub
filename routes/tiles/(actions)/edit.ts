import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { setUserTileDraft } from "#/db/user.ts";
import { readTile } from "#/game/tile-store.ts";
import { isDev } from "#/lib/env.ts";

/** Loads a stored tile back into the builder. */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const id = new URL(ctx.req.url).searchParams.get("id");
    const entry = id ? await readTile(id) : null;
    if (!entry) throw new HttpError(404, "Not found");

    await setUserTileDraft(ctx.state.userId, {
      number: 0,
      name: entry.name ?? entry.id,
      slug: entry.id,
      createdAt: new Date(Date.now()),
      difficulty: "medium",
      minMoves: 0,
      board: entry.tile,
    });

    return new Response("", {
      headers: { Location: "/tiles/new" },
      status: 303,
    });
  },
});
