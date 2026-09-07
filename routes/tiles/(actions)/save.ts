import { HttpError } from "fresh";

import { define } from "#/core.ts";
import { getUserTileDraft } from "#/db/user.ts";
import { nextId, readTile, removeTile, writeTile } from "#/game/tile-store.ts";
import { categorizeTile, validateTile } from "#/game/tiles.ts";
import type { TileCategory } from "#/game/types.ts";
import { isDev } from "#/lib/env.ts";

/**
 * Files the tile draft in the catalog.
 *
 * The category is read off the tile rather than typed. A new tile takes the next
 * free number in that category; an edit replaces the tile it came from and keeps
 * its number. Only the letter moves when an edit changes a tile's character —
 * `b-07` becomes `x-07` — so a reworked tile stays the tile it was.
 */
export const handler = define.handlers({
  async GET(ctx) {
    // Dev-only: production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const draft = await getUserTileDraft(ctx.state.userId);
    if (!draft) throw new HttpError(404, "No tile in progress");

    // A half-drawn tile is an ordinary state to be in, so say what is wrong
    // rather than throw a 500 at it.
    let tile;
    try {
      tile = validateTile(draft.board);
    } catch (err) {
      throw new HttpError(
        400,
        err instanceof Error ? err.message : "Invalid tile",
      );
    }

    const category = categorizeTile(tile);

    // A draft carries the id it was opened from; anything else is a new tile.
    const existing = draft.slug === "untitled"
      ? null
      : await readTile(draft.slug);

    const id = existing
      ? await renumbered(existing.id, existing.category, category)
      : await nextId(category);

    await writeTile({ id, category, tile });
    // A category change renames the file, so the old one goes.
    if (existing && id !== existing.id) await removeTile(existing.id);

    return new Response("", { headers: { Location: "/tiles" }, status: 303 });
  },
});

/**
 * The id an edited tile keeps: its own when its character hasn't changed, and
 * otherwise the same number under the new category letter. Only a number already
 * taken there forces a new one.
 */
async function renumbered(
  id: string,
  was: TileCategory,
  now: TileCategory,
): Promise<string> {
  if (was === now) return id;

  const renamed = `${now.toLowerCase()}-${id.split("-").at(-1)}`;

  return await readTile(renamed) ? await nextId(now) : renamed;
}
