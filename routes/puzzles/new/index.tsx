import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import { getTileOptions } from "#/game/cookies.ts";
import { readTiles } from "#/game/tile-store.ts";
import type { ComposerConfig, DealtTile } from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { EditableName } from "#/islands/editable-name.tsx";
import { EditorAutosave } from "#/islands/editor-autosave.tsx";
import { EditorDifficultyBadge } from "#/islands/editor-difficulty-badge.tsx";
import { EditorKeyboardShortcuts } from "#/islands/editor-keyboard-shortcuts.tsx";
import { EditorPanel } from "#/islands/editor-panel.tsx";
import { EditorToolbar } from "#/islands/editor-toolbar.tsx";
import { TileArranger } from "#/islands/tile-arranger.tsx";
import { isDev } from "#/lib/env.ts";

type EditorData = {
  puzzle: Puzzle;
  /** The tiles a board can be composed from. Empty outside dev. */
  catalog: TileEntry[];
  config: ComposerConfig;
};

const DEFAULT_CONFIG: ComposerConfig = { mode: "random", distinct: 4 };

export const handler = define.handlers<EditorData>({
  async GET(ctx) {
    const puzzle = await getUserPuzzleDraft(ctx.state.userId) ?? {
      number: 0,
      name: "Untitled",
      slug: "untitled",
      createdAt: new Date(Date.now()),
      difficulty: "medium",
      minMoves: 0,
      board: {
        destination: { x: 0, y: 0 },
        pieces: [],
        walls: [],
        holes: [],
        portals: [],
      },
    };

    // Tiles are authored in dev, so that is the only place there is a catalog
    // to deal from.
    const catalog = isDev ? await readTiles() : [];

    return page({
      puzzle,
      catalog,
      config: { ...DEFAULT_CONFIG, ...getTileOptions(ctx.req.headers) },
    });
  },
});

export default define.page<typeof handler>(function EditorPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const mode = useSignal<"editor">("editor");

  const config = useSignal(props.data.config);
  const dealt = useSignal<DealtTile[]>([]);

  const url = new URL(props.req.url);

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col group">
            <EditableName
              puzzle={puzzle}
              defaultValue="Untitled"
              className="text-5 text-brand pr-1 leading-flat"
            />

            <p
              className={clsx(
                "text-text-3 leading-tight ml-1",
                "group-focus-within:opacity-0 transition-opacity",
              )}
            >
              edit
            </p>
          </div>

          <EditorDifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board
            puzzle={puzzle}
            href={href}
            mode={mode}
            className="lg:col-[1/2] lg:row-[4/5]"
          />

          <EditorToolbar
            puzzle={puzzle}
            href={href}
            className={clsx(
              "absolute",
              "max-lg:bottom-0 max-lg:left-1/2 max-lg:-translate-x-1/2",
              "lg:ml-fl-1 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
            )}
          />

          {props.data.catalog.length > 0 && (
            <TileArranger
              puzzle={puzzle}
              dealt={dealt}
              config={config}
              catalog={props.data.catalog}
              className={clsx(
                "max-lg:mt-fl-2",
                "lg:absolute lg:mr-fl-1 lg:right-full lg:top-1/2 lg:-translate-y-1/2",
              )}
            />
          )}
        </div>
      </Main>
      <EditorPanel
        puzzle={puzzle}
        href={href}
        isDev={isDev}
        config={props.data.catalog.length ? config : undefined}
        dealt={dealt}
      />
      <EditorAutosave puzzle={puzzle} />
      <EditorKeyboardShortcuts puzzle={puzzle} href={href} />
    </>
  );
});
