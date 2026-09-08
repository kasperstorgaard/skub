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
import { setBuildMode } from "#/game/cookies.ts";
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
 * The tile builder, on the draft in KV. A slug opens a stored tile instead —
 * loaded once and then left alone, so a reload does not throw away edits made
 * since, the way re-reading the file each time would.
 */
export const handler = define.handlers<Puzzle>({
  async GET(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const headers = new Headers();
    setBuildMode(headers, "tile");

    const slug = ctx.url.searchParams.get("slug");
    const draft = await getUserTileDraft(ctx.state.userId);

    if (slug && draft?.slug !== slug) {
      const entry = await readTile(slug);
      if (!entry) throw new HttpError(404, "Not found");

      const opened: Puzzle = {
        ...newPuzzleDraft(),
        name: entry.name ?? entry.id,
        slug: entry.id,
        board: entry.tile,
      };

      await setUserTileDraft(ctx.state.userId, opened);
      return page(opened, { headers });
    }

    return page(draft ?? newPuzzleDraft(), { headers });
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
