import { type Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import {
  ArrowClockwise,
  ArrowRight,
  ArrowSquareIn,
  DownloadSimple,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Icon,
  Shuffle,
  Star,
  Trash,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { flipBoard, rotateBoard } from "#/game/board.ts";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Puzzle } from "#/game/types.ts";
import { useRouter } from "#/islands/router.tsx";

type EditorPanelProps = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  isDev: boolean;
};

/**
 * Side panel for the puzzle editor. Board transform actions (rotate, flip), a
 * clear action, and the ways out: Preview to play the draft, and — in dev —
 * Review, which files it as a candidate to be analysed and rated. Review is
 * the panel's only write; the corpus write lives behind Promote.
 */
export function EditorPanel(
  { puzzle, href, isDev }: EditorPanelProps,
) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  // Keeps the shared href in step with client-side navigations.
  useRouter({ onLocationUpdated });

  // Autosave is debounced and a navigation cancels the request in flight, so
  // Review stores the board on screen first. The href works with JS off too.
  const onReview = useCallback(async (e: Event) => {
    e.preventDefault();
    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
      });
    } catch {
      // Fall through: the draft in KV is the next best thing.
    }
    globalThis.location.href = "/candidate/review";
  }, []);

  const onClear = useCallback(() => {
    puzzle.value = {
      ...puzzle.value,
      board: {
        destination: { x: 3, y: 3 },
        pieces: [],
        walls: [],
        holes: [],
        portals: [],
      },
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
          {!isDev && (
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

          <a href="/puzzles/preview" className="btn" target="_blank">
            <Icon icon={Eye} /> Preview
          </a>

          {isDev && (
            <a href="/candidate/review" className="btn" onClick={onReview}>
              <Icon icon={Star} /> Review
            </a>
          )}
        </div>
      </div>
    </Panel>
  );
}
