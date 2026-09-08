import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { setUserTileDraft } from "#/db/user.ts";
import { normalizeBoard } from "#/game/board.ts";
import type { Board } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

type Payload = {
  /** The tile being drawn, mid-build and not yet valid. */
  board: Board;
  id?: string;
};

/**
 * Stores the tile draft. The board arrives as JSON rather than markdown: a
 * half-drawn tile can hold things a tile file may not, and the draft is only
 * ever read back into the builder.
 */
export const handler = define.handlers({
  async POST(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    let body: Payload;

    try {
      body = await ctx.req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body.board) return new Response("Invalid tile", { status: 400 });

    await setUserTileDraft(ctx.state.userId, {
      number: 0,
      // An unfiled tile carries no id, the same as an unnamed puzzle draft.
      name: body.id ?? "",
      slug: body.id ?? "",
      createdAt: new Date(Date.now()),
      difficulty: "medium",
      minMoves: 0,
      board: normalizeBoard(body.board),
    });

    return new Response("OK", { status: 200 });
  },
});
