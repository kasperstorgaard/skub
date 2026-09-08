import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import {
  getUserTileDraft,
  newPuzzleDraft,
  setUserTileDraft,
} from "#/db/user.ts";
import { readTile } from "#/game/tile-store.ts";
import { CELL_CONTENTS, type Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { EditorKeyboardShortcuts } from "#/islands/editor-keyboard-shortcuts.tsx";
import { EditorToolbar } from "#/islands/editor-toolbar.tsx";
import { TileAutosave } from "#/islands/tile-autosave.tsx";
import { TilePanel } from "#/islands/tile-panel.tsx";
import { isDev } from "#/lib/env.ts";

/** A tile has no puck, so the cell cycle skips it. */
const TILE_CONTENTS = CELL_CONTENTS.filter((content) => content !== "puck");

/**
 * The tile builder. The URL says which tile is being worked on: a slug opens
 * that one, no slug is a new tile.
 *
 * A stored tile is read once and then left alone, so returning to its URL
 * resumes the edits rather than reloading over them. A draft still carrying an
 * id has to be dropped when no slug is asked for, though — otherwise "New tile"
 * reopens the last one and saving writes the new drawing over it.
 */
export const handler = define.handlers<Puzzle>({
  async GET(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const slug = ctx.url.searchParams.get("slug");
    const draft = await getUserTileDraft(ctx.state.userId);

    // The draft stands only when it is the tile the URL asks for: a new tile
    // when there is no slug, that stored tile when there is one.
    if (draft && (draft.slug || "") === (slug || "")) return page(draft);

    if (!slug) {
      const fresh = newPuzzleDraft();
      await setUserTileDraft(ctx.state.userId, fresh);
      return page(fresh);
    }

    const entry = await readTile(slug);
    if (!entry) throw new HttpError(404, "Not found");

    const opened: Puzzle = {
      ...newPuzzleDraft(),
      name: entry.name ?? entry.id,
      slug: entry.id,
      board: entry.tile,
    };

    await setUserTileDraft(ctx.state.userId, opened);
    return page(opened);
  },
});

export default define.page<typeof handler>(function TileBuilderPage(props) {
  const puzzle = useSignal(props.data);
  const href = useSignal(props.url.href);
  const mode = useSignal<"editor">("editor");

  const url = new URL(props.req.url);

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/tiles" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat">
              {props.data.slug || "New tile"}
            </h1>
            <p className="text-text-3 leading-tight ml-1">tile</p>
          </div>
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board puzzle={puzzle} href={href} mode={mode} size={4} />

          <EditorToolbar
            puzzle={puzzle}
            href={href}
            hidePuck
            hideDestination
            className="absolute max-lg:bottom-0 max-lg:left-1/2 max-lg:-translate-x-1/2 lg:ml-fl-1 lg:left-full lg:top-1/2 lg:-translate-y-1/2"
          />
        </div>
      </Main>

      <TilePanel puzzle={puzzle} />
      <TileAutosave puzzle={puzzle} />
      <EditorKeyboardShortcuts
        puzzle={puzzle}
        href={href}
        contents={TILE_CONTENTS}
      />
    </>
  );
});
