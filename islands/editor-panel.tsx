import { type Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useMemo } from "preact/hooks";

import {
  ArrowClockwise,
  ArrowRight,
  ArrowSquareIn,
  DownloadSimple,
  Eye,
  FlipHorizontal,
  FlipVertical,
  FloppyDisk,
  Icon,
  Shuffle,
  Trash,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { flipBoard, resolveMoves, rotateBoard } from "#/game/board.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Puzzle } from "#/game/types.ts";
import { decodeState, encodeState } from "#/game/url.ts";
import { useRouter } from "#/islands/router.tsx";

type EditorPanelProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  isDev: boolean;
};

/**
 * Side panel for the puzzle editor.
 * Provides board transform actions (rotate, flip), a clear action, and — in
 * dev — a save button that writes directly to static puzzles. Generation lives
 * on the separate generator route (`/puzzles/generate`), which is dev-only.
 */
export function EditorPanel(
  { puzzle, href, isDev }: EditorPanelProps,
) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const board = useMemo(() => {
    const url = new URL(href.value);
    url.search = encodeState({
      ...puzzle.value.board,
      moves: [],
    });

    const state = decodeState(url.href);
    const moves = state.moves.slice(0, state.cursor ?? state.moves.length);

    return resolveMoves(puzzle.value.board, moves);
  }, [href.value, puzzle.value.board]);

  const formatted = useMemo(() =>
    formatPuzzle({
      number: puzzle.value.number,
      name: puzzle.value.name,
      slug: puzzle.value.slug,
      createdAt: puzzle.value.createdAt ?? new Date(Date.now()),
      difficulty: puzzle.value.difficulty,
      minMoves: puzzle.value.minMoves ?? 0,
      board,
    }), [puzzle.value, board]);

  const onSave = useCallback(async () => {
    await fetch("/api/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: puzzle.value.slug, markdown: formatted }),
    });

    const url = new URL(href.value);

    if (!url.pathname.startsWith(`/puzzles/${puzzle.value.slug}`)) {
      url.pathname = `/puzzles/${puzzle.value.slug}`;
      updateLocation(url.href);
    }
  }, [href.value, puzzle.value.slug, formatted]);

  const onClear = useCallback(() => {
    puzzle.value = {
      ...puzzle.value,
      board: { destination: { x: 3, y: 3 }, pieces: [], walls: [] },
      minMoves: 0,
    };
  }, [puzzle]);

  return (
    <Panel>
      <a
        href="/contribute"
        target="_blank"
        className={clsx(
          "col-[2/3] text-fl-1 mb-fl-4 leading-tight",
          "lg:row-[1/3] lg:text-fl-0 lg:mb-0",
        )}
      >
        Guide: How to add puzzles
      </a>

      <div className="flex flex-col col-[2/3] lg:row-[3/4] gap-fl-4 lg:gap-fl-1 place-content-between">
        <div className="flex flex-col gap-fl-1 flex-wrap">
          <div className="flex gap-fl-1 flex-wrap lg:justify-center">
            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: rotateBoard(puzzle.value.board, "right"),
                };
              }}
            >
              <Icon icon={ArrowClockwise} />
              <span className="sr-only">Rotate 90°</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: flipBoard(puzzle.value.board, "horizontal"),
                };
              }}
            >
              <Icon icon={FlipHorizontal} />
              <span className="sr-only">Mirror Horizontally</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              data-size="sm"
              onClick={() => {
                puzzle.value = {
                  ...puzzle.value,
                  board: flipBoard(puzzle.value.board, "vertical"),
                };
              }}
            >
              <Icon icon={FlipVertical} />
              <span className="sr-only">Mirror Vertically</span>
            </button>
          </div>

          <button
            type="button"
            className="btn"
            onClick={onClear}
          >
            <Icon icon={Trash} />
            Clear
          </button>

          {isDev && (
            <a href="/puzzles/generate" className="btn">
              <Icon icon={Shuffle} />
              Generate
            </a>
          )}
        </div>

        <div className="flex flex-col flex-wrap gap-fl-1">
          {isDev
            ? (
              <button
                type="button"
                className="btn"
                onClick={onSave}
              >
                <Icon icon={FloppyDisk} />Save
              </button>
            )
            : (
              <>
                <a
                  href="/api/export"
                  download
                  className="btn"
                >
                  <Icon icon={DownloadSimple} />Download
                </a>

                <form
                  action="/api/import"
                  method="post"
                  enctype="multipart/form-data"
                  className="flex flex-row gap-1"
                >
                  <label className="btn cursor-pointer flex-1">
                    <Icon icon={ArrowSquareIn} />Import
                    <input
                      type="file"
                      name="file"
                      accept=".md"
                      className="sr-only"
                      onChange={(e) => e.currentTarget.form?.submit()}
                    />
                  </label>
                  <noscript>
                    <button className="icon-btn" type="submit" data-size="sm">
                      <Icon icon={ArrowRight} />
                    </button>
                  </noscript>
                </form>
              </>
            )}

          <a
            href="/puzzles/preview"
            className="btn"
            target="_blank"
          >
            <Icon icon={Eye} /> Preview
          </a>
        </div>
      </div>
    </Panel>
  );
}
