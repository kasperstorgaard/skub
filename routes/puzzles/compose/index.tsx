import { useComputed, useSignal } from "@preact/signals";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { getUserPuzzleDraft } from "#/db/user.ts";
import { getTileOptions } from "#/game/cookies.ts";
import { readTiles } from "#/game/tile-store.ts";
import {
  type ComposerConfig,
  composerStep,
  type DealtTile,
} from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { ComposerPanel } from "#/islands/composer-panel.tsx";
import { EditorAutosave } from "#/islands/editor-autosave.tsx";
import { EditorDifficultyBadge } from "#/islands/editor-difficulty-badge.tsx";
import { TileArranger } from "#/islands/tile-arranger.tsx";
import { isDev } from "#/lib/env.ts";

type ComposerData = {
  puzzle: Puzzle;
  catalog: TileEntry[];
  config: ComposerConfig;
};

const DEFAULT_CONFIG: ComposerConfig = { mode: "random", distinct: 4 };

/**
 * Composing a board from tiles. Its own route rather than a mode of the editor:
 * the two share a board, a draft and the way out to review, but almost none of
 * their controls — one arranges tiles, the other draws cells.
 */
export const handler = define.handlers<ComposerData>({
  async GET(ctx) {
    // Dev-only: tiles are authored, and production's filesystem is read-only.
    if (!isDev) throw new HttpError(404, "Not found");

    const puzzle = await getUserPuzzleDraft(ctx.state.userId) ?? {
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

    return page({
      puzzle,
      catalog: await readTiles(),
      config: { ...DEFAULT_CONFIG, ...getTileOptions(ctx.req.headers) },
    });
  },
});

export default define.page<typeof handler>(function ComposerPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const mode = useSignal<"editor">("editor");

  const config = useSignal(props.data.config);
  const dealt = useSignal<DealtTile[]>([]);
  const step = useComputed(() => composerStep(puzzle.value.board));

  const url = new URL(props.req.url);

  return (
    <>
      <Main className="lg:relative">
        <Header url={url} back={{ href: "/puzzles/new" }} />

        <div className="flex justify-between items-center gap-fl-1 mt-2">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand pr-1 leading-flat">Compose</h1>
            <p className="text-text-3 leading-tight ml-1">
              {props.data.catalog.length
                ? `${props.data.catalog.length} tiles`
                : "no tiles yet"}
            </p>
          </div>

          <EditorDifficultyBadge puzzle={puzzle} className="lg:mt-1" />
        </div>

        <div className="relative max-lg:pb-fl-5">
          <Board puzzle={puzzle} href={href} mode={mode} />

          {
            /* Tile controls only. Nudging a cell is the editor's job, and it
              works on the same draft, one link away. */
          }
          <TileArranger
            puzzle={puzzle}
            dealt={dealt}
            config={config}
            step={step}
            catalog={props.data.catalog}
            className="absolute max-lg:bottom-0 max-lg:left-1/2 max-lg:-translate-x-1/2 lg:ml-fl-1 lg:left-full lg:top-1/2 lg:-translate-y-1/2"
          />
        </div>
      </Main>

      <ComposerPanel
        puzzle={puzzle}
        config={config}
        dealt={dealt}
        step={step}
      />
      <EditorAutosave puzzle={puzzle} />
    </>
  );
});
