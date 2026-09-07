import { type Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import { useComposer } from "#/client/composer.ts";
import { Eye, Icon, Play, Shuffle, Star, Trash } from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import { TileConfig } from "#/components/tile-config.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import {
  type ComposerConfig,
  type ComposerStep,
  type DealtTile,
  encodePlacements,
  toPlacements,
} from "#/game/tiles.ts";
import type { Puzzle, TileEntry } from "#/game/types.ts";

type ComposerPanelProps = {
  puzzle: Signal<Puzzle>;
  config: Signal<ComposerConfig>;
  dealt: Signal<DealtTile[]>;
  step: Signal<ComposerStep>;
  catalog: TileEntry[];
};

const EMPTY_BOARD = {
  destination: undefined,
  pieces: [],
  walls: [],
  holes: [],
  portals: [],
};

/**
 * The composer's sidebar: how to deal, the two actions that move a board
 * forward, and the ways out. Arranging what has been dealt happens beside the
 * board, where the tiles are.
 */
export function ComposerPanel(
  { puzzle, config, dealt, step, catalog }: ComposerPanelProps,
) {
  const { deal, roll } = useComposer({ puzzle, dealt, config, catalog });

  // Autosave is debounced and a navigation cancels the request in flight, so
  // Review stores the board on screen first.
  const onReview = useCallback(async (event: Event) => {
    event.preventDefault();

    try {
      await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: formatPuzzle(puzzle.value) }),
      });
    } catch {
      // Fall through: the draft in KV is the next best thing.
    }

    const tiles = dealt.value.length
      ? `?tiles=${
        encodeURIComponent(encodePlacements(toPlacements(dealt.value)))
      }`
      : "";

    globalThis.location.href = `/candidate/review${tiles}`;
  }, [dealt, puzzle]);

  const onClear = useCallback(() => {
    puzzle.value = { ...puzzle.value, board: { ...EMPTY_BOARD }, minMoves: 0 };
    dealt.value = [];
  }, [dealt, puzzle]);

  return (
    <Panel>
      <div
        className={clsx(
          "flex flex-col col-[2/3] lg:row-[1/4] gap-fl-4",
          "lg:gap-fl-2 place-content-between",
        )}
      >
        <div className="flex flex-col gap-fl-2">
          <TileConfig config={config} />

          <button type="button" className="btn" onClick={deal}>
            <Icon icon={Shuffle} /> Generate
          </button>

          {step.value !== "deal" && (
            <button type="button" className="btn" onClick={roll}>
              <Icon icon={Play} />
              {step.value === "roll" ? "Roll again" : "Roll"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-fl-1 items-start">
          {step.value === "roll" && (
            <>
              <a href="/puzzles/preview" className="btn" target="_blank">
                <Icon icon={Eye} /> Preview
              </a>

              <a href="/candidate/review" className="btn" onClick={onReview}>
                <Icon icon={Star} /> Review
              </a>
            </>
          )}

          {step.value !== "deal" && (
            <button
              type="button"
              className="text-fl-0 bg-transparent border-0 cursor-pointer text-link"
              onClick={onClear}
            >
              <Icon icon={Trash} /> Clear
            </button>
          )}

          <a href="/puzzles/new" className="text-fl-0">Edit by hand</a>
          <a href="/tiles" className="text-fl-0">Tile library</a>
        </div>
      </div>
    </Panel>
  );
}
