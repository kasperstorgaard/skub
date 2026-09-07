import { useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { getUserTileDraft } from "#/db/user.ts";
import { CELL_CONTENTS, type Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { EditorKeyboardShortcuts } from "#/islands/editor-keyboard-shortcuts.tsx";
import { EditorToolbar } from "#/islands/editor-toolbar.tsx";
import { TileAutosave } from "#/islands/tile-autosave.tsx";
import { TilePanel } from "#/islands/tile-panel.tsx";
import { isDev } from "#/lib/env.ts";

/** A tile has no puck, so the cell cycle skips it. */
const TILE_CONTENTS = CELL_CONTENTS.filter((content) => content !== "puck");

export const handler = define.handlers<Puzzle>({
  async GET(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const draft = await getUserTileDraft(ctx.state.userId) ?? {
      number: 0,
      name: "Untitled",
      slug: "untitled",
      createdAt: new Date(Date.now()),
      difficulty: "medium" as const,
      minMoves: 0,
      board: {
        destination: undefined,
        pieces: [],
        walls: [],
        holes: [],
        portals: [],
      },
    };

    return page(draft);
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
              {props.data.slug === "untitled" ? "New tile" : props.data.slug}
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
